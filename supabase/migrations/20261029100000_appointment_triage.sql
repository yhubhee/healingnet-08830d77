-- =============================================================================
-- Appointment requests: who accepts them
--
-- Problem: a patient who books "Any available doctor" creates a pending appointment
-- with no doctor. Doctors only saw appointments assigned to them, and the hospital had
-- no screen to accept or assign, so nobody could act on it.
--
-- Industry-standard flow (front desk + doctor):
--   * Hospital staff see every request for their hospital and can assign a doctor,
--     accept, or decline with a reason.
--   * Doctors see unassigned ("open") requests at hospitals where they are active and
--     can take one, which assigns it to them and accepts it.
--   * The assigned doctor can accept or decline their own pending requests.
-- All changes go through these functions, which check the rules in one place.
-- =============================================================================

alter table public.patient_appointments
  add column if not exists decline_reason text,
  add column if not exists decided_at timestamptz,
  add column if not exists decided_by uuid references auth.users(id) on delete set null;

-- Readable by everyone who can already read the row (column grants are explicit).
grant select (decline_reason, decided_at, decided_by) on public.patient_appointments to authenticated;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
-- Turns the doctor-slot unique index into a plain-English error.
create or replace function private.appointment_slot_taken_message()
returns text language sql immutable set search_path = '' as
$$ select 'That doctor already has an appointment at this time. Choose another doctor or reschedule' $$;

-- -----------------------------------------------------------------------------
-- 1. Hospital staff: assign a doctor (and accept by default)
-- -----------------------------------------------------------------------------
create or replace function public.appointment_assign_doctor(p_appointment_id uuid, p_doctor_id uuid,
                                                            p_accept boolean default true)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _a public.patient_appointments;
