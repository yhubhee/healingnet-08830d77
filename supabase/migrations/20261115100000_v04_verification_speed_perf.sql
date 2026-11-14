-- =============================================================================
-- Patient app 0.4
--   1. Complete profile, enforced by the database: a patient account whose
--      required profile fields are empty cannot book or add family members.
--   2. Family verification: the guardian uploads a legal document (birth
--      certificate, marriage certificate, court order, sworn affidavit...) for
--      each family member; a HealingNet admin approves or rejects it.
--      A new member can be used for 3 days without a document. After that,
--      or after a rejection, the member is locked until a document is sent;
--      a first submission keeps them open while it waits for review.
--   3. Faster screens: one call each for Visits, prescriptions and the Home
--      "Your health" cards, instead of many round trips.
--   4. Performance tracking: the app and website send timings of slow screens
--      and requests (no user id, no health data); admins see a summary.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Complete profile
-- -----------------------------------------------------------------------------
-- Same list as src/lib/patientProfile.ts and mobile/shared/patientProfile.ts.
-- Family members (no login of their own) need only date of birth and sex.
create or replace function private.patient_missing_fields(_patient_id uuid)
returns text[]
language sql stable security definer
set search_path = ''
as $$
  select case
    when p.id is null then array['profile']
    when p.user_id is null then array_remove(array[
      case when p.date_of_birth is null then 'date_of_birth' end,
      case when coalesce(btrim(p.gender), '') = '' then 'gender' end], null)
    else array_remove(array[
      case when coalesce(btrim(p.phone), '') = '' then 'phone' end,
      case when p.date_of_birth is null then 'date_of_birth' end,
      case when coalesce(btrim(p.gender), '') = '' then 'gender' end,
      case when coalesce(btrim(p.state), '') = '' then 'state' end,
      case when coalesce(btrim(p.city), '') = '' then 'city' end,
      case when coalesce(btrim(p.address), '') = '' then 'address' end,
      case when coalesce(btrim(p.emergency_contact_name), '') = '' then 'emergency_contact_name' end,
      case when coalesce(btrim(p.emergency_contact_phone), '') = '' then 'emergency_contact_phone' end], null)
  end
  from (select 1) one left join public.patients p on p.id = _patient_id
$$;
revoke all on function private.patient_missing_fields(uuid) from public, anon, authenticated;

create or replace function private.missing_fields_text(_fields text[])
returns text language sql immutable set search_path = '' as $$
  select string_agg(case f
    when 'phone' then 'phone number' when 'date_of_birth' then 'date of birth'
    when 'emergency_contact_name' then 'emergency contact name'
    when 'emergency_contact_phone' then 'emergency contact phone'
    else replace(f, '_', ' ') end, ', ')
  from unnest(_fields) f
$$;
revoke all on function private.missing_fields_text(text[]) from public, anon, authenticated;

-- For the app and website: is my own profile complete, and what is missing?
create or replace function public.my_profile_status()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _pid uuid := private.my_patient_id();
  _missing text[];
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if _pid is null then return jsonb_build_object('is_patient', false, 'complete', false, 'missing', '[]'::jsonb); end if;
  _missing := private.patient_missing_fields(_pid);
  return jsonb_build_object('is_patient', true, 'complete', cardinality(_missing) = 0, 'missing', to_jsonb(_missing));
end;
$$;
revoke all on function public.my_profile_status() from public, anon;
grant execute on function public.my_profile_status() to authenticated;

-- A patient booking for themself or a family member must have completed their own
-- profile. Hospital staff booking for a patient are not affected.
create or replace function private.require_complete_profile_to_book()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  _me uuid;
  _missing text[];
begin
  if auth.uid() is null or auth.uid() is distinct from public.patient_user_id(new.patient_id) then
    return new;
  end if;
  _me := private.my_patient_id();
  _missing := private.patient_missing_fields(_me);
  if cardinality(_missing) > 0 then
    raise exception 'Complete your profile before booking. Missing: %', private.missing_fields_text(_missing)
      using errcode = 'P0001', hint = 'profile_incomplete';
  end if;
  return new;
