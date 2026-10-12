-- Phase 3c: staff invites, ending calls, appointment call fields.
--
--   1. hospital_staff_invites + invite_staff() + accept_my_staff_invites()
--      (hospital_staff.user_id is NOT NULL, so staff can only be added once they
--      have an account; an invite waits for the person to sign in).
--   2. end_call(): lets a participant mark a call as ended.
--   3. patient_appointments gets call_started_at, call_ended_at, consultation_notes.

-- -----------------------------------------------------------------------------
-- 1. Staff invites
-- -----------------------------------------------------------------------------
create table public.hospital_staff_invites (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text not null default 'receptionist'
    check (role in ('admin', 'receptionist', 'nurse', 'lab_tech', 'pharmacist', 'manager', 'medical_officer')),
  -- Optional: used for the staff record when the person has no name on their account.
  first_name text,
  last_name text,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days')
);

-- One pending invite per hospital and email.
create unique index uq_staff_invites_pending
  on public.hospital_staff_invites (hospital_id, email) where accepted_at is null;
create index idx_staff_invites_email on public.hospital_staff_invites (email) where accepted_at is null;

alter table public.hospital_staff_invites enable row level security;
-- No direct client writes: invite_staff() and accept_my_staff_invites() do them.
revoke all on public.hospital_staff_invites from public, anon, authenticated;
grant select on public.hospital_staff_invites to authenticated;
grant all on public.hospital_staff_invites to service_role;
create policy "Admins read their hospital's invites" on public.hospital_staff_invites
  for select to authenticated
  using (private.is_hospital_admin(hospital_id) or private.is_platform_admin());

-- Admin: invite (or re-invite) someone by email. Returns the invite id.
create or replace function public.invite_staff(_hospital_id uuid, _email text, _role text,
                                               _first_name text default null, _last_name text default null)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _mail text := lower(btrim(coalesce(_email, '')));
  _id uuid;
begin
  if auth.uid() is null or not private.is_hospital_admin(_hospital_id) then
    raise exception 'Only a hospital admin can invite staff' using errcode = '42501';
  end if;
  if _mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address';
  end if;
  if _role is null or _role not in ('admin', 'receptionist', 'nurse', 'lab_tech', 'pharmacist', 'manager', 'medical_officer') then
    raise exception 'Choose a valid role';
  end if;

  insert into public.hospital_staff_invites (hospital_id, email, role, first_name, last_name, invited_by)
  values (_hospital_id, _mail, _role, nullif(btrim(_first_name), ''), nullif(btrim(_last_name), ''), auth.uid())
  on conflict (hospital_id, email) where accepted_at is null
  do update set role = excluded.role,
                first_name = coalesce(excluded.first_name, public.hospital_staff_invites.first_name),
                last_name = coalesce(excluded.last_name, public.hospital_staff_invites.last_name),
                invited_by = excluded.invited_by,
                expires_at = now() + interval '14 days'
  returning id into _id;
  return _id;
end;
$$;

-- Signed-in user: turn every unexpired pending invite for their (confirmed) email
-- into a hospital_staff row. Returns the hospital ids joined.
create or replace function public.accept_my_staff_invites()
returns uuid[]
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _mail text;
  _meta jsonb;
  _joined uuid[] := '{}';
  _inv record;
begin
  if _uid is null then
    return _joined;
  end if;
  -- Only a confirmed email counts, so nobody can claim an invite by signing up
  -- with someone else's address.
  select lower(u.email), u.raw_user_meta_data into _mail, _meta
    from auth.users u
   where u.id = _uid and u.email_confirmed_at is not null;
  if _mail is null then
    return _joined;
  end if;

  for _inv in
    select * from public.hospital_staff_invites
     where email = _mail and accepted_at is null and expires_at > now()
     order by created_at
     for update
  loop
    insert into public.hospital_staff (user_id, hospital_id, first_name, last_name, email, role, is_active)
    values (_uid, _inv.hospital_id,
            coalesce(_inv.first_name, nullif(btrim(_meta->>'first_name'), ''), split_part(_mail, '@', 1)),
            coalesce(_inv.last_name, nullif(btrim(_meta->>'last_name'), ''), ''),
            _mail, _inv.role, true)
    on conflict (user_id, hospital_id)
    do update set role = excluded.role, is_active = true;

    update public.hospital_staff_invites set accepted_at = now() where id = _inv.id;
    _joined := _joined || _inv.hospital_id;
  end loop;
  return _joined;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Appointment call fields (before end_call, which uses them)
