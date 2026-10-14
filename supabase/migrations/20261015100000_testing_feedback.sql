-- Fixes and features from Phase 5 testing.
--   1. Doctor verification: server-side validation (licence not expired, practice
--      dates not in the future, required documents; passport photo optional).
--   2. Patient booking, hospital first: bookable_hospitals(), bookable_doctors(),
--      book_appointment() with clear error messages.
--   3. Transactional email outbox: verification results, doctor invitations and
--      appointment status changes are queued in the same transaction as the
--      change, and sent by the email-worker edge function (retries, backoff).
--   4. Public "avatars" bucket for profile photos (own folder only).

-- -----------------------------------------------------------------------------
-- 1. Doctor verification validation
-- -----------------------------------------------------------------------------
create or replace function public.submit_doctor_verification(p_data jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  _docs jsonb := p_data->'credential_documents';
  _today date := (now() at time zone 'Africa/Lagos')::date;
  _expiry date;
  _from date;
  _to date;
  _missing text[];
begin
  if nullif(trim(coalesce(p_data->>'license_number', '')), '') is null then
    raise exception 'Enter your licence number';
  end if;
  if nullif(trim(coalesce(p_data->>'license_council', '')), '') is null then
    raise exception 'Enter the council that issued your licence';
  end if;

  begin
    _expiry := nullif(p_data->>'license_expiry', '')::date;
    _from := nullif(p_data->'current_practice'->>'from', '')::date;
    _to := nullif(p_data->'current_practice'->>'to', '')::date;
  exception when others then
    raise exception 'Enter dates as YYYY-MM-DD';
  end;
  if _expiry is null then
    raise exception 'Enter your licence expiry date';
  end if;
  if _expiry <= _today then
    raise exception 'Your licence has expired. Renew it before submitting';
  end if;
  if _from is not null and _from > _today then
    raise exception 'The practice start date cannot be in the future';
  end if;
  if _to is not null and _to > _today then
    raise exception 'The practice end date cannot be in the future. Leave it blank if you still work there';
  end if;
  if _from is not null and _to is not null and _to < _from then
    raise exception 'The practice end date must be after the start date';
  end if;

  if _docs is null or jsonb_typeof(_docs) <> 'object' then
    raise exception 'Upload your documents';
  end if;
  select array_agg(k) into _missing
    from unnest(array['license', 'id', 'certificate']) k
   where nullif(_docs->>k, '') is null;
  if _missing is not null then
    raise exception 'Missing documents: %', array_to_string(_missing, ', ');
  end if;
  if exists (select 1 from jsonb_each_text(_docs) e
             where e.value is not null and e.value not like auth.uid()::text || '/%') then
    raise exception 'Credential files must be in your own folder' using errcode = '42501';
  end if;

  update public.doctors
     set license_number = trim(p_data->>'license_number'),
         license_council = trim(p_data->>'license_council'),
         license_expiry = _expiry,
         specialty = coalesce(nullif(trim(p_data->>'specialty'), ''), specialty),
         years_experience = coalesce(nullif(p_data->>'years_experience', '')::int, years_experience),
         current_practice = p_data->'current_practice',
         credential_documents = _docs,
         reference_contact = p_data->'reference_contact',
         verification_status = 'pending_review',
         verification_submitted_at = now(),
         verification_rejection_reason = null
   where user_id = auth.uid()
     and verification_status in ('unverified', 'rejected');
  if not found then
    raise exception 'Verification cannot be submitted right now';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Booking: hospital first
-- -----------------------------------------------------------------------------
-- Approved, active hospitals a patient can book, with how many bookable doctors
-- they have (in the specialty, if given), whether they offer online visits, and
-- distance when the patient shares a location.
create or replace function public.bookable_hospitals(
  p_specialty text default null, p_lat numeric default null, p_lng numeric default null, p_search text default null)
returns table (
  id uuid, name text, address text, city text, state text, logo_url text,
  offers_telemedicine boolean, doctors_total bigint, doctors_in_specialty bigint, distance_km numeric)
language sql stable security definer
set search_path = ''
as $$
  with docs as (
    select hd.hospital_id, d.specialty
      from public.hospital_doctors hd
      join public.doctors d on d.id = hd.doctor_id
     where hd.status = 'active' and hd.is_active
       and d.verification_status = 'approved' and coalesce(d.is_available, true)
  )
  select h.id, h.name, h.address, h.city, h.state, h.logo_url,
         private.hospital_has_plan(h.id, 'telemedicine') as offers_telemedicine,
         (select count(*) from docs where docs.hospital_id = h.id) as doctors_total,
         (select count(*) from docs where docs.hospital_id = h.id
             and (p_specialty is null or docs.specialty ilike '%' || p_specialty || '%')) as doctors_in_specialty,
         case when p_lat is not null and p_lng is not null and h.lat is not null and h.lng is not null then
           round((6371 * acos(least(1, greatest(-1,
             cos(radians(p_lat)) * cos(radians(h.lat)) * cos(radians(h.lng) - radians(p_lng))
             + sin(radians(p_lat)) * sin(radians(h.lat))))))::numeric, 1)
         end as distance_km
    from public.hospitals h
   where h.is_active and h.verification_status = 'approved'
     and private.hospital_has_plan(h.id, 'emr')
     and (nullif(trim(coalesce(p_search, '')), '') is null
          or h.name ilike '%' || trim(p_search) || '%' or h.city ilike '%' || trim(p_search) || '%'
          or h.state ilike '%' || trim(p_search) || '%')
   order by (select count(*) from docs where docs.hospital_id = h.id
               and (p_specialty is null or docs.specialty ilike '%' || p_specialty || '%')) > 0 desc,
            distance_km nulls last, h.name
   limit 100;
$$;

-- Doctors a patient can book at one hospital.
create or replace function public.bookable_doctors(p_hospital_id uuid, p_specialty text default null)
returns table (
  id uuid, first_name text, last_name text, specialty text, years_experience int,
  bio text, profile_image_url text, rating numeric, matches_specialty boolean)
language sql stable security definer
set search_path = ''
as $$
  select d.id, d.first_name, d.last_name, d.specialty, d.years_experience, d.bio, d.profile_image_url, d.rating,
         (p_specialty is null or d.specialty ilike '%' || p_specialty || '%') as matches_specialty
    from public.hospital_doctors hd
    join public.doctors d on d.id = hd.doctor_id
    join public.hospitals h on h.id = hd.hospital_id
   where hd.hospital_id = p_hospital_id and hd.status = 'active' and hd.is_active
     and d.verification_status = 'approved' and coalesce(d.is_available, true)
     and h.is_active and h.verification_status = 'approved'
   order by (p_specialty is null or d.specialty ilike '%' || p_specialty || '%') desc, d.last_name, d.first_name;
$$;

-- Book an appointment with clear, specific errors.
-- p_doctor_id null = "any available doctor" at that hospital.
create or replace function public.book_appointment(
  p_hospital_id uuid, p_doctor_id uuid, p_date date, p_time time,
  p_is_telemedicine boolean default false, p_reason text default null)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _pid uuid := private.my_patient_id();
  _today date := (now() at time zone 'Africa/Lagos')::date;
  _h public.hospitals;
  _id uuid;
begin
  if _pid is null then
    raise exception 'Only patients can book appointments' using errcode = '42501';
  end if;
  if p_date is null then
    raise exception 'Choose a date';
  end if;
  if p_date < _today
     or (p_date = _today and p_time is not null and p_time < (now() at time zone 'Africa/Lagos')::time) then
    raise exception 'That time has already passed. Choose a later time';
  end if;
  if p_date > _today + 180 then
    raise exception 'You can book up to 6 months ahead';
  end if;

  select * into _h from public.hospitals where id = p_hospital_id;
  if not found or not _h.is_active or _h.verification_status <> 'approved'
     or not private.hospital_has_plan(p_hospital_id, 'emr') then
    raise exception 'This hospital is not taking bookings on HealingNet right now';
  end if;
  if coalesce(p_is_telemedicine, false) and not private.hospital_has_plan(p_hospital_id, 'telemedicine') then
    raise exception 'This hospital does not offer online consultations yet. Choose an in-person visit';
  end if;
  if p_doctor_id is not null and not exists (
       select 1 from public.hospital_doctors hd join public.doctors d on d.id = hd.doctor_id
        where hd.hospital_id = p_hospital_id and hd.doctor_id = p_doctor_id
          and hd.status = 'active' and hd.is_active
          and d.verification_status = 'approved' and coalesce(d.is_available, true)) then
    raise exception 'This doctor is not available at this hospital. Choose another doctor';
  end if;

  begin
    insert into public.patient_appointments
      (patient_id, hospital_id, doctor_id, requested_date, requested_time, reason, status, is_telemedicine)
    values (_pid, p_hospital_id, p_doctor_id, p_date, p_time, nullif(left(trim(coalesce(p_reason, '')), 500), ''),
            'pending', coalesce(p_is_telemedicine, false))
    returning id into _id;
  exception when unique_violation then
    raise exception 'That time was just taken. Choose another time';
  end;
  return _id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Email outbox
-- -----------------------------------------------------------------------------
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  template text not null,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text,
  send_after timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_email_outbox_due on public.email_outbox (send_after) where status in ('pending', 'sending');
create index idx_email_outbox_created on public.email_outbox (created_at);
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from public, anon, authenticated;
grant all on public.email_outbox to service_role;

create or replace function private.enqueue_email(_template text, _to_user_id uuid, _data jsonb)
returns void
language sql volatile security definer
set search_path = ''
as $$
  insert into public.email_outbox (template, to_user_id, data)
  select _template, _to_user_id, coalesce(_data, '{}'::jsonb)
   where _to_user_id is not null;
$$;
revoke all on function private.enqueue_email(text, uuid, jsonb) from public, anon, authenticated;

-- Doctor verification result -> the doctor.
create or replace function private.email_on_doctor_review()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.verification_status in ('approved', 'rejected')
     and new.verification_status is distinct from old.verification_status then
    perform private.enqueue_email('doctor_verification_result', new.user_id,
      jsonb_strip_nulls(jsonb_build_object(
        'approved', new.verification_status = 'approved',
        'reason', case when new.verification_status = 'rejected'
                       then left(nullif(trim(new.verification_rejection_reason), ''), 1000) end)));
  end if;
  return new;
end;
$$;
create trigger trg_email_doctor_review after update of verification_status on public.doctors
  for each row execute function private.email_on_doctor_review();

-- Hospital verification result -> every active admin of that hospital.
create or replace function private.email_on_hospital_review()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.verification_status in ('approved', 'rejected')
     and new.verification_status is distinct from old.verification_status then
    insert into public.email_outbox (template, to_user_id, data)
    select 'hospital_verification_result', s.user_id,
           jsonb_strip_nulls(jsonb_build_object(
             'approved', new.verification_status = 'approved',
             'hospital_name', left(new.name, 200),
             'notes', case when new.verification_status = 'rejected'
                           then left(nullif(trim(new.verification_notes), ''), 1000) end))
      from public.hospital_staff s
     where s.hospital_id = new.id and s.role = 'admin' and s.is_active;
  end if;
  return new;
end;
$$;
create trigger trg_email_hospital_review after update of verification_status on public.hospitals
  for each row execute function private.email_on_hospital_review();

-- Hospital invites a doctor -> the doctor.
create or replace function private.email_on_doctor_invite()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status = 'pending' then
    perform private.enqueue_email('doctor_invited',
      (select d.user_id from public.doctors d where d.id = new.doctor_id),
      jsonb_build_object('hospital_name', (select left(h.name, 200) from public.hospitals h where h.id = new.hospital_id)));
  end if;
  return new;
end;
$$;
create trigger trg_email_doctor_invite after insert on public.hospital_doctors
  for each row execute function private.email_on_doctor_invite();

-- Appointment accepted / rejected / cancelled / completed / rescheduled -> the patient.
create or replace function private.email_on_appointment_change()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  _status text;
begin
  if new.status is distinct from old.status and new.status in ('accepted', 'rejected', 'cancelled', 'completed') then
    _status := new.status;
  elsif new.requested_date is distinct from old.requested_date or new.requested_time is distinct from old.requested_time then
    _status := 'rescheduled';
  else
    return new;
  end if;
  -- Don't email patients about changes they made themselves.
  if (select p.user_id from public.patients p where p.id = new.patient_id) is not distinct from auth.uid() then
    return new;
  end if;
  perform private.enqueue_email('appointment_status',
    (select p.user_id from public.patients p where p.id = new.patient_id),
    jsonb_strip_nulls(jsonb_build_object(
      'status', _status,
      'date', to_char(new.requested_date, 'YYYY-MM-DD'),
      'time', to_char(new.requested_time, 'HH24:MI'),
      'hospital_name', (select left(h.name, 200) from public.hospitals h where h.id = new.hospital_id),
      'doctor_name', (select left('Dr. ' || d.first_name || ' ' || d.last_name, 200) from public.doctors d where d.id = new.doctor_id))));
  return new;
end;
$$;
create trigger trg_email_appointment_change after update on public.patient_appointments
  for each row execute function private.email_on_appointment_change();

-- Worker API (service role only): claim a batch, then report each result.
create or replace function public.email_outbox_claim(p_limit int default 20)
returns setof public.email_outbox
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  return query
  update public.email_outbox o
     set status = 'sending', locked_at = now(), attempts = o.attempts + 1
   where o.id in (
     select x.id from public.email_outbox x
      where x.send_after <= now()
        and (x.status = 'pending'
             or (x.status = 'sending' and x.locked_at < now() - interval '10 minutes'))
      order by x.created_at
      limit least(greatest(coalesce(p_limit, 20), 1), 100)
      for update skip locked)
  returning o.*;
end;
$$;

-- p_result: 'sent' | 'skipped' (opted out / no email) | 'error'.
-- Errors retry with backoff (1, 4, 9, 16 minutes); after 5 attempts the email is marked failed.
create or replace function public.email_outbox_finish(p_id uuid, p_result text, p_error text default null)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if p_result not in ('sent', 'skipped', 'error') then
    raise exception 'Invalid result';
  end if;
  update public.email_outbox o
     set status = case p_result when 'sent' then 'sent' when 'skipped' then 'skipped'
                   else case when o.attempts >= 5 then 'failed' else 'pending' end end,
         sent_at = case when p_result = 'sent' then now() end,
         last_error = case when p_result = 'error' then left(p_error, 500) end,
         send_after = case when p_result = 'error' then now() + make_interval(mins => o.attempts * o.attempts) else o.send_after end,
         locked_at = null
   where o.id = p_id;
end;
$$;

revoke all on function public.email_outbox_claim(int) from public, anon, authenticated;
revoke all on function public.email_outbox_finish(uuid, text, text) from public, anon, authenticated;
grant execute on function public.email_outbox_claim(int) to service_role;
grant execute on function public.email_outbox_finish(uuid, text, text) to service_role;

-- Admin console: email queue health (no addresses or content).
create or replace function public.admin_email_queue()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'pending', (select count(*) from public.email_outbox where status in ('pending', 'sending')),
    'sent_24h', (select count(*) from public.email_outbox where status = 'sent' and sent_at > now() - interval '24 hours'),
    'failed_7d', (select count(*) from public.email_outbox where status = 'failed' and created_at > now() - interval '7 days'),
    'oldest_pending_minutes', (select round(extract(epoch from now() - min(created_at)) / 60)
                                 from public.email_outbox where status in ('pending', 'sending')),
    'recent_failures', coalesce((select jsonb_agg(x) from (
        select template, attempts, last_error, created_at from public.email_outbox
         where status = 'failed' order by created_at desc limit 10) x), '[]'::jsonb));
end;
$$;
revoke all on function public.admin_email_queue() from public, anon;
grant execute on function public.admin_email_queue() to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Profile photos
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Users upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users replace own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Users delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- -----------------------------------------------------------------------------
-- Grants for the new patient-facing functions
-- -----------------------------------------------------------------------------
revoke all on function public.bookable_hospitals(text, numeric, numeric, text) from public, anon;
revoke all on function public.bookable_doctors(uuid, text) from public, anon;
revoke all on function public.book_appointment(uuid, uuid, date, time, boolean, text) from public, anon;
grant execute on function public.bookable_hospitals(text, numeric, numeric, text) to authenticated;
grant execute on function public.bookable_doctors(uuid, text) to authenticated;
grant execute on function public.book_appointment(uuid, uuid, date, time, boolean, text) to authenticated;