end;
$$;
create trigger trg_require_complete_profile_to_book before insert on public.patient_appointments
  for each row execute function private.require_complete_profile_to_book();

create or replace function private.require_complete_profile_for_family()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  _missing text[];
begin
  if auth.uid() is null or auth.uid() is distinct from new.guardian_user_id then return new; end if;
  _missing := private.patient_missing_fields(private.my_patient_id());
  if cardinality(_missing) > 0 then
    raise exception 'Complete your own profile before adding family members. Missing: %', private.missing_fields_text(_missing)
      using errcode = 'P0001', hint = 'profile_incomplete';
  end if;
  return new;
end;
$$;
create trigger trg_require_complete_profile_for_family before insert on public.patient_guardians
  for each row execute function private.require_complete_profile_for_family();

-- -----------------------------------------------------------------------------
-- 2. Family verification
-- -----------------------------------------------------------------------------
alter table public.patient_guardians
  add column if not exists verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  -- Members added before this change also get 3 days from now.
  add column if not exists verification_due_at timestamptz not null default (now() + interval '3 days'),
  add column if not exists verified_at timestamptz,
  add column if not exists rejection_count int not null default 0;
grant select (verification_status, verification_due_at, verified_at, rejection_count) on public.patient_guardians to authenticated;

-- Which documents prove which relationship.
create or replace function private.family_document_allowed(_relationship text, _type text)
returns boolean language sql immutable set search_path = '' as $$
  select case _type
    when 'birth_certificate'     then _relationship in ('child', 'parent', 'sibling', 'grandchild', 'grandparent')
    when 'marriage_certificate'  then _relationship = 'spouse'
    when 'adoption_order'        then _relationship in ('child', 'grandchild')
    when 'guardianship_order'    then _relationship in ('child', 'grandchild', 'sibling', 'other')
    when 'sworn_affidavit'       then true
    else false end
$$;
revoke all on function private.family_document_allowed(text, text) from public, anon, authenticated;

-- May the guardian use this member's record right now?
create or replace function private.guardian_access_ok(_status text, _due timestamptz, _rejections int)
returns boolean language sql stable set search_path = '' as $$
  select _status = 'verified'
      or (_status in ('unverified', 'pending') and now() < _due)
      or (_status = 'pending' and coalesce(_rejections, 0) = 0)
$$;
revoke all on function private.guardian_access_ok(text, timestamptz, int) from public, anon, authenticated;

create or replace function private.is_own_patient(_patient_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.patients where id = _patient_id and user_id = auth.uid())
      or exists (select 1 from public.patient_guardians g
                  where g.patient_id = _patient_id and g.guardian_user_id = auth.uid()
                    and private.guardian_access_ok(g.verification_status, g.verification_due_at, g.rejection_count))
$$;

-- A locked member's notifications are not delivered to the guardian.
create or replace function public.patient_user_id(_patient_id uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select user_id from public.patients where id = _patient_id),
    (select g.guardian_user_id from public.patient_guardians g
      where g.patient_id = _patient_id
        and private.guardian_access_ok(g.verification_status, g.verification_due_at, g.rejection_count)))
$$;

create table public.family_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  guardian_user_id uuid not null references auth.users(id) on delete cascade,
  relationship text not null,
  document_type text not null check (document_type in
    ('birth_certificate', 'marriage_certificate', 'adoption_order', 'guardianship_order', 'sworn_affidavit')),
  storage_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  reject_reason text check (reject_reason is null or length(reject_reason) <= 300),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);
create index idx_family_documents_queue on public.family_documents (status, submitted_at);
create index idx_family_documents_patient on public.family_documents (patient_id);
alter table public.family_documents enable row level security;
grant all on public.family_documents to service_role;
grant select on public.family_documents to authenticated;
create policy "Guardian and platform admins" on public.family_documents
  for select to authenticated
  using (guardian_user_id = auth.uid() or private.is_platform_admin());

