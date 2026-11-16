-- =============================================================================
-- Patient app 0.5
--   1. Scan to check in: each hospital has a check-in QR code at the front desk.
--      A patient scans it with the app (or the phone camera), confirms, and is
--      added to that day's queue; the hospital is linked to the patient, so the
--      front desk and the doctor see their profile and health card.
--      Queue numbers are now given by the database, per hospital per day.
--   2. Care plans for maternity and surgery: antenatal visits (with a one-click
--      standard schedule), surgery admission and fasting times, and to-dos the
--      doctor writes for the patient. The patient sees them in the app and on the
--      website and gets reminders before each one.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Queue numbers: 1, 2, 3... per hospital per day (Lagos time), no duplicates.
-- -----------------------------------------------------------------------------
create or replace function private.assign_queue_number()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  _day date := (coalesce(new.checkin_time, now()) at time zone 'Africa/Lagos')::date;
begin
  perform pg_advisory_xact_lock(hashtextextended('checkin-queue:' || new.hospital_id::text || ':' || _day::text, 0));
  select coalesce(max(c.queue_number), 0) + 1 into new.queue_number
    from public.patient_checkins c
   where c.hospital_id = new.hospital_id
     and (c.checkin_time at time zone 'Africa/Lagos')::date = _day;
  return new;
end;
$$;
create trigger trg_assign_queue_number before insert on public.patient_checkins
  for each row execute function private.assign_queue_number();

-- -----------------------------------------------------------------------------
-- 2. Hospital check-in code
-- -----------------------------------------------------------------------------
-- Kept out of public.hospitals so it is never readable through the table.
create table private.hospital_checkin_codes (
  hospital_id uuid primary key references public.hospitals(id) on delete cascade,
  token text not null unique,
  created_at timestamptz not null default now()
);

create or replace function private.new_checkin_token()
returns text language sql volatile set search_path = '' as $$
  select string_agg(substr('abcdefghjkmnpqrstuvwxyz23456789', (get_byte(b, i) % 31) + 1, 1), '')
    from (select extensions.gen_random_bytes(16) b) r, generate_series(0, 15) i
$$;
revoke all on function private.new_checkin_token() from public, anon, authenticated;

-- Front desk: the hospital's code (made on first use). The QR holds
-- https://<site>/checkin/<token>; the website and the app both open it.
create or replace function public.hospital_checkin_code(p_hospital_id uuid)
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _t text;
begin
  if auth.uid() is null or not private.can_staff_work_at(p_hospital_id, 'emr') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select token into _t from private.hospital_checkin_codes where hospital_id = p_hospital_id;
  if _t is null then
    insert into private.hospital_checkin_codes (hospital_id, token) values (p_hospital_id, private.new_checkin_token())
    on conflict (hospital_id) do nothing;
    select token into _t from private.hospital_checkin_codes where hospital_id = p_hospital_id;
  end if;
  return _t;
end;
$$;

-- Hospital admin: replace the code (old posters stop working).
create or replace function public.reset_hospital_checkin_code(p_hospital_id uuid)
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _t text := private.new_checkin_token();
begin
  if auth.uid() is null or not private.is_hospital_admin(p_hospital_id) then
    raise exception 'Only the hospital admin can reset the check-in code' using errcode = '42501';
  end if;
  insert into private.hospital_checkin_codes (hospital_id, token) values (p_hospital_id, _t)
  on conflict (hospital_id) do update set token = excluded.token, created_at = now();
  return _t;
end;
$$;

create or replace function private.checkin_hospital(_token text)
returns uuid language sql stable security definer set search_path = '' as $$
  select c.hospital_id from private.hospital_checkin_codes c
    join public.hospitals h on h.id = c.hospital_id
   where c.token = lower(btrim(coalesce(_token, '')))
     and h.is_active and h.verification_status = 'approved'
     and private.hospital_has_plan(h.id, 'emr')
$$;
revoke all on function private.checkin_hospital(text) from public, anon, authenticated;

