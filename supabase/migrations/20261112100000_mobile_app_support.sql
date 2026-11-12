-- =============================================================================
-- Mobile app support (patient app v0.1)
--
--   1. Push devices: the app registers its Expo push token after sign-in.
--   2. Push outbox: every in-app notification (user_notifications) is also queued
--      as a push for each of the user's devices, if their preferences allow.
--      A worker (edge function push-worker, run every minute) sends the queue.
--      By default the lock-screen text is generic ("Appointment update"), so no
--      health details show on a locked phone. Users can turn details on.
--   3. Appointment reminders: 24 hours and 1 hour before an accepted appointment
--      (run every 5 minutes by a scheduled job).
--   4. Account deletion for patients (required by Google Play and the App Store).
--      Records that hospitals hold stay with those hospitals; HealingNet removes
--      the login, contact details and anything not held by a hospital.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Push devices
-- -----------------------------------------------------------------------------
create table public.push_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique
    check (length(token) <= 200 and (token like 'ExponentPushToken[%]' or token like 'ExpoPushToken[%]')),
  platform text not null check (platform in ('android', 'ios')),
  app_version text check (app_version is null or length(app_version) <= 40),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  disabled_at timestamptz
);
create index idx_push_devices_user on public.push_devices (user_id) where disabled_at is null;

-- Called by the app after sign-in and on every start. A token moves to the
-- signed-in user (a shared phone, a new account); at most 10 active devices each.
create or replace function public.register_push_device(p_token text, p_platform text, p_app_version text default null)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  insert into public.push_devices (user_id, token, platform, app_version)
  values (_uid, btrim(p_token), p_platform, nullif(left(btrim(coalesce(p_app_version, '')), 40), ''))
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, app_version = excluded.app_version,
        last_seen_at = now(), disabled_at = null;
  -- Keep the 10 most recently seen devices active.
  update public.push_devices set disabled_at = now()
   where user_id = _uid and disabled_at is null
     and id not in (select id from public.push_devices where user_id = _uid and disabled_at is null
                     order by last_seen_at desc limit 10);
end;
$$;

-- Called on sign-out so a shared phone stops receiving the previous user's alerts.
create or replace function public.unregister_push_device(p_token text)
returns void
language sql volatile security definer
set search_path = ''
as $$
  delete from public.push_devices where token = btrim(p_token) and user_id = auth.uid();
$$;

-- -----------------------------------------------------------------------------
-- 2. Push preferences and the push outbox
-- -----------------------------------------------------------------------------
alter table public.notification_preferences
  add column if not exists push_enabled boolean not null default true,
  add column if not exists push_appointments boolean not null default true,
  add column if not exists push_prescriptions boolean not null default true,
  add column if not exists push_lab_results boolean not null default true,
  add column if not exists push_other boolean not null default true,
  add column if not exists push_show_details boolean not null default false;

create table public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.push_devices(id) on delete cascade,
  notification_id uuid references public.user_notifications(id) on delete cascade,
  title text not null,
  body text,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  last_error text,
  send_after timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_push_outbox_pending on public.push_outbox (send_after) where status in ('pending', 'sending');

-- Notification type -> preference group and generic lock-screen text.
create or replace function private.push_category(_type text)
returns text language sql immutable set search_path = '' as $$
  select case
    when _type in ('appointment', 'appointment_reminder', 'call_in') then 'appointments'
    when _type = 'prescription' then 'prescriptions'
    when _type = 'lab' then 'lab_results'
    else 'other' end
$$;

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
    else 'HealingNet update' end
$$;

-- AFTER INSERT on user_notifications: queue one push per active device.
create or replace function private.queue_push_for_notification()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  _p public.notification_preferences;
  _cat text := private.push_category(new.type);
  _details boolean;
