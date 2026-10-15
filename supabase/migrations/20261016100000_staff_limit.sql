-- =============================================================================
-- Team-member limit by plan
--
-- EMR Essentials (paid or free trial) allows up to 25 team members.
-- Telemedicine Suite allows unlimited team members.
--
-- A team member is either:
--   - an active hospital_staff row (admins, nurses, reception, lab, pharmacy, managers,
--     medical officers), or
--   - an active doctor link (hospital_doctors with status 'active').
--
-- Seats are also held by pending invitations, so a hospital can't send 40 invites on a
-- 25-seat plan:
--   - unexpired, unaccepted staff invites (hospital_staff_invites)
--   - doctor invitations still waiting for an answer (hospital_doctors status 'pending')
--
-- Two checks:
--   1. Creating a new invitation (staff invite or doctor invite) needs a free seat,
--      counting everyone active plus every pending invitation.
--   2. Someone becoming active (accepting, or a staff member being reactivated) needs
--      the number of ACTIVE team members to stay within the limit. Their invitation
--      already held the seat.
--
-- Nobody is ever removed automatically. If a hospital drops from Telemedicine to EMR
-- with more than 25 team members, everyone keeps access; the hospital just can't add
-- anyone until it is back under the limit.
-- =============================================================================

-- The single place the number lives.
create or replace function private.emr_seat_limit()
returns int
language sql immutable
set search_path = ''
as $$ select 25 $$;

-- null = unlimited.
create or replace function private.hospital_seat_limit(_hospital_id uuid)
returns int
language sql stable security definer
set search_path = ''
as $$
  select case when private.hospital_has_plan(_hospital_id, 'telemedicine') then null
              else private.emr_seat_limit() end
$$;

create or replace function private.hospital_active_staff_count(_hospital_id uuid)
returns int
language sql stable security definer
set search_path = ''
as $$
  select count(*)::int from public.hospital_staff
   where hospital_id = _hospital_id and is_active
$$;

create or replace function private.hospital_active_doctor_count(_hospital_id uuid)
returns int
language sql stable security definer
set search_path = ''
as $$
  select count(*)::int from public.hospital_doctors
   where hospital_id = _hospital_id and status = 'active' and is_active
$$;

-- Pending staff invites for people who are not already active staff here,
-- plus doctor invitations waiting for an answer.
create or replace function private.hospital_pending_invite_count(_hospital_id uuid)
returns int
language sql stable security definer
set search_path = ''
as $$
  select
    (select count(*)::int from public.hospital_staff_invites i
      where i.hospital_id = _hospital_id and i.accepted_at is null and i.expires_at > now()
        and not exists (select 1 from public.hospital_staff s
                         where s.hospital_id = i.hospital_id and s.is_active and lower(s.email) = i.email))
    +
    (select count(*)::int from public.hospital_doctors d
      where d.hospital_id = _hospital_id and d.status = 'pending')
$$;

create or replace function private.hospital_seats_held(_hospital_id uuid)
returns int
language sql stable security definer
set search_path = ''
as $$
  select private.hospital_active_staff_count(_hospital_id)
       + private.hospital_active_doctor_count(_hospital_id)
       + private.hospital_pending_invite_count(_hospital_id)
$$;

-- -----------------------------------------------------------------------------
-- 1. Staff: hard rule when a staff row becomes active (direct insert, invite
--    acceptance, reactivation).
-- -----------------------------------------------------------------------------
create or replace function private.enforce_staff_seat_limit()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  _limit int;
  _active int;
begin
  if not new.is_active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.is_active and old.hospital_id = new.hospital_id then
    return new;
  end if;

  -- Serialise additions per hospital so two simultaneous joins can't both take the last seat.
  perform 1 from public.hospitals where id = new.hospital_id for update;

  _limit := private.hospital_seat_limit(new.hospital_id);
  if _limit is null then
    return new;
  end if;

  select count(*)::int into _active from public.hospital_staff
   where hospital_id = new.hospital_id and is_active and id is distinct from new.id;
  _active := _active + private.hospital_active_doctor_count(new.hospital_id);

  if _active >= _limit then
    raise exception 'This hospital has reached its limit of % team members (staff and doctors) on EMR Essentials. Deactivate someone or upgrade to Telemedicine Suite for unlimited team members.', _limit
      using errcode = 'P0001', hint = 'staff_limit_reached';
  end if;
  return new;
end;
$$;

create trigger enforce_staff_seat_limit
  before insert or update of is_active, hospital_id on public.hospital_staff
  for each row execute function private.enforce_staff_seat_limit();

-- -----------------------------------------------------------------------------
-- 2. Doctors: inviting a doctor needs a free seat (counting pending invitations);
--    a doctor accepting needs the active count to stay within the limit.
--    Named after guard_hospital_doctors so it runs after that trigger has set
--    status/is_active on insert.
-- -----------------------------------------------------------------------------
create or replace function private.enforce_doctor_seat_limit()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  _limit int;
  _active int;
begin
  if tg_op = 'UPDATE' then
    -- Only the move to active matters (respond_to_invitation accepting).
    if not (new.status = 'active' and new.is_active)
       or (old.status = 'active' and old.is_active and old.hospital_id = new.hospital_id) then
      return new;
    end if;
  elsif new.status not in ('pending', 'active') then
    return new;
  end if;

  perform 1 from public.hospitals where id = new.hospital_id for update;
  _limit := private.hospital_seat_limit(new.hospital_id);
  if _limit is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A new invitation: everyone active plus every pending invitation holds a seat.
    if private.hospital_seats_held(new.hospital_id) >= _limit then
      raise exception 'Your plan allows up to % team members (staff and doctors), including pending invites. Remove someone, cancel an invite, or upgrade to Telemedicine Suite for unlimited team members.', _limit
        using errcode = 'P0001', hint = 'staff_limit_reached';
    end if;
  else
    -- Accepting: the invitation already held the seat; keep active members within the limit.
    select count(*)::int into _active from public.hospital_doctors
     where hospital_id = new.hospital_id and status = 'active' and is_active and id is distinct from new.id;
    _active := _active + private.hospital_active_staff_count(new.hospital_id);
    if _active >= _limit then
      raise exception 'This hospital has reached its limit of % team members on its current plan, so the invitation can''t be accepted right now. Ask the hospital to free a seat or upgrade.', _limit
        using errcode = 'P0001', hint = 'staff_limit_reached';
    end if;
  end if;
  return new;
