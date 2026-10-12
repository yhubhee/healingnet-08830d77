-- Patient share codes: a patient who signed up in the app shows a short code to
-- a hospital's front desk, and staff enter it to link that patient to their
-- hospital. No searching other hospitals' patients by name or phone.
-- Codes are 6 characters, single-use and expire after 15 minutes.

create table public.patient_share_codes (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  patient_id uuid not null references public.patients(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_hospital_id uuid references public.hospitals(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_share_codes_patient on public.patient_share_codes (patient_id);

-- Only the two functions below touch this table.
alter table public.patient_share_codes enable row level security;
revoke all on public.patient_share_codes from public, anon, authenticated;
grant all on public.patient_share_codes to service_role;

-- Patient: create a new code (any earlier unused code stops working).
create or replace function public.create_patient_share_code()
returns table (code text, expires_at timestamptz)
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _pid uuid := private.my_patient_id();
  _alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- no 0/O, 1/I/L
  _bytes bytea;
  _code text;
  _exp timestamptz := now() + interval '15 minutes';
  _recent int;
begin
  if _pid is null then
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

-- Hospital staff: link the patient behind a code to their hospital.
-- Returns the patient id, or null if the code is wrong, used or expired.
-- Failed attempts are counted; after 10 in an hour the caller is blocked for a while.
create or replace function public.link_patient_by_code(p_hospital_id uuid, p_code text)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _code text := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  _row public.patient_share_codes%rowtype;
  _fails int;
begin
  if _uid is null or not private.can_staff_work_at(p_hospital_id, 'emr') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  select count(*) into _fails from public.function_calls f
   where f.user_id = _uid and f.fn = 'link_patient_by_code:fail' and f.created_at > now() - interval '1 hour';
  if _fails >= 10 then
    raise exception 'Too many wrong codes. Please try again later.' using errcode = '54000';
  end if;

  select * into _row from public.patient_share_codes s
   where s.code = _code and s.used_at is null and s.expires_at > now()
   for update;

  if not found then
    insert into public.function_calls (user_id, fn) values (_uid, 'link_patient_by_code:fail');
    return null;
  end if;

  update public.patient_share_codes s
     set used_at = now(), used_by_hospital_id = p_hospital_id
   where s.code = _row.code;

  insert into public.hospital_patients (hospital_id, patient_id, created_by)
  values (p_hospital_id, _row.patient_id, _uid)
  on conflict (hospital_id, patient_id) do nothing;

  return _row.patient_id;
end;
$$;

revoke all on function public.create_patient_share_code() from public, anon;
revoke all on function public.link_patient_by_code(uuid, text) from public, anon;
grant execute on function public.create_patient_share_code() to authenticated;
grant execute on function public.link_patient_by_code(uuid, text) to authenticated;