begin
  select * into _p from public.notification_preferences where user_id = new.user_id;
  -- No preferences row = defaults (push on, details off).
  if _p.user_id is not null then
    if not _p.push_enabled then return new; end if;
    if (_cat = 'appointments' and not _p.push_appointments)
       or (_cat = 'prescriptions' and not _p.push_prescriptions)
       or (_cat = 'lab_results' and not _p.push_lab_results)
       or (_cat = 'other' and not _p.push_other) then
      return new;
    end if;
  end if;
  _details := coalesce(_p.push_show_details, false);

  insert into public.push_outbox (device_id, notification_id, title, body, data)
  select d.id, new.id,
         case when _details then left(new.title, 120) else private.push_generic_title(new.type) end,
         case when _details then left(new.message, 300) else 'Open HealingNet to see the details.' end,
         jsonb_build_object('notification_id', new.id, 'url', new.action_url, 'type', new.type)
    from public.push_devices d
   where d.user_id = new.user_id and d.disabled_at is null;
  return new;
end;
$$;
create trigger trg_queue_push after insert on public.user_notifications
  for each row execute function private.queue_push_for_notification();

-- Worker side (service role only), same shape as the email outbox.
create or replace function public.push_outbox_claim(p_limit int default 100)
returns table (id uuid, token text, title text, body text, data jsonb)
language plpgsql volatile security definer
set search_path = ''
as $$
begin
  return query
  with c as (
    update public.push_outbox o
       set status = 'sending', locked_at = now(), attempts = o.attempts + 1
     where o.id in (
       select x.id from public.push_outbox x
        where x.send_after <= now()
          and (x.status = 'pending' or (x.status = 'sending' and x.locked_at < now() - interval '10 minutes'))
        order by x.created_at
        limit least(greatest(coalesce(p_limit, 100), 1), 500)
        for update skip locked)
    returning o.id, o.device_id, o.title, o.body, o.data)
  select c.id, d.token, c.title, c.body, c.data
    from c join public.push_devices d on d.id = c.device_id;
end;
$$;

-- p_result: 'sent' | 'error' | 'invalid_token' (the device is turned off, no retry).
create or replace function public.push_outbox_finish(p_id uuid, p_result text, p_error text default null)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare _dev uuid;
begin
  if p_result not in ('sent', 'error', 'invalid_token') then raise exception 'Invalid result'; end if;
  update public.push_outbox o
     set status = case p_result when 'sent' then 'sent' when 'invalid_token' then 'skipped'
                   else case when o.attempts >= 5 then 'failed' else 'pending' end end,
         sent_at = case when p_result = 'sent' then now() end,
         last_error = case when p_result <> 'sent' then left(p_error, 200) end,
         send_after = case when p_result = 'error' then now() + make_interval(mins => o.attempts * o.attempts) else o.send_after end,
         locked_at = null
   where o.id = p_id
  returning device_id into _dev;
  if p_result = 'invalid_token' and _dev is not null then
    update public.push_devices set disabled_at = now() where id = _dev;
    update public.push_outbox set status = 'skipped', last_error = 'device_disabled'
     where device_id = _dev and status = 'pending';
  end if;
end;
$$;

-- Old rows are removed after 30 days (called by the reminders job).
create or replace function private.prune_push_outbox()
returns void language sql volatile security definer set search_path = '' as $$
  delete from public.push_outbox where created_at < now() - interval '30 days';
$$;

-- -----------------------------------------------------------------------------
-- 3. Appointment reminders (24 hours and 1 hour before, Nigerian time)
-- -----------------------------------------------------------------------------
alter table public.patient_appointments
  add column if not exists reminder_24h_sent_at timestamptz,
  add column if not exists reminder_1h_sent_at timestamptz;

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
      -- The 24-hour reminder is no longer useful once the 1-hour one has gone.
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
      -- Booked less than 24 hours ahead: skip the 24-hour reminder.
      update public.patient_appointments set reminder_24h_sent_at = now() where id = r.id
         and ((_start <= now() + interval '2 hours') or r.created_at > _start - interval '24 hours');
    end if;
  end loop;
  perform private.prune_push_outbox();
  return _n;