-- -----------------------------------------------------------------------------
alter table public.patient_appointments
  add column call_started_at timestamptz,
  add column call_ended_at timestamptz,
  add column consultation_notes text;

-- The doctor / staff write the completion summary; call timestamps are written
-- only by daily-room and end_call (trusted callers).
grant update (consultation_notes) on public.patient_appointments to authenticated;

create or replace function private.guard_patient_appointments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted() then
    return new;
  end if;
  if new.patient_id is distinct from old.patient_id
     or new.hospital_id is distinct from old.hospital_id
     or new.daily_room_name is distinct from old.daily_room_name
     or new.meeting_link is distinct from old.meeting_link
     or new.call_started_at is distinct from old.call_started_at
     or new.call_ended_at is distinct from old.call_ended_at then
    raise exception 'This appointment field cannot be changed' using errcode = '42501';
  end if;
  if new.doctor_id is distinct from old.doctor_id and new.doctor_id is not null
     and not private.doctor_is_active_at(new.doctor_id, new.hospital_id) then
    raise exception 'That doctor does not practise at this hospital' using errcode = '42501';
  end if;
  if new.is_telemedicine and not old.is_telemedicine
     and not private.hospital_has_plan(new.hospital_id, 'telemedicine') then
    raise exception 'This hospital does not have the telemedicine plan' using errcode = '42501';
  end if;
  if private.is_own_patient(old.patient_id)
     and not private.is_hospital_staff(old.hospital_id)
     and old.doctor_id is distinct from private.my_doctor_id() then
    if new.doctor_id is distinct from old.doctor_id
       or new.is_telemedicine is distinct from old.is_telemedicine
       or new.notes is distinct from old.notes
       or new.consultation_notes is distinct from old.consultation_notes
       or (new.status is distinct from old.status and new.status <> 'cancelled') then
      raise exception 'Patients can only reschedule or cancel an appointment' using errcode = '42501';
    end if;
    if old.status not in ('pending', 'accepted') then
      raise exception 'This appointment can no longer be changed' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Ending calls
-- -----------------------------------------------------------------------------
-- A participant (the doctor, the patient, or staff of the hospital on the record)
-- marks the call as ended. Only sets call_ended_at when the call has started and
-- has not already ended. Returns true if it changed anything.
create or replace function public.end_call(_kind text, _id uuid)
returns boolean
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _a public.patient_appointments;
  _r public.consultation_requests;
  _changed int;
begin
  if auth.uid() is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  if _kind = 'appointment' then
    select * into _a from public.patient_appointments where id = _id;
    if not found
       or not (coalesce(_a.doctor_id = private.my_doctor_id(), false)
               or private.is_own_patient(_a.patient_id)
               or private.is_hospital_staff(_a.hospital_id)) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    update public.patient_appointments
       set call_ended_at = now()
     where id = _id and call_started_at is not null and call_ended_at is null;
  elsif _kind = 'consultation_request' then
    select * into _r from public.consultation_requests where id = _id;
    if not found
       or not (coalesce(_r.doctor_id = private.my_doctor_id(), false)
               or private.is_own_patient(_r.patient_id)
               or private.is_hospital_staff(_r.requesting_hospital_id)) then
      raise exception 'Not allowed' using errcode = '42501';
    end if;
    update public.consultation_requests
       set call_ended_at = now()
     where id = _id and call_started_at is not null and call_ended_at is null;
  else
    raise exception 'Invalid call type';
  end if;

  get diagnostics _changed = row_count;
  return _changed > 0;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on function public.invite_staff(uuid, text, text, text, text) from public, anon;
revoke all on function public.accept_my_staff_invites() from public, anon;
revoke all on function public.end_call(text, uuid) from public, anon;
grant execute on function public.invite_staff(uuid, text, text, text, text) to authenticated;
grant execute on function public.accept_my_staff_invites() to authenticated;
grant execute on function public.end_call(text, uuid) to authenticated;