-- Patient, after scanning: which hospital is this, and is there a visit booked there today?
create or replace function public.checkin_lookup(p_token text, p_patient_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _hid uuid := private.checkin_hospital(p_token);
  _pid uuid := coalesce(p_patient_id, private.my_patient_id());
  _h public.hospitals;
  _appt jsonb;
  _open jsonb;
begin
  if auth.uid() is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if _hid is null then
    raise exception 'This check-in code is not valid. Ask the front desk for help.';
  end if;
  if _pid is null or not private.is_own_patient(_pid) then
    raise exception 'Patient not found' using errcode = '42501';
  end if;
  select * into _h from public.hospitals where id = _hid;
  select jsonb_build_object('id', a.id, 'requested_time', a.requested_time,
           'doctor_name', (select 'Dr ' || btrim(d.first_name || ' ' || d.last_name) from public.doctors d where d.id = a.doctor_id))
    into _appt
    from public.patient_appointments a
   where a.patient_id = _pid and a.hospital_id = _hid and a.status in ('accepted', 'confirmed')
     and not coalesce(a.is_telemedicine, false)
     and a.requested_date = (now() at time zone 'Africa/Lagos')::date
   order by a.requested_time nulls last limit 1;
  select jsonb_build_object('id', c.id, 'queue_number', c.queue_number, 'status', c.status)
    into _open
    from public.patient_checkins c
   where c.patient_id = _pid and c.hospital_id = _hid
     and c.status in ('checked_in', 'waiting', 'called', 'in_consultation')
     and (c.checkin_time at time zone 'Africa/Lagos')::date = (now() at time zone 'Africa/Lagos')::date
   limit 1;
  return jsonb_build_object('hospital_id', _h.id, 'name', _h.name, 'city', _h.city, 'state', _h.state,
                            'logo_url', _h.logo_url, 'appointment_today', _appt, 'already_checked_in', _open,
                            'already_linked', private.patient_linked(_hid, _pid));
end;
$$;

-- Patient checks in (themself or a family member).
create or replace function public.self_check_in(p_token text, p_patient_id uuid default null, p_reason text default null)
returns jsonb
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _hid uuid := private.checkin_hospital(p_token);
  _pid uuid := coalesce(p_patient_id, private.my_patient_id());
  _missing text[];
  _c public.patient_checkins;
  _a public.patient_appointments;
  _doctor uuid;
  _ahead int;
  _already boolean := false;
begin
  if _uid is null then raise exception 'Sign in first' using errcode = '42501'; end if;
  if _hid is null then raise exception 'This check-in code is not valid. Ask the front desk for help.'; end if;
  if _pid is null or not private.is_own_patient(_pid) then
    raise exception 'Patient not found' using errcode = '42501';
  end if;
  _missing := private.patient_missing_fields(private.my_patient_id());
  if cardinality(_missing) > 0 then
    raise exception 'Complete your profile before checking in. Missing: %', private.missing_fields_text(_missing)
      using errcode = 'P0001', hint = 'profile_incomplete';
  end if;

  select * into _c from public.patient_checkins c
   where c.patient_id = _pid and c.hospital_id = _hid
     and c.status in ('checked_in', 'waiting', 'called', 'in_consultation')
     and (c.checkin_time at time zone 'Africa/Lagos')::date = (now() at time zone 'Africa/Lagos')::date
   limit 1;

  if _c.id is null then
    if (select count(*) from public.function_calls f
         where f.user_id = _uid and f.fn = 'self_check_in' and f.created_at > now() - interval '1 hour') >= 6 then
      raise exception 'Too many check-ins. Please ask the front desk.' using errcode = '54000';
    end if;
    insert into public.function_calls (user_id, fn) values (_uid, 'self_check_in');

    select * into _a from public.patient_appointments a
     where a.patient_id = _pid and a.hospital_id = _hid and a.status in ('accepted', 'confirmed')
       and not coalesce(a.is_telemedicine, false)
       and a.requested_date = (now() at time zone 'Africa/Lagos')::date
     order by a.requested_time nulls last limit 1;
    if _a.doctor_id is not null and private.doctor_is_active_at(_a.doctor_id, _hid) then
      _doctor := _a.doctor_id;
    end if;

    insert into public.patient_checkins (hospital_id, patient_id, checkin_type, status, urgency, assigned_doctor_id, notes)
    values (_hid, _pid, case when _a.id is not null then 'pre_booked' else 'walk_in' end, 'checked_in', 'routine', _doctor,
            'Checked in with the HealingNet app'
              || coalesce('. Reason: ' || nullif(left(btrim(coalesce(p_reason, '')), 300), ''), ''))
    returning * into _c;
  else
    _already := true;
  end if;

  select count(*) into _ahead from public.patient_checkins c
   where c.hospital_id = _hid and c.status in ('checked_in', 'waiting')
     and c.queue_number < _c.queue_number
     and (c.checkin_time at time zone 'Africa/Lagos')::date = (now() at time zone 'Africa/Lagos')::date;

  return jsonb_build_object('checkin_id', _c.id, 'queue_number', _c.queue_number, 'status', _c.status,
                            'ahead', _ahead, 'already', _already,
                            'hospital_name', (select name from public.hospitals where id = _hid));
end;
$$;

-- Patient: today's check-ins and their place in the queue.
create or replace function public.my_checkin_status(p_patient_id uuid default null)
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
    select jsonb_agg(jsonb_build_object(
             'checkin_id', c.id, 'hospital_id', c.hospital_id, 'hospital_name', h.name,
             'queue_number', c.queue_number, 'status', c.status, 'checkin_time', c.checkin_time,
             'doctor_name', (select 'Dr ' || btrim(d.first_name || ' ' || d.last_name) from public.doctors d where d.id = c.assigned_doctor_id),
             'ahead', case when c.status in ('checked_in', 'waiting') then
                        (select count(*) from public.patient_checkins o
                          where o.hospital_id = c.hospital_id and o.status in ('checked_in', 'waiting')
                            and o.queue_number < c.queue_number
                            and (o.checkin_time at time zone 'Africa/Lagos')::date = (c.checkin_time at time zone 'Africa/Lagos')::date)
                      else 0 end)
           order by c.checkin_time desc)
      from public.patient_checkins c join public.hospitals h on h.id = c.hospital_id
     where c.patient_id = _pid
       and (c.checkin_time at time zone 'Africa/Lagos')::date = (now() at time zone 'Africa/Lagos')::date
       and c.status <> 'cancelled'), '[]'::jsonb);
