-- =============================================================================
-- Hospital locations on a map
--   1. A hospital's location is a pin on the map (latitude/longitude), checked to
--      be inside Nigeria. Sign-up can send the pin, city and state, so a new
--      hospital is on the map from the start; Settings can move it later.
--   2. The booking list returns each hospital's pin as well as the distance, so
--      the app and website can show hospitals on a map; visits carry the
--      hospital's address and pin for "Directions".
-- =============================================================================

create or replace function private.in_nigeria(_lat numeric, _lng numeric)
returns boolean language sql immutable set search_path = '' as $$
  select _lat is not null and _lng is not null and _lat between 4.0 and 14.0 and _lng between 2.5 and 14.8
$$;
revoke all on function private.in_nigeria(numeric, numeric) from public, anon, authenticated;

-- Text from sign-up metadata to a coordinate, or null if it isn't a number.
create or replace function private.meta_coord(_v text)
returns numeric language sql immutable set search_path = '' as $$
  select case when btrim(coalesce(_v, '')) ~ '^-?[0-9]{1,3}(\.[0-9]{1,8})?$' then round(btrim(_v)::numeric, 6) end
$$;
revoke all on function private.meta_coord(text) from public, anon, authenticated;

alter table public.hospitals add column if not exists location_updated_at timestamptz;
grant select (location_updated_at) on public.hospitals to authenticated;

-- Both or neither, and inside Nigeria. NOT VALID: existing rows are left alone,
-- every new or changed location is checked.
alter table public.hospitals add constraint hospitals_location_in_nigeria
  check ((lat is null and lng is null)
         or (lat is not null and lng is not null and lat between 4.0 and 14.0 and lng between 2.5 and 14.8)) not valid;

create or replace function private.hospital_location_stamp()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.lat is distinct from old.lat or new.lng is distinct from old.lng then
    new.location_updated_at := case when new.lat is null then null else now() end;
  end if;
  return new;
end;
$$;
create trigger trg_hospital_location_stamp before update of lat, lng on public.hospitals
  for each row execute function private.hospital_location_stamp();

-- Sign-up: also takes hospital_city, hospital_state, hospital_lat and hospital_lng.
create or replace function private.provision_user(_uid uuid, _email text, _meta jsonb)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  _role text := _meta->>'role';
  _hid uuid;
  _pid uuid;
  _code text;
  _lat numeric;
  _lng numeric;
