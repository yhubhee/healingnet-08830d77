-- =============================================================================
-- Family profiles (patient app v3)
--
-- A patient account can look after family members: children, parents, a
-- spouse, anyone they care for. Each family member is an ordinary patient
-- record with no login of their own (patients.user_id is null), linked to the
-- account holder through patient_guardians.
--
-- How access works: private.is_own_patient(id) is the single check every
-- patient-side rule already uses (records, appointments, prescriptions, lab
-- results, letters, pharmacy requests, ratings, share codes...). It now also
-- returns true for the caller's family members, so the guardian can do for
-- them exactly what a patient can do for themself, and nothing more.
-- Hospitals, doctors and pharmacies see a family member as a normal patient.
--
-- Notifications about a family member go to the guardian (patient_user_id now
-- falls back to the guardian) and are labelled with the member's first name.
--
-- Rules:
--   * Only a signed-in patient can add family members; at most 10 each.
--   * Date of birth is required. A family member aged 18 or over can be added
--     only when the guardian confirms they have that person's permission.
--   * One guardian per family member in this version.
--   * Removing a family member (or deleting the guardian's account) removes
--     everything not held by a hospital; records held by hospitals stay with
--     those hospitals, detached.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Links
-- -----------------------------------------------------------------------------
create table public.patient_guardians (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null unique references public.patients(id) on delete cascade,   -- one guardian each
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  relationship text not null check (relationship in ('child', 'parent', 'spouse', 'sibling', 'grandparent', 'grandchild', 'other')),
  consent_confirmed_at timestamptz,   -- set when an adult is added with the guardian's confirmation
  created_at timestamptz not null default now()
);
create index idx_patient_guardians_guardian on public.patient_guardians (guardian_user_id);

alter table public.patient_guardians enable row level security;
grant all on public.patient_guardians to service_role;
grant select on public.patient_guardians to authenticated;
create policy "Guardians see their own links" on public.patient_guardians
  for select to authenticated using (guardian_user_id = auth.uid());
-- Changes only through add_family_member / remove_family_member.

-- -----------------------------------------------------------------------------
-- 2. The central checks
-- -----------------------------------------------------------------------------
create or replace function private.is_own_patient(_patient_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.patients where id = _patient_id and user_id = auth.uid())
      or exists (select 1 from public.patient_guardians g
                  where g.patient_id = _patient_id and g.guardian_user_id = auth.uid())
$$;

-- Who receives a patient's notifications: their own login, else their guardian.
create or replace function public.patient_user_id(_patient_id uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select user_id from public.patients where id = _patient_id),
    (select guardian_user_id from public.patient_guardians where patient_id = _patient_id))
$$;

-- "The calling patient is registered at this hospital" now includes their family.
create or replace function private.is_patient_of_hospital(_hospital_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.hospital_patients hp
                  where hp.hospital_id = _hospital_id and private.is_own_patient(hp.patient_id))
$$;

-- Guardians may update a family member's profile like their own.
drop policy if exists "Patients and linked staff update patients" on public.patients;
create policy "Patients, guardians and linked staff update patients" on public.patients
  for update to authenticated
  using (private.is_own_patient(id) or private.can_staff_edit_patient(id))
  with check (private.is_own_patient(id) or private.can_staff_edit_patient(id));

-- -----------------------------------------------------------------------------
-- 3. Notifications name the family member
-- -----------------------------------------------------------------------------
alter table public.user_notifications
  add column if not exists subject_patient_id uuid references public.patients(id) on delete set null;

create or replace function private.label_notification_subject()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  _pid uuid;
  _p public.patients;
begin
  if new.audience <> 'patient' or new.reference_id is null or new.reference_type is null then
    return new;
  end if;
  _pid := case new.reference_type
    when 'appointment' then (select patient_id from public.patient_appointments where id = new.reference_id)
    when 'lab_result'  then (select patient_id from public.lab_results where id = new.reference_id)
    when 'letter'      then (select patient_id from public.patient_letters where id = new.reference_id)
    when 'prescription' then (select patient_id from public.prescriptions where id = new.reference_id)
    when 'rx_document' then (select patient_id from public.rx_documents where id = new.reference_id)
    when 'rx_request'  then (select patient_id from public.rx_pharmacy_requests where id = new.reference_id)
    else null end;
  if _pid is null then return new; end if;
  new.subject_patient_id := _pid;
  select * into _p from public.patients where id = _pid;
  -- Delivered to someone other than the patient (their guardian): say who it is about.
  if _p.user_id is distinct from new.user_id then
    new.title := left(coalesce(nullif(btrim(_p.first_name), ''), 'Family member') || ': ' || new.title, 200);
  end if;
  return new;