begin
  select * into _a from public.patient_appointments where id = p_appointment_id for update;
  if _a.id is null or auth.uid() is null or not private.can_staff_work_at(_a.hospital_id, 'emr') then
    raise exception 'Appointment not found' using errcode = '42501';
  end if;
  if _a.status not in ('pending', 'accepted') then
    raise exception 'This appointment is already %', _a.status;
  end if;
  if p_doctor_id is null
     or not private.doctor_is_active_at(p_doctor_id, _a.hospital_id)
     or not private.doctor_is_approved(p_doctor_id) then
    raise exception 'Choose a verified doctor who works at this hospital';
  end if;

  begin
    update public.patient_appointments
       set doctor_id = p_doctor_id,
           status = case when coalesce(p_accept, true) then 'accepted' else status end,
           decided_at = case when coalesce(p_accept, true) and status = 'pending' then now() else decided_at end,
           decided_by = case when coalesce(p_accept, true) and status = 'pending' then auth.uid() else decided_by end
     where id = p_appointment_id;
  exception when unique_violation then
    raise exception '%', private.appointment_slot_taken_message();
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- 2. Doctor: take an open (unassigned) request at a hospital where they work
-- -----------------------------------------------------------------------------
create or replace function public.appointment_claim(p_appointment_id uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _a public.patient_appointments;
  _me uuid := private.my_doctor_id();
begin
  select * into _a from public.patient_appointments where id = p_appointment_id for update;
  if _a.id is null or _me is null or not private.can_doctor_work_at(_a.hospital_id, 'emr') then
    raise exception 'Appointment not found' using errcode = '42501';
  end if;
  if not private.doctor_is_approved(_me) then
    raise exception 'Your account must be verified before you can take appointments';
  end if;
  if _a.doctor_id is not null then
    raise exception 'Another doctor has already taken this appointment';
  end if;
  if _a.status <> 'pending' then
    raise exception 'This appointment is already %', _a.status;
  end if;

  begin
    update public.patient_appointments
       set doctor_id = _me, status = 'accepted', decided_at = now(), decided_by = auth.uid()
     where id = p_appointment_id;
  exception when unique_violation then
    raise exception 'You already have an appointment at this time';
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Accept or decline a pending request (hospital staff, or the assigned doctor)
-- -----------------------------------------------------------------------------
create or replace function public.appointment_respond(p_appointment_id uuid, p_accept boolean,
                                                      p_reason text default null)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _a public.patient_appointments;
  _reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  select * into _a from public.patient_appointments where id = p_appointment_id for update;
  if _a.id is null or auth.uid() is null
     or not (private.can_staff_work_at(_a.hospital_id, 'emr')
             or (_a.doctor_id is not null and _a.doctor_id = private.my_doctor_id()
                 and private.can_doctor_work_at(_a.hospital_id, 'emr'))) then
    raise exception 'Appointment not found' using errcode = '42501';
  end if;
  if _a.status <> 'pending' then
    raise exception 'This appointment is already %', _a.status;
  end if;
  if p_accept is null then
    raise exception 'Choose accept or decline';
  end if;
  if not p_accept and _reason is null then
    raise exception 'Give the patient a reason for declining';
  end if;
  if p_accept and _a.doctor_id is null then
    raise exception 'Assign a doctor before accepting this appointment';
  end if;

  update public.patient_appointments
     set status = case when p_accept then 'accepted' else 'rejected' end,
         decline_reason = case when p_accept then null else left(_reason, 500) end,
         decided_at = now(), decided_by = auth.uid()
   where id = p_appointment_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Notifications: tell doctors about open requests and new assignments.
--    Same function as before, plus two branches (marked NEW).
-- -----------------------------------------------------------------------------
create or replace function public.notify_user_appointment()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  p uuid;
  d uuid;
  when_txt text;
  _doc record;
begin
  p := public.patient_user_id(new.patient_id);
  d := public.doctor_user_id(new.doctor_id);
  when_txt := new.requested_date::text || coalesce(' at ' || to_char(new.requested_time, 'HH24:MI'), '');
  if tg_op = 'INSERT' then
    perform public.emit_user_notification(p, 'patient', 'appointment', 'Appointment requested',
      'Your appointment request for ' || when_txt || ' was submitted.', new.id, 'appointment', '/patient/appointments');
    perform public.emit_user_notification(d, 'doctor', 'appointment', 'New appointment request',
      public.patient_display_name(new.patient_id) || ' requested ' || when_txt, new.id, 'appointment', '/doctor/appointments');
    -- NEW: "any available doctor" requests go to every verified doctor active at the hospital.
    if new.doctor_id is null then
      for _doc in
        select dr.user_id from public.hospital_doctors hd
          join public.doctors dr on dr.id = hd.doctor_id
         where hd.hospital_id = new.hospital_id and hd.status = 'active' and hd.is_active
           and dr.verification_status = 'approved' and dr.user_id is not null
      loop
        perform public.emit_user_notification(_doc.user_id, 'doctor', 'appointment', 'Open appointment request',
          public.patient_display_name(new.patient_id) || ' requested any available doctor for ' || when_txt,
          new.id, 'appointment', '/doctor/appointments');
      end loop;
    end if;
  else
    -- NEW: a doctor was assigned (by the hospital or by taking an open request).
    if new.doctor_id is not null and new.doctor_id is distinct from old.doctor_id
       and new.doctor_id is distinct from private.my_doctor_id() then
      perform public.emit_user_notification(d, 'doctor', 'appointment', 'Appointment assigned to you',
        public.patient_display_name(new.patient_id) || ' on ' || when_txt, new.id, 'appointment', '/doctor/appointments');
    end if;
    if new.requested_date is distinct from old.requested_date or new.requested_time is distinct from old.requested_time then
      perform public.emit_user_notification(p, 'patient', 'appointment', 'Appointment rescheduled',
        'Your appointment moved to ' || when_txt, new.id, 'appointment', '/patient/appointments');
      perform public.emit_user_notification(d, 'doctor', 'appointment', 'Appointment rescheduled',
        public.patient_display_name(new.patient_id) || ' moved to ' || when_txt, new.id, 'appointment', '/doctor/appointments');
    elsif new.status is distinct from old.status then
      perform public.emit_user_notification(p, 'patient', 'appointment', 'Appointment ' || new.status,
        'Your appointment on ' || when_txt || ' is now ' || new.status
          || coalesce('. Reason: ' || new.decline_reason, ''), new.id, 'appointment', '/patient/appointments');
      perform public.emit_user_notification(d, 'doctor', 'appointment', 'Appointment ' || new.status,
        public.patient_display_name(new.patient_id) || '''s appointment is now ' || new.status, new.id, 'appointment', '/doctor/appointments');
    end if;
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Grants
-- -----------------------------------------------------------------------------
revoke all on function private.appointment_slot_taken_message() from public, anon, authenticated;
revoke all on function public.appointment_assign_doctor(uuid, uuid, boolean) from public, anon;
revoke all on function public.appointment_claim(uuid) from public, anon;
revoke all on function public.appointment_respond(uuid, boolean, text) from public, anon;
grant execute on function public.appointment_assign_doctor(uuid, uuid, boolean) to authenticated;
grant execute on function public.appointment_claim(uuid) to authenticated;
grant execute on function public.appointment_respond(uuid, boolean, text) to authenticated;