-- Private bucket: <guardian user id>/<member patient id>/<file>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('family-documents', 'family-documents', false, 5242880,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "Guardians upload family documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'family-documents'
              and (storage.foldername(name))[1] = auth.uid()::text
              and exists (select 1 from public.patient_guardians g
                           where g.guardian_user_id = auth.uid()
                             and g.patient_id::text = (storage.foldername(name))[2]));
create policy "Guardians and admins read family documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'family-documents'
         and ((storage.foldername(name))[1] = auth.uid()::text or private.is_platform_admin()));
-- A file can be deleted by its guardian unless it is under review or approved.
create policy "Guardians delete unused family documents" on storage.objects
  for delete to authenticated
  using (bucket_id = 'family-documents'
         and (storage.foldername(name))[1] = auth.uid()::text
         and not exists (select 1 from public.family_documents d
                          where d.storage_path = name and d.status in ('pending', 'approved')));

-- The guardian submits an uploaded file for review.
create or replace function public.submit_family_document(p_patient_id uuid, p_document_type text, p_storage_path text)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _g public.patient_guardians;
  _id uuid;
begin
  select * into _g from public.patient_guardians where patient_id = p_patient_id and guardian_user_id = auth.uid();
  if auth.uid() is null or _g.id is null then
    raise exception 'Family member not found' using errcode = '42501';
  end if;
  if _g.verification_status = 'verified' then
    raise exception 'This family member is already verified';
  end if;
  if not private.family_document_allowed(_g.relationship, p_document_type) then
    raise exception 'That document does not prove this relationship. Choose another document type.';
  end if;
  if p_storage_path is null or p_storage_path not like auth.uid()::text || '/' || p_patient_id::text || '/%'
     or p_storage_path like '%..%' then
    raise exception 'Upload the document again' using errcode = '42501';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'family-documents' and name = p_storage_path) then
    raise exception 'Upload the document again';
  end if;
  if (select count(*) from public.family_documents where patient_id = p_patient_id and status = 'pending') >= 3 then
    raise exception 'Up to 3 documents can wait for review at a time';
  end if;
  if (select count(*) from public.family_documents where patient_id = p_patient_id) >= 10 then
    raise exception 'Too many documents for this family member. Contact HealingNet support.';
  end if;

  insert into public.family_documents (patient_id, guardian_user_id, relationship, document_type, storage_path)
  values (p_patient_id, auth.uid(), _g.relationship, p_document_type, p_storage_path)
  returning id into _id;
  update public.patient_guardians set verification_status = 'pending' where id = _g.id;
  return _id;
end;
$$;
revoke all on function public.submit_family_document(uuid, text, text) from public, anon;
grant execute on function public.submit_family_document(uuid, text, text) to authenticated;

-- my_family() gains the verification state (return type changes, so drop first).
drop function if exists public.my_family();
create function public.my_family()
returns table (patient_id uuid, first_name text, last_name text, date_of_birth date, gender text,
               relationship text, age int, is_adult boolean, linked_hospitals bigint, added_at timestamptz,
               verification_status text, verification_due_at timestamptz, access_ok boolean, last_reject_reason text)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.first_name, p.last_name, p.date_of_birth, p.gender, g.relationship,
         date_part('year', age((now() at time zone 'Africa/Lagos')::date, p.date_of_birth))::int,
         date_part('year', age((now() at time zone 'Africa/Lagos')::date, p.date_of_birth))::int >= 18,
         (select count(*) from public.hospital_patients hp where hp.patient_id = p.id),
         g.created_at,
         g.verification_status, g.verification_due_at,
         private.guardian_access_ok(g.verification_status, g.verification_due_at, g.rejection_count),
         (select d.reject_reason from public.family_documents d
           where d.patient_id = p.id and d.status = 'rejected' order by d.reviewed_at desc limit 1)
    from public.patient_guardians g join public.patients p on p.id = g.patient_id
   where g.guardian_user_id = auth.uid()
   order by g.created_at
$$;
revoke all on function public.my_family() from public, anon;
grant execute on function public.my_family() to authenticated;