end;
$$;
-- BEFORE INSERT, so the push queued AFTER INSERT carries the label too.
create trigger trg_label_notification_subject before insert on public.user_notifications
  for each row execute function private.label_notification_subject();

-- -----------------------------------------------------------------------------
-- 4. Managing family members
-- -----------------------------------------------------------------------------
create or replace function public.add_family_member(
  p_first_name text, p_last_name text, p_date_of_birth date, p_gender text,
  p_relationship text, p_consent_confirmed boolean default false)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _id uuid;
  _age int;
begin
  if _uid is null or private.my_patient_id() is null then
    raise exception 'Only patients can add family members' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_first_name, '')), '') is null then
    raise exception 'Enter their first name';
  end if;
  if p_date_of_birth is null then
    raise exception 'Enter their date of birth';
  end if;
  if p_date_of_birth > (now() at time zone 'Africa/Lagos')::date then
    raise exception 'Date of birth cannot be in the future';
  end if;
  if p_date_of_birth < (now() at time zone 'Africa/Lagos')::date - interval '130 years' then
    raise exception 'Check the date of birth';
  end if;
  if p_relationship is null or p_relationship not in ('child', 'parent', 'spouse', 'sibling', 'grandparent', 'grandchild', 'other') then
    raise exception 'Choose how they are related to you';
  end if;
  _age := date_part('year', age((now() at time zone 'Africa/Lagos')::date, p_date_of_birth))::int;
  if _age >= 18 and not coalesce(p_consent_confirmed, false) then
    raise exception 'Confirm that you have their permission to manage their health care';
  end if;
  if (select count(*) from public.patient_guardians where guardian_user_id = _uid) >= 10 then
    raise exception 'You can add up to 10 family members';
  end if;

  insert into public.patients (user_id, first_name, last_name, date_of_birth, gender)
  values (null, left(btrim(p_first_name), 100), left(btrim(coalesce(p_last_name, '')), 100), p_date_of_birth,
          nullif(btrim(coalesce(p_gender, '')), ''))
  returning id into _id;

  insert into public.patient_guardians (patient_id, guardian_user_id, relationship, consent_confirmed_at)
  values (_id, _uid, p_relationship, case when _age >= 18 then now() end);
  return _id;
end;
$$;

