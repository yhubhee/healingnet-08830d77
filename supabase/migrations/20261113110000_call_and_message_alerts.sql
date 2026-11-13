-- =============================================================================
-- Call and message alerts (patient app 0.2 follow-up)
--   1. When the doctor joins a video appointment (call_started_at is first set),
--      the patient is notified: "Your doctor is ready". The push worker sends it
--      to their phone like any other notification.
--   2. A new message notifies the recipient. The notification never contains
--      the message text, only who it is from; repeated messages from the same
--      person within 10 minutes do not notify again while the first is unread.
--   3. Messages join the Realtime publication, so open chats update live
--      instead of polling (row level security still decides who sees what).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. "Your doctor is ready"
-- -----------------------------------------------------------------------------
create or replace function private.notify_call_started()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  _doc text;
begin
  if old.call_started_at is null and new.call_started_at is not null and new.call_ended_at is null then
    select 'Dr ' || btrim(first_name || ' ' || last_name) into _doc from public.doctors where id = new.doctor_id;
    perform public.emit_user_notification(public.patient_user_id(new.patient_id), 'patient', 'call_in',
      'Your doctor is ready',
      coalesce(_doc, 'Your doctor') || ' has started your video call. Join now.',
      new.id, 'appointment', '/patient/appointments');
  end if;
  return new;
end;
$$;
create trigger trg_notify_call_started after update of call_started_at on public.patient_appointments
  for each row execute function private.notify_call_started();

-- -----------------------------------------------------------------------------
-- 2. New message
-- -----------------------------------------------------------------------------
create or replace function private.notify_new_message()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  _from text;
  _audience text;
  _url text;
begin
  -- Who is the recipient? Decides where the notification leads.
  if exists (select 1 from public.patients where user_id = new.to_user_id) then
    _audience := 'patient'; _url := '/patient/messages';
  elsif exists (select 1 from public.doctors where user_id = new.to_user_id) then
    _audience := 'doctor'; _url := '/doctor/messages';
  else
    return new;   -- no messages inbox for other account types
  end if;

  -- Don't notify again for a burst of messages from the same sender.
  if exists (select 1 from public.user_notifications n
              where n.user_id = new.to_user_id and n.type = 'message' and n.reference_id = new.from_user_id
                and not n.is_read and n.created_at > now() - interval '10 minutes') then
    return new;
  end if;

  select 'Dr ' || btrim(first_name || ' ' || last_name) into _from from public.doctors where user_id = new.from_user_id;
  if _from is null then
    select btrim(first_name || ' ' || last_name) into _from from public.patients where user_id = new.from_user_id;
  end if;
  if _from is null then
    select btrim(first_name || ' ' || last_name) into _from from public.hospital_staff where user_id = new.from_user_id limit 1;
  end if;

  perform public.emit_user_notification(new.to_user_id, _audience, 'message', 'New message',
    'From ' || coalesce(nullif(_from, ''), 'your care team') || '. Open HealingNet to read it.',
    new.from_user_id, 'user', _url);
  return new;
end;
$$;
create trigger trg_notify_new_message after insert on public.patient_messages
  for each row execute function private.notify_new_message();

-- Generic lock-screen title for message pushes (details stay off by default).
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
    else 'HealingNet update' end
$$;
revoke all on function private.push_generic_title(text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 3. Live chat updates
-- -----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'patient_messages') then
    alter publication supabase_realtime add table public.patient_messages;
  end if;
end $$;