end;
$$;

-- A rescheduled appointment gets fresh reminders.
create or replace function private.reset_appointment_reminders()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.requested_date is distinct from old.requested_date or new.requested_time is distinct from old.requested_time then
    new.reminder_24h_sent_at := null;
    new.reminder_1h_sent_at := null;
  end if;
  return new;
end;
$$;
create trigger trg_reset_appointment_reminders before update on public.patient_appointments
  for each row execute function private.reset_appointment_reminders();

-- -----------------------------------------------------------------------------
-- 4. Patient account deletion
--    Step 1 (this function, called with the patient's own session by the
--    delete-account edge function): cancel what is still open and remove or
--    strip the patient's data. Step 2 (the edge function, service role): delete
--    the login itself. patients.user_id is ON DELETE SET NULL, so a profile that
--    hospitals hold stays with them, detached.
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
begin
  if _uid is null then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from public.doctors where user_id = _uid)
     or exists (select 1 from public.hospital_staff where user_id = _uid)
     or exists (select 1 from public.pharmacy_members where user_id = _uid)
     or exists (select 1 from public.platform_admins where user_id = _uid) then
    raise exception 'Doctor, hospital, pharmacy and admin accounts are closed through HealingNet support';
  end if;
  select id into _pid from public.patients where user_id = _uid;
  if _pid is null then
    return jsonb_build_object('patient', false, 'held_by_hospitals', false);
  end if;

  -- Close anything still open.
  update public.patient_appointments set status = 'cancelled'
   where patient_id = _pid and status in ('pending', 'accepted');
  update public.rx_pharmacy_requests set status = 'cancelled'
   where patient_id = _pid and status in ('sent', 'available', 'partial');
  delete from public.patient_share_codes where patient_id = _pid;

  _held := exists (select 1 from public.hospital_patients where patient_id = _pid);

  if not _held then
    -- Not registered at any hospital: remove the profile and everything under it.
    begin
      delete from public.patients where id = _pid;
      return jsonb_build_object('patient', true, 'held_by_hospitals', false);
    exception when foreign_key_violation then
      _held := true;   -- some record is held elsewhere: keep the profile, stripped
    end;
  end if;

  -- Held by hospitals: they keep their clinical records and the identity they
  -- registered; HealingNet removes contact details, photo and insurance.
  update public.patients
     set email = null, phone = null, address = null, emergency_contact_name = null,
         emergency_contact_phone = null, insurance_provider = null, insurance_policy_number = null,
         profile_image_url = null
   where id = _pid;
  return jsonb_build_object('patient', true, 'held_by_hospitals', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- Security
-- -----------------------------------------------------------------------------
alter table public.push_devices enable row level security;
alter table public.push_outbox enable row level security;
grant all on public.push_devices, public.push_outbox to service_role;

grant select (id, platform, app_version, created_at, last_seen_at, disabled_at) on public.push_devices to authenticated;
create policy "Users see their own devices" on public.push_devices
  for select to authenticated using (user_id = auth.uid());
-- push_outbox: no browser access.

revoke all on function
  public.register_push_device(text, text, text), public.unregister_push_device(text),
  public.push_outbox_claim(int), public.push_outbox_finish(uuid, text, text),
  public.queue_appointment_reminders(), public.delete_my_patient_data()
from public, anon, authenticated;
revoke all on function private.push_category(text), private.push_generic_title(text),
  private.prune_push_outbox() from public, anon, authenticated;

grant execute on function public.register_push_device(text, text, text), public.unregister_push_device(text),
  public.delete_my_patient_data() to authenticated;
grant execute on function public.push_outbox_claim(int), public.push_outbox_finish(uuid, text, text),
  public.queue_appointment_reminders() to service_role;