end;
$$;

-- Patient: leave the queue before being called.
create or replace function public.cancel_my_checkin(p_checkin_id uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _c public.patient_checkins;
begin
  select * into _c from public.patient_checkins where id = p_checkin_id for update;
  if _c.id is null or auth.uid() is null or not private.is_own_patient(_c.patient_id) then
    raise exception 'Check-in not found' using errcode = '42501';
  end if;
  if _c.status not in ('checked_in', 'waiting') then
    raise exception 'You have already been called. Please speak to the front desk.';
  end if;
  update public.patient_checkins set status = 'cancelled' where id = _c.id;
end;
$$;

revoke all on function public.hospital_checkin_code(uuid), public.reset_hospital_checkin_code(uuid),
  public.checkin_lookup(text, uuid), public.self_check_in(text, uuid, text),
  public.my_checkin_status(uuid), public.cancel_my_checkin(uuid) from public, anon;
grant execute on function public.hospital_checkin_code(uuid), public.reset_hospital_checkin_code(uuid),
  public.checkin_lookup(text, uuid), public.self_check_in(text, uuid, text),
  public.my_checkin_status(uuid), public.cancel_my_checkin(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Maternity and surgery: what the hospital records, what the patient sees
-- -----------------------------------------------------------------------------
-- Patient-facing text, written by the doctor ("Visible to the patient").
alter table public.maternity_records
  add column if not exists patient_notes text check (patient_notes is null or length(patient_notes) <= 2000);
grant update (patient_notes) on public.maternity_records to authenticated;

alter table public.surgery_records
  add column if not exists admit_at timestamptz,
  add column if not exists fasting_from timestamptz,
  add column if not exists consent_signed_at timestamptz,
  add column if not exists patient_instructions text check (patient_instructions is null or length(patient_instructions) <= 2000),
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists fasting_reminder_sent_at timestamptz;
grant update (admit_at, fasting_from, consent_signed_at, patient_instructions) on public.surgery_records to authenticated;

-- Antenatal visits (one row per contact).
create table public.maternity_visits (
  id uuid primary key default gen_random_uuid(),
  maternity_record_id uuid not null references public.maternity_records(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_date date not null default ((now() at time zone 'Africa/Lagos')::date),
  gestational_weeks int check (gestational_weeks between 0 and 45),
  bp_systolic int check (bp_systolic between 40 and 300),
  bp_diastolic int check (bp_diastolic between 20 and 200),
  weight_kg numeric(5,1) check (weight_kg between 20 and 300),
  fundal_height_cm numeric(4,1) check (fundal_height_cm between 0 and 60),
  fetal_heart_rate int check (fetal_heart_rate between 50 and 250),
  presentation text check (presentation is null or presentation in ('cephalic', 'breech', 'transverse', 'oblique', 'not_determined')),
  urine_protein text check (urine_protein is null or urine_protein in ('negative', 'trace', '1+', '2+', '3+', '4+')),
  oedema boolean,
  notes text check (notes is null or length(notes) <= 2000),
  next_visit_date date,
  recorded_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_maternity_visits_record on public.maternity_visits (maternity_record_id, visit_date);
create trigger trg_maternity_visits_updated before update on public.maternity_visits
  for each row execute function public.update_updated_at_column();

-- hospital_id / patient_id always come from the pregnancy record.
create or replace function private.maternity_visit_fill()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select hospital_id, patient_id into new.hospital_id, new.patient_id
    from public.maternity_records where id = new.maternity_record_id;
  if new.hospital_id is null then raise exception 'Pregnancy record not found'; end if;
  return new;
end;
$$;
create trigger trg_maternity_visit_fill before insert or update of maternity_record_id on public.maternity_visits
  for each row execute function private.maternity_visit_fill();

alter table public.maternity_visits enable row level security;
grant all on public.maternity_visits to service_role;
grant select, delete on public.maternity_visits to authenticated;
grant insert (maternity_record_id, visit_date, gestational_weeks, bp_systolic, bp_diastolic, weight_kg, fundal_height_cm,
              fetal_heart_rate, presentation, urine_protein, oedema, notes, next_visit_date) on public.maternity_visits to authenticated;
grant update (visit_date, gestational_weeks, bp_systolic, bp_diastolic, weight_kg, fundal_height_cm,
              fetal_heart_rate, presentation, urine_protein, oedema, notes, next_visit_date) on public.maternity_visits to authenticated;
create policy "Hospital reads antenatal visits" on public.maternity_visits
  for select to authenticated using (private.can_work_at(hospital_id, 'emr'));
create policy "Hospital records antenatal visits" on public.maternity_visits
  for insert to authenticated with check (private.can_work_at(hospital_id, 'emr'));
create policy "Hospital updates antenatal visits" on public.maternity_visits
  for update to authenticated using (private.can_work_at(hospital_id, 'emr')) with check (private.can_work_at(hospital_id, 'emr'));
create policy "Hospital deletes antenatal visits" on public.maternity_visits
  for delete to authenticated using (private.can_work_at(hospital_id, 'emr'));

-- Care plan: visits, tests, medicines, to-dos and instructions the hospital sets for the patient.
create table public.care_plan_items (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  source_type text not null check (source_type in ('maternity', 'surgery')),
  source_id uuid not null,
  kind text not null default 'task' check (kind in ('visit', 'test', 'medicine', 'task', 'instruction')),
  title text not null check (length(btrim(title)) between 1 and 120),
  details text check (details is null or length(details) <= 1000),
  due_at timestamptz,
  remind boolean not null default true,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  done_at timestamptz,
  done_by_patient boolean not null default false,
  reminder_24h_sent_at timestamptz,
  reminder_due_sent_at timestamptz,
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_care_items_source on public.care_plan_items (source_type, source_id);
create index idx_care_items_patient on public.care_plan_items (patient_id, due_at);
create index idx_care_items_due on public.care_plan_items (due_at) where status = 'open' and remind;
create trigger trg_care_items_updated before update on public.care_plan_items
  for each row execute function public.update_updated_at_column();

create or replace function private.care_item_fill()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.source_id is distinct from old.source_id or new.source_type is distinct from old.source_type then
    if new.source_type = 'maternity' then
      select hospital_id, patient_id into new.hospital_id, new.patient_id from public.maternity_records where id = new.source_id;
    else
      select hospital_id, patient_id into new.hospital_id, new.patient_id from public.surgery_records where id = new.source_id;
    end if;
    if new.hospital_id is null then raise exception 'Record not found'; end if;
  end if;
  if tg_op = 'UPDATE' then
    -- A new date gets fresh reminders.
    if new.due_at is distinct from old.due_at then
      new.reminder_24h_sent_at := null; new.reminder_due_sent_at := null;
    end if;
    if new.status = 'done' and old.status <> 'done' then new.done_at := coalesce(new.done_at, now()); end if;
    if new.status <> 'done' then new.done_at := null; new.done_by_patient := false; end if;
  end if;
  return new;
end;
$$;
create trigger trg_care_item_fill before insert or update on public.care_plan_items
  for each row execute function private.care_item_fill();

alter table public.care_plan_items enable row level security;
grant all on public.care_plan_items to service_role;
grant select, delete on public.care_plan_items to authenticated;
grant insert (source_type, source_id, kind, title, details, due_at, remind) on public.care_plan_items to authenticated;
grant update (kind, title, details, due_at, remind, status) on public.care_plan_items to authenticated;
create policy "Hospital and patient read care items" on public.care_plan_items
  for select to authenticated using (private.can_work_at(hospital_id, 'emr') or private.is_own_patient(patient_id));
create policy "Hospital adds care items" on public.care_plan_items
  for insert to authenticated with check (private.can_work_at(hospital_id, 'emr'));
create policy "Hospital updates care items" on public.care_plan_items
  for update to authenticated using (private.can_work_at(hospital_id, 'emr')) with check (private.can_work_at(hospital_id, 'emr'));
create policy "Hospital deletes care items" on public.care_plan_items
  for delete to authenticated using (private.can_work_at(hospital_id, 'emr'));

-- The patient ticks a to-do, test, medicine or instruction (visits are marked by the hospital).
create or replace function public.set_care_item_done(p_item_id uuid, p_done boolean default true)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _i public.care_plan_items;
begin
  select * into _i from public.care_plan_items where id = p_item_id for update;
  if _i.id is null or auth.uid() is null or not private.is_own_patient(_i.patient_id) then
    raise exception 'Item not found' using errcode = '42501';
  end if;
  if _i.kind = 'visit' then raise exception 'The hospital marks visits as done'; end if;
  if _i.status = 'cancelled' then raise exception 'This item was cancelled by the hospital'; end if;
  update public.care_plan_items
     set status = case when p_done then 'done' else 'open' end,
         done_by_patient = coalesce(p_done, false),
         done_at = case when p_done then now() end
   where id = _i.id;
end;
$$;
revoke all on function public.set_care_item_done(uuid, boolean) from public, anon;
grant execute on function public.set_care_item_done(uuid, boolean) to authenticated;

-- Doctor: add the standard antenatal schedule (8 contacts, at 12, 20, 26, 30, 34, 36, 38
-- and 40 weeks) from LMP or EDD. Only future dates; skips weeks that already have a visit.
create or replace function public.add_standard_anc_schedule(p_maternity_record_id uuid)
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _m public.maternity_records;
  _lmp date;
  _wk int;
  _due timestamptz;
  _n int := 0;
begin
  select * into _m from public.maternity_records where id = p_maternity_record_id;
  if _m.id is null or auth.uid() is null or not private.can_work_at(_m.hospital_id, 'emr') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  _lmp := coalesce(_m.lmp_date, _m.edd - 280);
  if _lmp is null then raise exception 'Add the LMP or the EDD first'; end if;
  foreach _wk in array array[12, 20, 26, 30, 34, 36, 38, 40] loop
    _due := ((_lmp + _wk * 7) + time '09:00') at time zone 'Africa/Lagos';
    continue when _due <= now();
    continue when exists (select 1 from public.care_plan_items i
                           where i.source_type = 'maternity' and i.source_id = _m.id and i.kind = 'visit'
                             and i.status <> 'cancelled' and abs(extract(epoch from (i.due_at - _due))) < 7 * 86400);
    insert into public.care_plan_items (source_type, source_id, kind, title, details, due_at)
    values ('maternity', _m.id, 'visit', 'Antenatal visit (' || _wk || ' weeks)',
            'Come to the antenatal clinic. Bring your antenatal card.', _due);
    _n := _n + 1;
  end loop;
  return _n;
end;
$$;
revoke all on function public.add_standard_anc_schedule(uuid) from public, anon;
grant execute on function public.add_standard_anc_schedule(uuid) to authenticated;

-- Patient: pregnancies and surgeries with their care plans, in one call.
-- Clinical notes, complications, findings, diagnoses and risk level stay with the hospital.
create or replace function public.my_care(p_patient_id uuid default null)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _pid uuid := coalesce(p_patient_id, private.my_patient_id());
  _today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if auth.uid() is null or _pid is null or not private.is_own_patient(_pid) then
    raise exception 'Patient not found' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'pregnancies', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', m.id, 'hospital_name', h.name,
          'doctor_name', (select 'Dr ' || btrim(d.first_name || ' ' || d.last_name) from public.doctors d where d.id = m.doctor_id),
          'status', m.status, 'lmp_date', m.lmp_date, 'edd', m.edd,
          'weeks_today', case when coalesce(m.lmp_date, m.edd - 280) is not null and m.status in ('anc_registered', 'active_anc', 'labour')
                              then (_today - coalesce(m.lmp_date, m.edd - 280)) / 7 end,
          'days_extra', case when coalesce(m.lmp_date, m.edd - 280) is not null and m.status in ('anc_registered', 'active_anc', 'labour')
                              then (_today - coalesce(m.lmp_date, m.edd - 280)) % 7 end,
          'patient_notes', m.patient_notes,
          'delivery_date', m.delivery_date, 'delivery_type', m.delivery_type,
          'baby_gender', m.baby_gender, 'baby_weight', m.baby_weight,
          'visits', coalesce((select jsonb_agg(jsonb_build_object(
                        'visit_date', v.visit_date, 'gestational_weeks', v.gestational_weeks,
                        'bp', case when v.bp_systolic is not null then v.bp_systolic || '/' || v.bp_diastolic end,
                        'weight_kg', v.weight_kg, 'fetal_heart_rate', v.fetal_heart_rate,
                        'next_visit_date', v.next_visit_date) order by v.visit_date desc)
                      from (select * from public.maternity_visits where maternity_record_id = m.id order by visit_date desc limit 12) v), '[]'::jsonb),
          'items', private.care_items_json('maternity', m.id))
        order by m.created_at desc)
        from public.maternity_records m join public.hospitals h on h.id = m.hospital_id
       where m.patient_id = _pid
         and (m.status not in ('delivered', 'discharged') or m.updated_at > now() - interval '1 year')), '[]'::jsonb),
    'surgeries', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', s.id, 'hospital_name', h.name,
          'surgeon_name', (select 'Dr ' || btrim(d.first_name || ' ' || d.last_name) from public.doctors d where d.id = s.surgeon_id),
          'procedure_name', s.procedure_name, 'procedure_type', s.procedure_type, 'anaesthesia_type', s.anaesthesia_type,
          'scheduled_date', s.scheduled_date, 'scheduled_time', s.scheduled_time,
          'admit_at', s.admit_at, 'fasting_from', s.fasting_from, 'status', s.status,
          'consent_signed', s.consent_signed_at is not null,
          'patient_instructions', s.patient_instructions, 'post_op_instructions', s.post_op_instructions,
          'items', private.care_items_json('surgery', s.id))
        order by s.scheduled_date desc)
        from public.surgery_records s join public.hospitals h on h.id = s.hospital_id
       where s.patient_id = _pid
         and (s.status not in ('completed', 'cancelled') or s.updated_at > now() - interval '90 days')), '[]'::jsonb));