begin
  if _role = 'patient' then
    insert into public.patients (user_id, first_name, last_name, email, phone)
    values (_uid,
            coalesce(nullif(trim(_meta->>'first_name'), ''), 'Patient'),
            coalesce(trim(_meta->>'last_name'), ''),
            _email,
            nullif(trim(_meta->>'phone'), ''))
    on conflict (user_id) do nothing;

  elsif _role = 'doctor' then
    insert into public.doctors (user_id, first_name, last_name, email, phone, specialty, verification_status)
    values (_uid,
            coalesce(nullif(trim(_meta->>'first_name'), ''), 'Doctor'),
            coalesce(trim(_meta->>'last_name'), ''),
            _email,
            nullif(trim(_meta->>'phone'), ''),
            coalesce(nullif(trim(_meta->>'specialty'), ''), 'General Practice'),
            'unverified')
    on conflict (user_id) do nothing;

  elsif _role = 'hospital' then
    if exists (select 1 from public.hospital_staff where user_id = _uid) then
      return _role;
    end if;
    _lat := private.meta_coord(_meta->>'hospital_lat');
    _lng := private.meta_coord(_meta->>'hospital_lng');
    if not private.in_nigeria(_lat, _lng) then _lat := null; _lng := null; end if;
    insert into public.hospitals (name, address, city, state, lat, lng, location_updated_at, phone, email, active_plan, subscription_status, trial_ends_at)
    values (coalesce(nullif(trim(_meta->>'hospital_name'), ''), 'New hospital'),
            nullif(trim(_meta->>'hospital_address'), ''),
            nullif(left(trim(_meta->>'hospital_city'), 80), ''),
            nullif(left(trim(_meta->>'hospital_state'), 40), ''),
            _lat, _lng, case when _lat is not null then now() end,
            nullif(trim(_meta->>'hospital_phone'), ''),
            _email,
            'emr', 'trialing', now() + interval '30 days')
    returning id into _hid;

    insert into public.hospital_staff (user_id, hospital_id, first_name, last_name, email, role, is_active)
    values (_uid, _hid,
            coalesce(nullif(trim(_meta->>'first_name'), ''), 'Admin'),
            coalesce(trim(_meta->>'last_name'), ''),
            coalesce(_email, ''),
            'admin', true);

    insert into public.hospital_subscriptions (hospital_id, plan, status, billing_cycle, started_at, expires_at)
    values (_hid, 'emr', 'trialing', 'monthly', now(), now() + interval '30 days');

  elsif _role = 'pharmacy' then
    if exists (select 1 from public.pharmacy_members where user_id = _uid) then
      return _role;
    end if;
    loop
      _code := private.random_code(8);
      exit when not exists (select 1 from public.pharmacies where join_code = _code);
    end loop;
    insert into public.pharmacies (name, address, city, state, phone, email, premises_licence_no, join_code)
    values (coalesce(nullif(left(trim(_meta->>'pharmacy_name'), 120), ''), 'New pharmacy'),
            nullif(left(trim(_meta->>'pharmacy_address'), 300), ''),
            nullif(left(trim(_meta->>'pharmacy_city'), 80), ''),
            nullif(left(trim(_meta->>'pharmacy_state'), 80), ''),
            nullif(left(trim(_meta->>'pharmacy_phone'), 30), ''),
            _email,
            nullif(left(trim(_meta->>'premises_licence_no'), 60), ''),
            _code)
    returning id into _pid;
    insert into public.pharmacy_members (pharmacy_id, user_id, first_name, last_name, email, phone, role, pcn_reg_no, licence_expiry)
    values (_pid, _uid,
            coalesce(nullif(trim(_meta->>'first_name'), ''), 'Owner'),
            coalesce(trim(_meta->>'last_name'), ''),
            _email,
            nullif(left(trim(_meta->>'phone'), 30), ''),
            'owner',
            nullif(left(trim(_meta->>'pcn_reg_no'), 60), ''),
            case when coalesce(_meta->>'licence_expiry', '') ~ '^\d{4}-\d{2}-\d{2}$' then (_meta->>'licence_expiry')::date end);

  elsif _role = 'pharmacist' then
    if exists (select 1 from public.pharmacy_members where user_id = _uid) then
      return _role;
    end if;
    select id into _pid from public.pharmacies
     where join_code = upper(btrim(coalesce(_meta->>'join_code', '')))
       and verification_status in ('pending', 'approved');
    if _pid is null then
      return null;   -- no profile; the app sends them to complete sign-up with a valid code
    end if;
    insert into public.pharmacy_members (pharmacy_id, user_id, first_name, last_name, email, phone, role, pcn_reg_no, licence_expiry)
    values (_pid, _uid,
            coalesce(nullif(trim(_meta->>'first_name'), ''), 'Pharmacist'),
            coalesce(trim(_meta->>'last_name'), ''),
            _email,
            nullif(left(trim(_meta->>'phone'), 30), ''),
            case when _meta->>'member_role' = 'assistant' then 'assistant' else 'pharmacist' end,
            nullif(left(trim(_meta->>'pcn_reg_no'), 60), ''),
            case when coalesce(_meta->>'licence_expiry', '') ~ '^\d{4}-\d{2}-\d{2}$' then (_meta->>'licence_expiry')::date end);
    perform private.notify_pharmacy(_pid, 'New team member',
      coalesce(nullif(trim(_meta->>'first_name'), ''), 'Someone') || ' joined your pharmacy and is waiting for verification',
      _pid, '/pharmacy/team');
  else
    return null;
  end if;

  return _role;
end;
$function$;


-- Booking list: the same as before, plus each hospital's pin (lat, lng) for the map.
drop function if exists public.bookable_hospitals(text, numeric, numeric, text);
create function public.bookable_hospitals(
  p_specialty text default null, p_lat numeric default null, p_lng numeric default null, p_search text default null)
returns table (
  id uuid, name text, address text, city text, state text, logo_url text,
  offers_telemedicine boolean, doctors_total bigint, doctors_in_specialty bigint, distance_km numeric,
  lat numeric, lng numeric)
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
         end as distance_km,
         h.lat::numeric, h.lng::numeric
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
revoke all on function public.bookable_hospitals(text, numeric, numeric, text) from public, anon;
grant execute on function public.bookable_hospitals(text, numeric, numeric, text) to authenticated, service_role;

-- Visits: the hospital's address and pin, for "Directions".
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
    'hospitals', (select jsonb_build_object('id', h.id, 'name', h.name, 'address', h.address, 'city', h.city,
                                            'state', h.state, 'lat', h.lat, 'lng', h.lng)
                    from public.hospitals h where h.id = _a.hospital_id),
    'review', (select jsonb_build_object('rating', r.rating, 'comment', r.comment)
                 from public.appointment_reviews r where r.appointment_id = _a.id))
$$;
revoke all on function private.visit_json(public.patient_appointments) from public, anon, authenticated;