end;
$$;

create trigger limit_hospital_doctor_seats
  before insert or update of status, is_active, hospital_id on public.hospital_doctors
  for each row execute function private.enforce_doctor_seat_limit();

-- -----------------------------------------------------------------------------
-- 3. Friendly check when inviting staff (counts pending invitations as seats).
--    Same signature and behaviour as before, plus the seat check.
-- -----------------------------------------------------------------------------
create or replace function public.invite_staff(_hospital_id uuid, _email text, _role text,
                                               _first_name text default null, _last_name text default null)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _mail text := lower(btrim(coalesce(_email, '')));
  _id uuid;
  _limit int;
  _already_counted boolean;
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

  perform 1 from public.hospitals where id = _hospital_id for update;
  _limit := private.hospital_seat_limit(_hospital_id);
  if _limit is not null then
    -- Re-inviting someone who already holds a seat (active, or a live pending invite) is fine.
    select exists (select 1 from public.hospital_staff s
                    where s.hospital_id = _hospital_id and s.is_active and lower(s.email) = _mail)
        or exists (select 1 from public.hospital_staff_invites i
                    where i.hospital_id = _hospital_id and i.email = _mail
                      and i.accepted_at is null and i.expires_at > now())
      into _already_counted;
    if not _already_counted and private.hospital_seats_held(_hospital_id) >= _limit then
      raise exception 'Your plan allows up to % team members (staff and doctors), including pending invites. Remove someone, cancel an invite, or upgrade to Telemedicine Suite for unlimited team members.', _limit
        using errcode = 'P0001', hint = 'staff_limit_reached';
    end if;
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

-- -----------------------------------------------------------------------------
-- 4. Accepting staff invites: skip (don't fail) an invite whose hospital is full, so
--    one full hospital doesn't stop the user joining the others. It stays pending.
-- -----------------------------------------------------------------------------
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
  _hint text;
begin
  if _uid is null then
    return _joined;
  end if;
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
    begin
      insert into public.hospital_staff (user_id, hospital_id, first_name, last_name, email, role, is_active)
      values (_uid, _inv.hospital_id,
              coalesce(_inv.first_name, nullif(btrim(_meta->>'first_name'), ''), split_part(_mail, '@', 1)),
              coalesce(_inv.last_name, nullif(btrim(_meta->>'last_name'), ''), ''),
              _mail, _inv.role, true)
      on conflict (user_id, hospital_id)
      do update set role = excluded.role, is_active = true;

      update public.hospital_staff_invites set accepted_at = now() where id = _inv.id;
      _joined := _joined || _inv.hospital_id;
    exception when sqlstate 'P0001' then
      -- Hospital is at its limit: leave the invite pending. Anything else is re-raised.
      get stacked diagnostics _hint = pg_exception_hint;
      if _hint is distinct from 'staff_limit_reached' then
        raise;
      end if;
    end;
  end loop;
  return _joined;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Usage for the hospital's team screen: "14 of 25 team seats used".
-- -----------------------------------------------------------------------------
create or replace function public.hospital_seat_usage(_hospital_id uuid)
returns table (active_staff int, active_doctors int, pending_invites int, seat_limit int)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_hospital_staff(_hospital_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return query
    select private.hospital_active_staff_count(_hospital_id),
           private.hospital_active_doctor_count(_hospital_id),
           private.hospital_pending_invite_count(_hospital_id),
           private.hospital_seat_limit(_hospital_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Cancel a pending staff invite (frees its seat). Hospital admins only.
--    Pending doctor invitations are cancelled by removing the doctor link, as today.
-- -----------------------------------------------------------------------------
create or replace function public.cancel_staff_invite(_invite_id uuid)
returns void
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _h uuid;
begin
  select hospital_id into _h from public.hospital_staff_invites
   where id = _invite_id and accepted_at is null;
  if _h is null or auth.uid() is null or not private.is_hospital_admin(_h) then
    raise exception 'Invite not found' using errcode = '42501';
  end if;
  delete from public.hospital_staff_invites where id = _invite_id;
end;
$$;

revoke all on function private.emr_seat_limit() from public, anon, authenticated;
revoke all on function private.hospital_seat_limit(uuid) from public, anon, authenticated;
revoke all on function private.hospital_active_staff_count(uuid) from public, anon, authenticated;
revoke all on function private.hospital_active_doctor_count(uuid) from public, anon, authenticated;
revoke all on function private.hospital_pending_invite_count(uuid) from public, anon, authenticated;
revoke all on function private.hospital_seats_held(uuid) from public, anon, authenticated;
revoke all on function private.enforce_staff_seat_limit() from public, anon, authenticated;
revoke all on function private.enforce_doctor_seat_limit() from public, anon, authenticated;
revoke all on function public.hospital_seat_usage(uuid) from public, anon;
grant execute on function public.hospital_seat_usage(uuid) to authenticated;
revoke all on function public.cancel_staff_invite(uuid) from public, anon;
grant execute on function public.cancel_staff_invite(uuid) to authenticated;