end;
$$;

create or replace function private.care_items_json(_source text, _id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'kind', i.kind, 'title', i.title, 'details', i.details, 'due_at', i.due_at,
           'remind', i.remind, 'status', i.status, 'done_at', i.done_at, 'done_by_patient', i.done_by_patient)
         order by i.due_at nulls last, i.created_at), '[]'::jsonb)
    from public.care_plan_items i
   where i.source_type = _source and i.source_id = _id and i.status <> 'cancelled'
$$;
revoke all on function private.care_items_json(text, uuid) from public, anon, authenticated;
revoke all on function public.my_care(uuid) from public, anon;
grant execute on function public.my_care(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Telling the patient, and reminding them
-- -----------------------------------------------------------------------------
-- A new date or fasting time gets fresh reminders.
create or replace function private.surgery_reminders_reset()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.scheduled_date is distinct from old.scheduled_date or new.scheduled_time is distinct from old.scheduled_time
     or new.admit_at is distinct from old.admit_at then
    new.reminder_24h_sent_at := null;
  end if;
  if new.fasting_from is distinct from old.fasting_from then new.fasting_reminder_sent_at := null; end if;
  return new;
end;
$$;
create trigger trg_surgery_reminders_reset before update on public.surgery_records
  for each row execute function private.surgery_reminders_reset();

create or replace function private.notify_surgery_scheduled()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('scheduled', 'prep') and (tg_op = 'INSERT'
      or new.scheduled_date is distinct from old.scheduled_date or new.scheduled_time is distinct from old.scheduled_time
      or new.admit_at is distinct from old.admit_at) then
    perform public.emit_user_notification(public.patient_user_id(new.patient_id), 'patient', 'care',
      case when tg_op = 'INSERT' then 'Procedure booked' else 'Procedure date changed' end,
      new.procedure_name || ' on ' || to_char(new.scheduled_date, 'Dy DD Mon') || ' at ' || to_char(new.scheduled_time, 'HH24:MI')
        || '. Open HealingNet for what to do before.',
      new.id, 'surgery', '/patient/care');
  end if;
  return new;
end;
$$;
create trigger trg_notify_surgery_scheduled after insert or update on public.surgery_records
  for each row execute function private.notify_surgery_scheduled();

-- New care items: one notification per burst (the standard schedule adds 8 at once).
create or replace function private.notify_care_item()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  _u uuid := public.patient_user_id(new.patient_id);
begin
  if _u is null then return new; end if;
  if exists (select 1 from public.user_notifications n
              where n.user_id = _u and n.type = 'care' and n.reference_type = 'care_plan'
                and n.reference_id = new.source_id and n.created_at > now() - interval '10 minutes') then
    return new;
  end if;
  perform public.emit_user_notification(_u, 'patient', 'care', 'Care plan updated',
    'Your ' || case new.source_type when 'maternity' then 'antenatal' else 'surgery' end
      || ' care plan has something new. Open HealingNet to see it.',
    new.source_id, 'care_plan', '/patient/care');
  return new;
end;
$$;
create trigger trg_notify_care_item after insert on public.care_plan_items
  for each row execute function private.notify_care_item();

-- Reminders, run by the existing 5-minute reminder job.
create or replace function private.queue_care_reminders()
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  r record;
  _n int := 0;
  _u uuid;
  _at timestamptz;
begin
  -- Care items: the day before (only if added at least a day ahead), then on the day.
  for r in
    select i.* from public.care_plan_items i
     where i.status = 'open' and i.remind and i.due_at is not null
       and i.due_at between now() - interval '1 hour' and now() + interval '24 hours'
       and (i.reminder_24h_sent_at is null or i.reminder_due_sent_at is null)
     for update skip locked
  loop
    _u := public.patient_user_id(r.patient_id);
    if (r.kind = 'visit' and r.due_at <= now() + interval '2 hours' and r.due_at > now())
       or (r.kind <> 'visit' and r.due_at <= now()) then
      if r.reminder_due_sent_at is null then
        perform public.emit_user_notification(_u, 'patient', 'care',
          case when r.kind = 'visit' then 'Today at ' || to_char(r.due_at at time zone 'Africa/Lagos', 'HH24:MI') else 'Reminder' end,
          r.title || coalesce('. ' || r.details, ''), r.id, 'care_item', '/patient/care');
        _n := _n + 1;
      end if;
      update public.care_plan_items set reminder_due_sent_at = now(), reminder_24h_sent_at = coalesce(reminder_24h_sent_at, now()) where id = r.id;
    elsif r.reminder_24h_sent_at is null and r.due_at > now() + interval '2 hours' then
      if r.created_at <= r.due_at - interval '24 hours' then
        perform public.emit_user_notification(_u, 'patient', 'care',
          'Tomorrow at ' || to_char(r.due_at at time zone 'Africa/Lagos', 'HH24:MI'),
          r.title || coalesce('. ' || r.details, ''), r.id, 'care_item', '/patient/care');
        _n := _n + 1;
      end if;
      update public.care_plan_items set reminder_24h_sent_at = now() where id = r.id;
    end if;
  end loop;

  -- Surgery: the day before admission (or the operation), and an hour before fasting starts.
  for r in
    select s.*, coalesce(s.admit_at, (s.scheduled_date + s.scheduled_time) at time zone 'Africa/Lagos') as starts_at
      from public.surgery_records s
     where s.status in ('scheduled', 'prep')
       and ((s.reminder_24h_sent_at is null
             and coalesce(s.admit_at, (s.scheduled_date + s.scheduled_time) at time zone 'Africa/Lagos') between now() + interval '2 hours' and now() + interval '24 hours')
         or (s.fasting_reminder_sent_at is null and s.fasting_from between now() and now() + interval '1 hour'))
     for update skip locked
  loop
    _u := public.patient_user_id(r.patient_id);
    if r.fasting_reminder_sent_at is null and r.fasting_from between now() and now() + interval '1 hour' then
      perform public.emit_user_notification(_u, 'patient', 'care',
        'Fasting starts at ' || to_char(r.fasting_from at time zone 'Africa/Lagos', 'HH24:MI'),
        'Before your procedure: no food or drink from ' || to_char(r.fasting_from at time zone 'Africa/Lagos', 'HH24:MI')
          || ' unless your doctor told you otherwise.', r.id, 'surgery', '/patient/care');
      update public.surgery_records set fasting_reminder_sent_at = now() where id = r.id;
      _n := _n + 1;
    end if;
    if r.reminder_24h_sent_at is null and r.starts_at between now() + interval '2 hours' and now() + interval '24 hours' then
      perform public.emit_user_notification(_u, 'patient', 'care',
        case when r.admit_at is not null then 'Admission tomorrow at ' else 'Procedure tomorrow at ' end
          || to_char(r.starts_at at time zone 'Africa/Lagos', 'HH24:MI'),
        r.procedure_name || '. Open HealingNet for your instructions.', r.id, 'surgery', '/patient/care');
      update public.surgery_records set reminder_24h_sent_at = now() where id = r.id;
      _n := _n + 1;
    end if;
  end loop;
  return _n;
end;
$$;
revoke all on function private.queue_care_reminders() from public, anon, authenticated;

-- The existing job (every 5 minutes) now also sends care reminders.
create or replace function public.queue_appointment_reminders()
returns int
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  r record;
  _n int := 0;
  _start timestamptz;
  _when text;
  _with text;
  _p uuid;
  _d uuid;
begin
  for r in
    select a.*, ((a.requested_date + a.requested_time) at time zone 'Africa/Lagos') as starts_at
      from public.patient_appointments a
     where a.status = 'accepted' and a.requested_time is not null
       and (a.requested_date + a.requested_time) at time zone 'Africa/Lagos' > now()
       and (a.requested_date + a.requested_time) at time zone 'Africa/Lagos' <= now() + interval '24 hours'
       and (a.reminder_24h_sent_at is null or a.reminder_1h_sent_at is null)
     for update skip locked
  loop
    _start := r.starts_at;
    _p := public.patient_user_id(r.patient_id);
    _d := public.doctor_user_id(r.doctor_id);
    _with := coalesce('Dr ' || (select btrim(first_name || ' ' || last_name) from public.doctors where id = r.doctor_id), 'your doctor');

    if r.reminder_1h_sent_at is null and _start <= now() + interval '1 hour' then
      _when := 'at ' || to_char(r.requested_time, 'HH24:MI');
      perform public.emit_user_notification(_p, 'patient', 'appointment_reminder', 'Appointment in 1 hour',
        'Your appointment with ' || _with || ' is today ' || _when || '.', r.id, 'appointment', '/patient/appointments');
      perform public.emit_user_notification(_d, 'doctor', 'appointment_reminder', 'Appointment in 1 hour',
        public.patient_display_name(r.patient_id) || ' is booked today ' || _when || '.', r.id, 'appointment', '/doctor/appointments');
      update public.patient_appointments
         set reminder_1h_sent_at = now(), reminder_24h_sent_at = coalesce(reminder_24h_sent_at, now())
       where id = r.id;
      _n := _n + 1;
    elsif r.reminder_24h_sent_at is null and _start > now() + interval '2 hours'
          and r.created_at <= _start - interval '24 hours' then
      _when := case when (_start at time zone 'Africa/Lagos')::date = ((now() at time zone 'Africa/Lagos')::date + 1)
                    then 'tomorrow' else to_char(r.requested_date, 'Dy DD Mon') end
               || ' at ' || to_char(r.requested_time, 'HH24:MI');
      perform public.emit_user_notification(_p, 'patient', 'appointment_reminder', 'Appointment ' || _when,
        'Reminder: your appointment with ' || _with || ' is ' || _when || '.', r.id, 'appointment', '/patient/appointments');
      update public.patient_appointments set reminder_24h_sent_at = now() where id = r.id;
      _n := _n + 1;
    elsif r.reminder_24h_sent_at is null then
      update public.patient_appointments set reminder_24h_sent_at = now() where id = r.id
         and ((_start <= now() + interval '2 hours') or r.created_at > _start - interval '24 hours');
    end if;
  end loop;
  _n := _n + private.queue_care_reminders();
  perform private.prune_push_outbox();
  return _n;
end;
$$;

-- Lock screen: pregnancy and surgery are private, so the generic title says neither.
create or replace function private.push_generic_title(_type text)
returns text language sql immutable set search_path = '' as $$
  select case
    when _type = 'call_in' then 'Your doctor is ready'
    when _type = 'appointment_reminder' then 'Appointment reminder'
    when _type = 'appointment' then 'Appointment update'
    when _type = 'prescription' then 'Prescription update'
    when _type = 'lab' then 'New lab result'
    when _type = 'letter' then 'New letter'
    when _type = 'billing' then 'Billing update'
    when _type = 'message' then 'New message'
    when _type = 'care' then 'Care plan reminder'
    when _type = 'family' then 'Family update'
    else 'HealingNet update' end
$$;
revoke all on function private.push_generic_title(text) from public, anon, authenticated;

-- Family labels ("Tobi: ...") for the new reference types too.
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
    when 'checkin'     then (select patient_id from public.patient_checkins where id = new.reference_id)
    when 'surgery'     then (select patient_id from public.surgery_records where id = new.reference_id)
    when 'care_item'   then (select patient_id from public.care_plan_items where id = new.reference_id)
    when 'care_plan'   then coalesce((select patient_id from public.maternity_records where id = new.reference_id),
                                     (select patient_id from public.surgery_records where id = new.reference_id))
    else null end;
  if _pid is null then return new; end if;
  new.subject_patient_id := _pid;
  select * into _p from public.patients where id = _pid;
  if _p.user_id is distinct from new.user_id and new.reference_type <> 'family_document' then
    new.title := left(coalesce(nullif(btrim(_p.first_name), ''), 'Family member') || ': ' || new.title, 200);
  end if;
  return new;
end;
$$;