-- Admin: the review queue.
create or replace function public.admin_family_documents(p_status text default 'pending', p_limit int default 50, p_offset int default 0)
returns table (id uuid, patient_id uuid, member_first_name text, member_last_name text, member_date_of_birth date,
               member_gender text, relationship text, document_type text, storage_path text, status text,
               reject_reason text, submitted_at timestamptz, reviewed_at timestamptz,
               guardian_user_id uuid, guardian_first_name text, guardian_last_name text, guardian_email text,
               guardian_phone text, previous_rejections int, total_count bigint)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return query
  select d.id, d.patient_id, m.first_name, m.last_name, m.date_of_birth, m.gender, d.relationship, d.document_type,
         d.storage_path, d.status, d.reject_reason, d.submitted_at, d.reviewed_at,
         d.guardian_user_id, gp.first_name, gp.last_name, coalesce(gp.email, u.email::text), gp.phone,
         coalesce(g.rejection_count, 0), count(*) over ()
    from public.family_documents d
    join public.patients m on m.id = d.patient_id
    left join public.patient_guardians g on g.patient_id = d.patient_id and g.guardian_user_id = d.guardian_user_id
    left join public.patients gp on gp.user_id = d.guardian_user_id
    left join auth.users u on u.id = d.guardian_user_id
   where p_status is null or d.status = p_status
   order by case when d.status = 'pending' then d.submitted_at end asc nulls last, d.reviewed_at desc nulls last
   limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- Admin: approve or reject one document.