-- The caller's family, with what the app needs to show the switcher.
create or replace function public.my_family()
returns table (patient_id uuid, first_name text, last_name text, date_of_birth date, gender text,
               relationship text, age int, is_adult boolean, linked_hospitals bigint, added_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.first_name, p.last_name, p.date_of_birth, p.gender, g.relationship,
         date_part('year', age((now() at time zone 'Africa/Lagos')::date, p.date_of_birth))::int,
         date_part('year', age((now() at time zone 'Africa/Lagos')::date, p.date_of_birth))::int >= 18,
         (select count(*) from public.hospital_patients hp where hp.patient_id = p.id),
         g.created_at
    from public.patient_guardians g join public.patients p on p.id = g.patient_id
   where g.guardian_user_id = auth.uid()
   order by g.created_at
$$;

-- Internal: remove one family member (used by remove_family_member and account deletion).
create or replace function private.release_family_member(_patient_id uuid)
returns boolean   -- true = kept for hospitals (detached), false = removed
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _held boolean;
begin
  update public.patient_appointments set status = 'cancelled'
   where patient_id = _patient_id and status in ('pending', 'accepted');
  update public.rx_pharmacy_requests set status = 'cancelled'
   where patient_id = _patient_id and status in ('sent', 'available', 'partial');
  delete from public.patient_share_codes where patient_id = _patient_id;
  delete from public.patient_guardians where patient_id = _patient_id;

  _held := exists (select 1 from public.hospital_patients where patient_id = _patient_id);
  if not _held then
    begin
      delete from public.patients where id = _patient_id;
      return false;
    exception when foreign_key_violation then
      _held := true;
    end;
  end if;
  return true;
end;
$$;
revoke all on function private.release_family_member(uuid) from public, anon, authenticated;

create or replace function public.remove_family_member(p_patient_id uuid)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (select 1 from public.patient_guardians
                                       where patient_id = p_patient_id and guardian_user_id = auth.uid()) then
    raise exception 'Family member not found' using errcode = '42501';
  end if;
  return jsonb_build_object('held_by_hospitals', private.release_family_member(p_patient_id));
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Booking and share codes for a family member
--    (new optional p_patient_id; without it, they act for the caller as before)
-- -----------------------------------------------------------------------------
drop function if exists public.book_appointment(uuid, uuid, date, time, boolean, text);
create or replace function public.book_appointment(
  p_hospital_id uuid, p_doctor_id uuid, p_date date, p_time time,
  p_is_telemedicine boolean default false, p_reason text default null,
  p_patient_id uuid default null)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _pid uuid := coalesce(p_patient_id, private.my_patient_id());
  _today date := (now() at time zone 'Africa/Lagos')::date;
  _h public.hospitals;
  _id uuid;
begin
  if _pid is null or auth.uid() is null or not private.is_own_patient(_pid) then
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
revoke all on function public.book_appointment(uuid, uuid, date, time, boolean, text, uuid) from public, anon;
grant execute on function public.book_appointment(uuid, uuid, date, time, boolean, text, uuid) to authenticated;

drop function if exists public.create_patient_share_code();
create or replace function public.create_patient_share_code(p_patient_id uuid default null)
returns table (code text, expires_at timestamptz)
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _pid uuid := coalesce(p_patient_id, private.my_patient_id());
  _alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O, 1/I/L
  _bytes bytea;
  _code text;
  _exp timestamptz := now() + interval '15 minutes';
  _recent int;
begin
  if _pid is null or auth.uid() is null or not private.is_own_patient(_pid) then
    raise exception 'Only patients can create a share code' using errcode = '42501';
  end if;

  select count(*) into _recent from public.function_calls f
   where f.user_id = auth.uid() and f.fn = 'create_patient_share_code' and f.created_at > now() - interval '1 hour';
  if _recent >= 10 then
    raise exception 'Too many codes requested. Please try again later.' using errcode = '54000';
  end if;
  insert into public.function_calls (user_id, fn) values (auth.uid(), 'create_patient_share_code');

  delete from public.patient_share_codes s where s.patient_id = _pid and s.used_at is null;

  loop
    _bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    _code := '';
    for i in 0..5 loop
      _code := _code || substr(_alphabet, (get_byte(_bytes, i) % length(_alphabet)) + 1, 1);
    end loop;
    begin
      insert into public.patient_share_codes (code, patient_id, expires_at) values (_code, _pid, _exp);
      exit;
    exception when unique_violation then
      -- extremely rare collision: try another code
    end;
  end loop;

  return query select _code, _exp;
end;
$$;
revoke all on function public.create_patient_share_code(uuid) from public, anon;
grant execute on function public.create_patient_share_code(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Account deletion also releases the guardian's family members
-- -----------------------------------------------------------------------------
create or replace function public.delete_my_patient_data()
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _pid uuid;
  _held boolean;
  _fam record;
  _fam_count int := 0;
begin
  if _uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from public.doctors where user_id = _uid)
     or exists (select 1 from public.hospital_staff where user_id = _uid)
     or exists (select 1 from public.pharmacy_members where user_id = _uid)
     or exists (select 1 from public.platform_admins where user_id = _uid) then
    raise exception 'Doctor, hospital, pharmacy and admin accounts are closed through HealingNet support';
  end if;

  for _fam in select patient_id from public.patient_guardians where guardian_user_id = _uid loop
    perform private.release_family_member(_fam.patient_id);
    _fam_count := _fam_count + 1;
  end loop;

  select id into _pid from public.patients where user_id = _uid;
  if _pid is null then
    return jsonb_build_object('patient', false, 'held_by_hospitals', false, 'family_members_released', _fam_count);
  end if;

  update public.patient_appointments set status = 'cancelled'
   where patient_id = _pid and status in ('pending', 'accepted');
  update public.rx_pharmacy_requests set status = 'cancelled'
   where patient_id = _pid and status in ('sent', 'available', 'partial');
  delete from public.patient_share_codes where patient_id = _pid;

  _held := exists (select 1 from public.hospital_patients where patient_id = _pid);
  if not _held then
    begin
      delete from public.patients where id = _pid;
      return jsonb_build_object('patient', true, 'held_by_hospitals', false, 'family_members_released', _fam_count);
    exception when foreign_key_violation then
      _held := true;
    end;
  end if;

  update public.patients
     set email = null, phone = null, address = null, emergency_contact_name = null,
         emergency_contact_phone = null, insurance_provider = null, insurance_policy_number = null,
         profile_image_url = null
   where id = _pid;
  return jsonb_build_object('patient', true, 'held_by_hospitals', true, 'family_members_released', _fam_count);
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on function public.add_family_member(text, text, date, text, text, boolean),
                       public.my_family(), public.remove_family_member(uuid)
  from public, anon;
grant execute on function public.add_family_member(text, text, date, text, text, boolean),
                          public.my_family(), public.remove_family_member(uuid)
  to authenticated;
revoke all on function public.delete_my_patient_data() from public, anon;
grant execute on function public.delete_my_patient_data() to authenticated;