create or replace function public.admin_review_family_document(p_document_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _d public.family_documents;
  _name text;
  _reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform private.require_platform_admin();
  select * into _d from public.family_documents where id = p_document_id for update;
  if _d.id is null then raise exception 'Document not found'; end if;
  if _d.status <> 'pending' then raise exception 'This document has already been reviewed'; end if;
  if not exists (select 1 from public.patient_guardians where patient_id = _d.patient_id and guardian_user_id = _d.guardian_user_id) then
    update public.family_documents set status = 'withdrawn', reviewed_at = now(), reviewed_by = auth.uid() where id = _d.id;
    raise exception 'This family member has been removed; the document was withdrawn';
  end if;
  select coalesce(nullif(btrim(first_name), ''), 'Your family member') into _name from public.patients where id = _d.patient_id;

  if p_approve then
    update public.family_documents set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid() where id = _d.id;
    -- Other documents still waiting for the same member are no longer needed.
    update public.family_documents set status = 'withdrawn', reviewed_at = now(), reviewed_by = auth.uid()
     where patient_id = _d.patient_id and status = 'pending' and id <> _d.id;
    update public.patient_guardians set verification_status = 'verified', verified_at = now()
     where patient_id = _d.patient_id;
    perform private.admin_log('family_document_approved', 'family_document', _d.id, jsonb_build_object('patient_id', _d.patient_id));
    perform public.emit_user_notification(_d.guardian_user_id, 'patient', 'family', 'Family member verified',
      _name || '''s document was approved. You can keep managing their care on HealingNet.',
      _d.id, 'family_document', '/patient/settings/family');
  else
    if _reason is null or length(_reason) < 5 then raise exception 'Give a reason the guardian can act on'; end if;
    update public.family_documents set status = 'rejected', reject_reason = left(_reason, 300), reviewed_at = now(), reviewed_by = auth.uid()
     where id = _d.id;
    -- Locked only when nothing else is waiting for review.
    if not exists (select 1 from public.family_documents where patient_id = _d.patient_id and status = 'pending') then
      update public.patient_guardians set verification_status = 'rejected', rejection_count = rejection_count + 1
       where patient_id = _d.patient_id;
    else
      update public.patient_guardians set rejection_count = rejection_count + 1 where patient_id = _d.patient_id;
    end if;
    perform private.admin_log('family_document_rejected', 'family_document', _d.id,
      jsonb_build_object('patient_id', _d.patient_id, 'reason', left(_reason, 300)));
    perform public.emit_user_notification(_d.guardian_user_id, 'patient', 'family', 'Document not accepted',
      'We could not accept the document for ' || _name || ': ' || left(_reason, 300) || ' Please upload another document.',
      _d.id, 'family_document', '/patient/settings/family');
  end if;
end;
$$;
revoke all on function public.admin_family_documents(text, int, int), public.admin_review_family_document(uuid, boolean, text) from public, anon;
grant execute on function public.admin_family_documents(text, int, int), public.admin_review_family_document(uuid, boolean, text) to authenticated;

-- Removing a family member withdraws documents still waiting for review.
create or replace function private.withdraw_family_documents()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.family_documents set status = 'withdrawn', reviewed_at = now()
   where patient_id = old.patient_id and status = 'pending';
  return old;
end;
$$;
create trigger trg_withdraw_family_documents after delete on public.patient_guardians
  for each row execute function private.withdraw_family_documents();

-- Notifications about a family document name the member, like the others.
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
    when 'family_document' then (select patient_id from public.family_documents where id = new.reference_id)
    else null end;
  if _pid is null then return new; end if;
  new.subject_patient_id := _pid;
  select * into _p from public.patients where id = _pid;
  -- The family-document messages already name the member in the text.
  if _p.user_id is distinct from new.user_id and new.reference_type <> 'family_document' then
    new.title := left(coalesce(nullif(btrim(_p.first_name), ''), 'Family member') || ': ' || new.title, 200);
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. One call per screen
-- -----------------------------------------------------------------------------
create or replace function private.visit_json(_a public.patient_appointments)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', _a.id, 'patient_id', _a.patient_id, 'doctor_id', _a.doctor_id, 'hospital_id', _a.hospital_id,
    'requested_date', _a.requested_date, 'requested_time', _a.requested_time, 'status', _a.status,
    'reason', _a.reason, 'is_telemedicine', _a.is_telemedicine, 'decline_reason', _a.decline_reason,
    'created_at', _a.created_at, 'updated_at', _a.updated_at,
    'call_started_at', _a.call_started_at, 'call_ended_at', _a.call_ended_at,
    'doctors', (select jsonb_build_object('id', d.id, 'first_name', d.first_name, 'last_name', d.last_name, 'specialty', d.specialty)
                  from public.doctors d where d.id = _a.doctor_id),
    'hospitals', (select jsonb_build_object('id', h.id, 'name', h.name) from public.hospitals h where h.id = _a.hospital_id),
    'review', (select jsonb_build_object('rating', r.rating, 'comment', r.comment)
                 from public.appointment_reviews r where r.appointment_id = _a.id))
$$;
revoke all on function private.visit_json(public.patient_appointments) from public, anon, authenticated;

-- Visits: every open visit (pending, accepted, confirmed) and the most recent past ones.
-- Older past visits page in with p_past_offset.
create or replace function public.my_visits(p_patient_id uuid default null, p_past_limit int default 30, p_past_offset int default 0)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _pid uuid := coalesce(p_patient_id, private.my_patient_id());
  _lim int := least(greatest(coalesce(p_past_limit, 30), 1), 100);
  _off int := greatest(coalesce(p_past_offset, 0), 0);
  _upcoming jsonb;
  _past jsonb;
  _more boolean;
begin
  if auth.uid() is null or _pid is null or not private.is_own_patient(_pid) then
    raise exception 'Patient not found' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(private.visit_json(a) order by a.requested_date, a.requested_time), '[]'::jsonb) into _upcoming
    from public.patient_appointments a
   where a.patient_id = _pid and a.status in ('pending', 'accepted', 'confirmed') and _off = 0;
  select coalesce(jsonb_agg(private.visit_json(x) order by x.requested_date desc, x.requested_time desc nulls last), '[]'::jsonb) into _past
    from (select a.* from public.patient_appointments a
           where a.patient_id = _pid and a.status not in ('pending', 'accepted', 'confirmed')
           order by a.requested_date desc, a.requested_time desc nulls last, a.id
           limit _lim offset _off) x;
  _more := exists (select 1 from public.patient_appointments a
                    where a.patient_id = _pid and a.status not in ('pending', 'accepted', 'confirmed')
                    offset _off + _lim);
  return jsonb_build_object('upcoming', _upcoming, 'past', _past, 'has_more_past', _more);
end;
$$;
revoke all on function public.my_visits(uuid, int, int) from public, anon;
grant execute on function public.my_visits(uuid, int, int) to authenticated;

-- Prescriptions: all of a person's prescription documents in one call (instead of one
-- call per document). The signature image is left out of the list; the detail screen
-- gets it from rx_document(id) when the QR page is opened.
create or replace function public.my_rx_documents(p_patient_id uuid default null, p_limit int default 40)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _pid uuid := coalesce(p_patient_id, private.my_patient_id());
begin
  if auth.uid() is null or _pid is null or not private.is_own_patient(_pid) then
    raise exception 'Patient not found' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(private.rx_payload(d.id, true) - 'signature_data' order by d.issued_at desc)
      from (select id, issued_at from public.rx_documents where patient_id = _pid
             order by issued_at desc limit least(greatest(coalesce(p_limit, 40), 1), 100)) d), '[]'::jsonb);
end;
$$;
revoke all on function public.my_rx_documents(uuid, int) from public, anon;
grant execute on function public.my_rx_documents(uuid, int) to authenticated;

-- Home "Your health": prescriptions, lab results, records and letters at a glance.
create or replace function public.patient_health_overview(p_patient_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _pid uuid := coalesce(p_patient_id, private.my_patient_id());
  _rx jsonb;
begin
  if auth.uid() is null or _pid is null or not private.is_own_patient(_pid) then
    raise exception 'Patient not found' using errcode = '42501';
  end if;

  select jsonb_build_object(
      'active', count(*) filter (where x.p->>'status' = 'valid'),
      'total', count(*),
      'latest', (array_agg(jsonb_build_object(
          'document_id', x.id, 'issued_at', x.issued_at, 'status', x.p->>'status',
          'hospital_name', x.p->>'hospital_name',
          'medicines', (select coalesce(jsonb_agg(i->>'drug_name'), '[]'::jsonb)
                          from (select i from jsonb_array_elements(x.p->'items') i limit 3) s))
        order by x.issued_at desc))[1])
    into _rx
    from (select d.id, d.issued_at, private.rx_payload(d.id, true) p
            from public.rx_documents d where d.patient_id = _pid order by d.issued_at desc limit 40) x;

  return jsonb_build_object(
    'prescriptions', _rx,
    'labs', (select jsonb_build_object(
        'new', count(*) filter (where l.status in ('completed', 'final') and l.patient_viewed_at is null),
        'in_progress', count(*) filter (where l.status not in ('completed', 'final', 'cancelled')),
        'total', count(*),
        'latest', (select jsonb_build_object('id', l2.id, 'status', l2.status, 'created_at', l2.created_at,
                     'is_new', l2.status in ('completed', 'final') and l2.patient_viewed_at is null,
                     'tests', (select coalesce(jsonb_agg(t.test_name), '[]'::jsonb)
                                 from (select test_name from public.lab_result_tests where lab_result_id = l2.id order by created_at limit 3) t),
                     'hospital_name', (select name from public.hospitals where id = l2.hospital_id))
                     from public.lab_results l2 where l2.patient_id = _pid order by l2.updated_at desc limit 1))
      from public.lab_results l where l.patient_id = _pid),
    'records', (select jsonb_build_object(
        'total', count(*),
        'latest', (select jsonb_build_object('id', e2.id, 'title', e2.title, 'entry_type', e2.entry_type, 'created_at', e2.created_at,
                     'doctor_name', (select 'Dr ' || btrim(first_name || ' ' || last_name) from public.doctors where id = e2.doctor_id),
                     'hospital_name', (select name from public.hospitals where id = e2.hospital_id))
                     from public.emr_entries e2 where e2.patient_id = _pid and not coalesce(e2.is_confidential, false)
                     order by e2.created_at desc limit 1))
      from public.emr_entries e where e.patient_id = _pid and not coalesce(e.is_confidential, false)),
    'letters', (select jsonb_build_object(
        'total', count(*),
        'latest', (select jsonb_build_object('id', t2.id, 'title', t2.title, 'letter_type', t2.letter_type, 'issued_at', t2.issued_at)
                     from public.patient_letters t2 where t2.patient_id = _pid order by t2.created_at desc limit 1))
      from public.patient_letters t where t.patient_id = _pid));
end;
$$;
revoke all on function public.patient_health_overview(uuid) from public, anon;
grant execute on function public.patient_health_overview(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Performance tracking
-- -----------------------------------------------------------------------------
-- No user id, no record ids, no health data: only what was slow, where and how slow.
create table public.perf_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null,
  received_at timestamptz not null default now(),
  platform text not null check (platform in ('android', 'ios', 'web')),
  app_version text check (app_version is null or length(app_version) <= 20),
  kind text not null check (kind in ('screen', 'request', 'startup')),
  name text not null check (length(name) between 1 and 100),
  duration_ms int not null check (duration_ms between 0 and 120000),
  ok boolean not null default true,
  http_status int check (http_status is null or http_status between 0 and 599),
  network text check (network is null or network in ('wifi', 'cellular', 'offline', 'other', 'unknown'))
);
create index idx_perf_events_name on public.perf_events (kind, name, occurred_at);
create index idx_perf_events_time on public.perf_events (occurred_at);
alter table public.perf_events enable row level security;
grant all on public.perf_events to service_role;
-- No grants to anon/authenticated: written only by log_perf_events, read only by the admin RPCs.

create table private.perf_quota (
  user_id uuid primary key,
  window_start timestamptz not null,
  used int not null
);

-- Route and endpoint names, with ids taken out: "/lab-results/<uuid>" -> "/lab-results/:id".
create or replace function private.perf_name(_raw text)
returns text language sql immutable set search_path = '' as $$
  select case when n ~ '^[a-z0-9_:/.\-\[\]()]{1,100}$' then n end
  from (select regexp_replace(regexp_replace(regexp_replace(lower(split_part(split_part(coalesce(_raw, ''), '?', 1), '#', 1)),
          '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', ':id', 'g'),
          '[0-9]{4,}', ':n', 'g'),
          'hn-[a-z0-9]{5}-[a-z0-9]{5}', ':code', 'g') as n) s
$$;
revoke all on function private.perf_name(text) from public, anon, authenticated;

-- Batched: the app sends up to 50 timings at a time. Invalid entries are skipped;
-- returns how many were kept. At most 600 per user per hour.
create or replace function public.log_perf_events(p_events jsonb)
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _q private.perf_quota;
  _room int;
  _n int;
begin
  if _uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if jsonb_typeof(p_events) is distinct from 'array' then raise exception 'Expected a list of events'; end if;
  if jsonb_array_length(p_events) > 50 then raise exception 'At most 50 events at a time'; end if;

  insert into private.perf_quota as q (user_id, window_start, used) values (_uid, now(), 0)
  on conflict (user_id) do update set window_start = case when q.window_start < now() - interval '1 hour' then now() else q.window_start end,
                                      used = case when q.window_start < now() - interval '1 hour' then 0 else q.used end
  returning * into _q;
  _room := greatest(600 - _q.used, 0);
  if _room = 0 then return 0; end if;

  with raw as (
    select e, ord from jsonb_array_elements(p_events) with ordinality as t(e, ord)
  ), clean as (
    select
      case when (e->>'occurred_at') ~ '^\d{4}-\d{2}-\d{2}T' then (e->>'occurred_at')::timestamptz end as at,
      e->>'platform' as platform,
      left(e->>'app_version', 20) as app_version,
      e->>'kind' as kind,
      private.perf_name(e->>'name') as name,
      case when (e->>'duration_ms') ~ '^\d{1,6}(\.\d+)?$' then round((e->>'duration_ms')::numeric)::int end as dur,
      coalesce(case when jsonb_typeof(e->'ok') = 'boolean' then (e->>'ok')::boolean end, true) as ok,
      case when (e->>'http_status') ~ '^\d{1,3}$' then (e->>'http_status')::int end as http_status,
      case when e->>'network' in ('wifi', 'cellular', 'offline', 'other', 'unknown') then e->>'network' end as network,
      ord
    from raw where jsonb_typeof(e) = 'object'
  ), ins as (
    insert into public.perf_events (occurred_at, platform, app_version, kind, name, duration_ms, ok, http_status, network)
    select case when at between now() - interval '7 days' and now() + interval '5 minutes' then at else now() end,
           platform, app_version, kind, name, dur, ok, http_status, network
      from clean
     where platform in ('android', 'ios', 'web') and kind in ('screen', 'request', 'startup')
       and name is not null and dur between 0 and 120000
       and (app_version is null or app_version ~ '^[0-9A-Za-z.\-+]{1,20}$')
     order by ord
     limit _room
    returning 1
  )
  select count(*) into _n from ins;

  update private.perf_quota set used = used + _n where user_id = _uid;

  -- Keep 30 days: tidy a little now and then.
  if random() < 0.02 then
    delete from public.perf_events where id in (
      select id from public.perf_events where received_at < now() - interval '30 days' limit 5000);
  end if;
  return _n;
end;
$$;
revoke all on function public.log_perf_events(jsonb) from public, anon;
grant execute on function public.log_perf_events(jsonb) to authenticated;

-- Admin: the slowest screens and requests. "Slow" is over 1 s for a request,
-- 500 ms for a screen and 3 s for app start.
create or replace function private.perf_slow_ms(_kind text)
returns int language sql immutable set search_path = '' as $$
  select case _kind when 'request' then 1000 when 'screen' then 500 else 3000 end
$$;
revoke all on function private.perf_slow_ms(text) from public, anon, authenticated;

create or replace function public.admin_perf_summary(p_days int default 7, p_platform text default null,
                                                     p_kind text default null, p_min_samples int default 5)
returns table (kind text, name text, samples bigint, p50_ms int, p90_ms int, max_ms int,
               slow_ms int, slow_share numeric, error_share numeric, last_seen timestamptz, versions text[])
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return query
  select e.kind, e.name, count(*),
         (percentile_cont(0.5) within group (order by e.duration_ms))::int,
         (percentile_cont(0.9) within group (order by e.duration_ms))::int,
         max(e.duration_ms),
         private.perf_slow_ms(e.kind),
         round(avg((e.duration_ms > private.perf_slow_ms(e.kind))::int)::numeric, 3),
         round(avg((not e.ok)::int)::numeric, 3),
         max(e.occurred_at),
         (array_agg(distinct e.app_version) filter (where e.app_version is not null))[1:5]
    from public.perf_events e
   where e.occurred_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30))
     and (p_platform is null or e.platform = p_platform)
     and (p_kind is null or e.kind = p_kind)
   group by e.kind, e.name
  having count(*) >= greatest(coalesce(p_min_samples, 5), 1)
   order by 5 desc
   limit 200;
end;
$$;

-- Admin: one screen or request day by day, per app version (did a release help?).
create or replace function public.admin_perf_trend(p_kind text, p_name text, p_days int default 14)
returns table (day date, app_version text, platform text, samples bigint, p50_ms int, p90_ms int)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  perform private.require_platform_admin();
  return query
  select (e.occurred_at at time zone 'Africa/Lagos')::date, e.app_version, e.platform, count(*),
         (percentile_cont(0.5) within group (order by e.duration_ms))::int,
         (percentile_cont(0.9) within group (order by e.duration_ms))::int
    from public.perf_events e
   where e.kind = p_kind and e.name = p_name
     and e.occurred_at > now() - make_interval(days => least(greatest(coalesce(p_days, 14), 1), 30))
   group by 1, 2, 3
   order by 1, 2, 3;
end;
$$;
revoke all on function public.admin_perf_summary(int, text, text, int), public.admin_perf_trend(text, text, int) from public, anon;
grant execute on function public.admin_perf_summary(int, text, text, int), public.admin_perf_trend(text, text, int) to authenticated;
