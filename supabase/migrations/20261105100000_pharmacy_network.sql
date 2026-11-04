-- =============================================================================
-- Pharmacy network: verified e-prescriptions, pharmacy accounts, send-to-pharmacy,
-- and the per-patient pharmacy fee ledger.
--
--   Phase 1  Every prescription belongs to a prescription document (rx_documents)
--            with a random verify code, a 6-month expiry and a snapshot of the
--            prescriber's details. Pharmacies and pharmacists have their own
--            accounts, verified by platform admins. A verified pharmacist
--            dispenses with one call; their details are recorded automatically.
--   Phase 2  Patients send a prescription to a verified pharmacy, the pharmacy
--            replies (stock, price, ready time), the patient collects and pays
--            at the counter. A collected request is one "patient through us" and
--            creates one fee row (fee model B). Billing stays OFF until an admin
--            turns it on, so fees are recorded at 0 and marked 'waived' until then.
--
-- HealingNet never takes payment for medicine here.
-- Every change goes through SECURITY DEFINER functions; tables are read-only to
-- browsers except where a grant says otherwise.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Prescriber details on doctors
-- -----------------------------------------------------------------------------
alter table public.doctors
  add column if not exists practice_address text,
  add column if not exists signature_data text;
alter table public.doctors drop constraint if exists doctors_signature_format;
alter table public.doctors add constraint doctors_signature_format
  check (signature_data is null
         or (signature_data like 'data:image/png;base64,%' and length(signature_data) <= 70000));
alter table public.doctors drop constraint if exists doctors_practice_address_len;
alter table public.doctors add constraint doctors_practice_address_len
  check (practice_address is null or length(practice_address) <= 300);
-- The doctor edits these on their own row (existing "Doctors update own profile" policy).
-- No SELECT grant: they are read through my_prescriber_details() and the prescription document.
grant update (practice_address, signature_data) on public.doctors to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Pharmacies and their members
-- -----------------------------------------------------------------------------
create table public.pharmacies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  address text check (address is null or length(address) <= 300),
  city text check (city is null or length(city) <= 80),
  state text check (state is null or length(state) <= 80),
  phone text check (phone is null or length(phone) <= 30),
  email text check (email is null or length(email) <= 320),
  premises_licence_no text check (premises_licence_no is null or length(premises_licence_no) <= 60),
  premises_licence_expiry date,
  superintendent_name text check (superintendent_name is null or length(superintendent_name) <= 120),
  superintendent_pcn_no text check (superintendent_pcn_no is null or length(superintendent_pcn_no) <= 60),
  join_code text not null unique,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected', 'suspended')),
  review_note text,
  reviewed_at timestamptz,
  is_listed boolean not null default true,
  paused_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_pharmacies_directory on public.pharmacies (state, city) where verification_status = 'approved' and is_listed;
create trigger trg_pharmacies_updated before update on public.pharmacies
  for each row execute function public.update_updated_at_column();

create table public.pharmacy_members (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,  -- one pharmacy per account
  first_name text not null,
  last_name text not null default '',
  email text,
  phone text,
  role text not null default 'pharmacist' check (role in ('owner', 'pharmacist', 'assistant')),
  pcn_reg_no text check (pcn_reg_no is null or length(pcn_reg_no) <= 60),
  licence_expiry date,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_pharmacy_members_pharmacy on public.pharmacy_members (pharmacy_id);
create trigger trg_pharmacy_members_updated before update on public.pharmacy_members
  for each row execute function public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 3. Helpers (about the calling user only)
-- -----------------------------------------------------------------------------
create or replace function private.my_pharmacy_member_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select m.id from public.pharmacy_members m where m.user_id = auth.uid() and m.is_active
$$;

create or replace function private.my_pharmacy_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select m.pharmacy_id from public.pharmacy_members m where m.user_id = auth.uid() and m.is_active
$$;

-- Active member of an approved pharmacy (any role, including assistants).
create or replace function private.is_working_pharmacy_member(_pharmacy_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pharmacy_members m join public.pharmacies p on p.id = m.pharmacy_id
     where m.user_id = auth.uid() and m.is_active and m.pharmacy_id = _pharmacy_id
       and p.verification_status = 'approved')
$$;

create or replace function private.is_pharmacy_owner(_pharmacy_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.pharmacy_members m
                  where m.user_id = auth.uid() and m.is_active and m.role = 'owner' and m.pharmacy_id = _pharmacy_id)
$$;

-- May dispense: verified pharmacist (or pharmacist-owner) with an in-date licence,
-- at an approved pharmacy.
create or replace function private.can_dispense()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.pharmacy_members m join public.pharmacies p on p.id = m.pharmacy_id
     where m.user_id = auth.uid() and m.is_active
       and m.role in ('owner', 'pharmacist')
       and m.verification_status = 'approved'
       and m.pcn_reg_no is not null
       and m.licence_expiry is not null and m.licence_expiry >= current_date
       and p.verification_status = 'approved')
$$;

-- Random code from a 32-letter alphabet without I, L, O, U.
create or replace function private.random_code(_len int)
returns text language plpgsql volatile set search_path = '' as $$
declare
  _a constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  _s text := '';
  _b bytea;
  _i int;
begin
  while length(_s) < _len loop
    _b := uuid_send(gen_random_uuid());
    -- bytes 0-5 and 10-15 of a v4 UUID are fully random
    foreach _i in array array[0,1,2,3,4,5,10,11,12,13,14,15] loop
      exit when length(_s) >= _len;
      _s := _s || substr(_a, (get_byte(_b, _i) % 32) + 1, 1);
    end loop;
  end loop;
  return _s;
end;
$$;

-- What a person types or scans -> the stored form ('HN-XXXXX-XXXXX').
create or replace function private.normalize_rx_code(_code text)
returns text language sql immutable set search_path = '' as $$
  select case when length(c) = 10 then 'HN-' || substr(c, 1, 5) || '-' || substr(c, 6, 5) end
    from (select translate(case when length(a) = 12 and left(a, 2) = 'HN' then substr(a, 3) else a end, 'OIL', '011') as c
            from (select regexp_replace(upper(coalesce(_code, '')), '[^0-9A-Z]', '', 'g') as a) y) x
$$;

-- -----------------------------------------------------------------------------
-- 4. Prescription documents
-- -----------------------------------------------------------------------------
create table public.rx_documents (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  patient_id uuid not null references public.patients(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  consultation_id uuid unique references public.consultations(id) on delete set null,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Snapshot at issue: name, licence, council, address, hospital, verified flag.
  prescriber jsonb not null default '{}'::jsonb,
  signature_data text,
  created_at timestamptz not null default now()
);
create index idx_rx_documents_patient on public.rx_documents (patient_id);
create index idx_rx_documents_doctor on public.rx_documents (doctor_id);

alter table public.prescriptions
  add column if not exists rx_document_id uuid references public.rx_documents(id) on delete set null,
  add column if not exists prescribed_by uuid references auth.users(id) on delete set null;
create index if not exists idx_prescriptions_rx_document on public.prescriptions (rx_document_id);

-- Find or create the document a new prescription row belongs to.
-- Rows written in one consultation share one document; other rows get their own.
create or replace function private.rx_document_for(_patient uuid, _hospital uuid, _doctor uuid, _consultation uuid)
returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  _id uuid;
  _d public.doctors;
  _h public.hospitals;
  _code text;
begin
  if _consultation is not null then
    select id into _id from public.rx_documents where consultation_id = _consultation;
    if _id is not null then return _id; end if;
  end if;

  select * into _d from public.doctors where id = _doctor;
  select * into _h from public.hospitals where id = _hospital;
  loop
    _code := 'HN-' || private.random_code(5) || '-' || private.random_code(5);
    exit when not exists (select 1 from public.rx_documents where code = _code);
  end loop;

  insert into public.rx_documents (code, patient_id, hospital_id, doctor_id, consultation_id, expires_at, prescriber, signature_data)
  values (_code, _patient, _hospital, _doctor, _consultation, now() + interval '6 months',
          jsonb_build_object(
            'doctor_name', case when _d.id is null then null else btrim(_d.first_name || ' ' || _d.last_name) end,
            'licence_number', _d.license_number,
            'licence_council', _d.license_council,
            'doctor_verified', coalesce(_d.verification_status = 'approved', false),
            'practice_address', coalesce(_d.practice_address, _h.address),
            'phone', coalesce(_d.phone, _h.phone),
            'hospital_name', _h.name,
            'hospital_address', _h.address,
            'hospital_phone', _h.phone),
          _d.signature_data)
  on conflict (consultation_id) do update set consultation_id = excluded.consultation_id
  returning id into _id;
  return _id;
end;
$$;
revoke all on function private.rx_document_for(uuid, uuid, uuid, uuid) from public, anon, authenticated;

-- BEFORE INSERT: attach to a document, record who actually wrote the row.
-- The browser cannot choose either value.
create or replace function private.rx_on_insert()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  new.prescribed_by := auth.uid();
  new.rx_document_id := private.rx_document_for(new.patient_id, new.hospital_id, new.doctor_id, new.consultation_id);
  return new;
end;
$$;
create trigger trg_rx_attach_document before insert on public.prescriptions
  for each row execute function private.rx_on_insert();

-- BEFORE UPDATE: an edit to the drug by anyone but the prescribing doctor makes the
-- row a hospital record only (no longer valid outside the hospital). A row that a
-- pharmacy has already dispensed cannot be edited.
create or replace function private.rx_on_update()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  _doctor_user uuid := public.doctor_user_id(new.doctor_id);
begin
  new.rx_document_id := old.rx_document_id;
  if (new.dosage, new.frequency, new.duration, new.instructions, new.refills_allowed)
     is distinct from (old.dosage, old.frequency, old.duration, old.instructions, old.refills_allowed) then
    if exists (select 1 from public.rx_dispenses x where x.prescription_id = old.id) then
      raise exception 'This prescription has already been dispensed. Write a new prescription instead';
    end if;
    if auth.uid() is not null and auth.uid() is distinct from _doctor_user then
      new.prescribed_by := auth.uid();
    else
      new.prescribed_by := old.prescribed_by;
    end if;
  else
    new.prescribed_by := old.prescribed_by;
  end if;
  return new;
end;
$$;

-- Existing rows: give each consultation (or row) a document. prescribed_by stays
-- unknown, so old rows are hospital records only.
do $$
declare r record;
begin
  for r in select id, patient_id, hospital_id, doctor_id, consultation_id from public.prescriptions where rx_document_id is null loop
    update public.prescriptions
       set rx_document_id = private.rx_document_for(r.patient_id, r.hospital_id, r.doctor_id, r.consultation_id)
     where id = r.id;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Requests to pharmacies, dispensing, fees, reviews, medicine checks
-- -----------------------------------------------------------------------------
create table public.rx_pharmacy_requests (
  id uuid primary key default gen_random_uuid(),
  rx_document_id uuid not null references public.rx_documents(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  status text not null default 'sent'
    check (status in ('sent', 'available', 'partial', 'unavailable', 'collected', 'cancelled')),
  patient_note text check (patient_note is null or length(patient_note) <= 500),
  pharmacy_note text check (pharmacy_note is null or length(pharmacy_note) <= 500),
  price_kobo bigint check (price_kobo is null or price_kobo >= 0),
  ready_by timestamptz,
  responded_at timestamptz,
  responded_by uuid references auth.users(id) on delete set null,
  collected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uq_rx_request_open on public.rx_pharmacy_requests (rx_document_id, pharmacy_id)
  where status in ('sent', 'available', 'partial');
create index idx_rx_requests_pharmacy on public.rx_pharmacy_requests (pharmacy_id, status, created_at desc);
create index idx_rx_requests_patient on public.rx_pharmacy_requests (patient_id, created_at desc);
create trigger trg_rx_requests_updated before update on public.rx_pharmacy_requests
  for each row execute function public.update_updated_at_column();

create table public.rx_dispenses (
  id uuid primary key default gen_random_uuid(),
  rx_document_id uuid not null references public.rx_documents(id) on delete cascade,
  prescription_id uuid not null references public.prescriptions(id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies(id),
  member_id uuid not null references public.pharmacy_members(id),
  pharmacist_name text not null,
  pcn_reg_no text not null,
  quantity text check (quantity is null or length(quantity) <= 60),
  is_refill boolean not null default false,
  request_id uuid references public.rx_pharmacy_requests(id) on delete set null,
  dispensed_at timestamptz not null default now()
);
create index idx_rx_dispenses_prescription on public.rx_dispenses (prescription_id);
create index idx_rx_dispenses_pharmacy on public.rx_dispenses (pharmacy_id, dispensed_at desc);

-- Now that rx_dispenses exists, the update guard can be attached.
create trigger trg_rx_guard_update before update on public.prescriptions
  for each row execute function private.rx_on_update();

-- Every full view of a document by a pharmacy is logged (5-year record keeping).
create table public.rx_access_log (
  id uuid primary key default gen_random_uuid(),
  rx_document_id uuid not null references public.rx_documents(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  pharmacy_id uuid references public.pharmacies(id) on delete set null,
  action text not null check (action in ('view', 'dispense')),
  at timestamptz not null default now()
);
create index idx_rx_access_log_doc on public.rx_access_log (rx_document_id, at desc);

-- Fee settings (one row) and the ledger.
create table public.pharmacy_fee_settings (
  id boolean primary key default true check (id),
  fee_kobo bigint not null default 0 check (fee_kobo >= 0),
  billing_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.pharmacy_fee_settings (id) values (true) on conflict (id) do nothing;

create table public.pharmacy_fees (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  request_id uuid not null unique references public.rx_pharmacy_requests(id) on delete cascade,
  amount_kobo bigint not null check (amount_kobo >= 0),
  status text not null check (status in ('accrued', 'waived', 'invoiced', 'paid')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_pharmacy_fees_pharmacy on public.pharmacy_fees (pharmacy_id, created_at desc);
create trigger trg_pharmacy_fees_updated before update on public.pharmacy_fees
  for each row execute function public.update_updated_at_column();

create table public.pharmacy_reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.rx_pharmacy_requests(id) on delete cascade,
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  comment text check (comment is null or length(comment) <= 500),
  created_at timestamptz not null default now()
);
create index idx_pharmacy_reviews_pharmacy on public.pharmacy_reviews (pharmacy_id);

create table public.medicine_checks (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  prescription_id uuid references public.prescriptions(id) on delete set null,
  pharmacy_id uuid references public.pharmacies(id) on delete set null,
  drug_name text check (drug_name is null or length(drug_name) <= 200),
  batch_number text check (batch_number is null or length(batch_number) <= 60),
  nafdac_no text check (nafdac_no is null or length(nafdac_no) <= 60),
  result text not null check (result in ('genuine', 'not_found', 'suspected_fake')),
  details text check (details is null or length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewed', 'closed')),
  admin_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_medicine_checks_pharmacy on public.medicine_checks (pharmacy_id, created_at desc);
create index idx_medicine_checks_open on public.medicine_checks (created_at) where status = 'open';

-- Hospital pharmacy stock: NAFDAC registration number.
alter table public.pharmacy_inventory add column if not exists nafdac_reg_no text
  check (nafdac_reg_no is null or length(nafdac_reg_no) <= 60);
grant insert (nafdac_reg_no), update (nafdac_reg_no) on public.pharmacy_inventory to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Notifications to a pharmacy's working members
-- -----------------------------------------------------------------------------
create or replace function private.notify_pharmacy(_pharmacy_id uuid, _title text, _message text, _ref uuid, _url text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare r record;
begin
  for r in select m.user_id from public.pharmacy_members m
            where m.pharmacy_id = _pharmacy_id and m.is_active loop
    perform public.emit_user_notification(r.user_id, 'pharmacy', 'prescription', _title, _message, _ref, 'rx_request', _url);
  end loop;
end;
$$;
revoke all on function private.notify_pharmacy(uuid, text, text, uuid, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Sign-up: 'pharmacy' (creates the pharmacy, caller is owner) and
--    'pharmacist' (joins a pharmacy with its join code).
--    provision_user is replaced: the three existing branches are unchanged.
-- -----------------------------------------------------------------------------
create or replace function private.provision_user(_uid uuid, _email text, _meta jsonb)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  _role text := _meta->>'role';
  _hid uuid;
  _pid uuid;
  _code text;
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
    insert into public.hospitals (name, address, phone, email, active_plan, subscription_status, trial_ends_at)
    values (coalesce(nullif(trim(_meta->>'hospital_name'), ''), 'New hospital'),
            nullif(trim(_meta->>'hospital_address'), ''),
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
$$;

create or replace function public.complete_signup(p_role text, p_data jsonb default '{}'::jsonb)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _email text;
  _r text;
begin
  if _uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_role not in ('patient', 'doctor', 'hospital', 'pharmacy', 'pharmacist') then
    raise exception 'Invalid role';
  end if;
  if exists (select 1 from public.patients where user_id = _uid)
     or exists (select 1 from public.doctors where user_id = _uid)
     or exists (select 1 from public.hospital_staff where user_id = _uid)
     or exists (select 1 from public.pharmacy_members where user_id = _uid) then
    raise exception 'This account already has a profile';
  end if;
  select email into _email from auth.users where id = _uid;
  _r := private.provision_user(_uid, _email, coalesce(p_data, '{}'::jsonb) || jsonb_build_object('role', p_role));
  if _r is null and p_role = 'pharmacist' then
    raise exception 'That pharmacy code is not valid. Ask the pharmacy owner for their code';
  end if;
  return _r;
end;
$$;

-- Before sign-up: check a join code and show the pharmacy's name.
create or replace function public.pharmacy_for_join_code(p_code text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', p.name, 'city', p.city)
    from public.pharmacies p
   where p.join_code = upper(btrim(coalesce(p_code, '')))
     and p.verification_status in ('pending', 'approved')
$$;

-- -----------------------------------------------------------------------------
-- 8. Pharmacy self-service
-- -----------------------------------------------------------------------------
create or replace function public.my_pharmacy()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  _m public.pharmacy_members;
  _p public.pharmacies;
begin
  select * into _m from public.pharmacy_members where user_id = auth.uid();
  if _m.id is null then return null; end if;
  select * into _p from public.pharmacies where id = _m.pharmacy_id;
  return jsonb_build_object(
    'member', jsonb_build_object('id', _m.id, 'first_name', _m.first_name, 'last_name', _m.last_name,
              'role', _m.role, 'pcn_reg_no', _m.pcn_reg_no, 'licence_expiry', _m.licence_expiry,
              'verification_status', _m.verification_status, 'review_note', _m.review_note,
              'is_active', _m.is_active, 'can_dispense', private.can_dispense()),
    'pharmacy', jsonb_build_object('id', _p.id, 'name', _p.name, 'address', _p.address, 'city', _p.city,
              'state', _p.state, 'phone', _p.phone, 'email', _p.email,
              'premises_licence_no', _p.premises_licence_no, 'premises_licence_expiry', _p.premises_licence_expiry,
              'superintendent_name', _p.superintendent_name, 'superintendent_pcn_no', _p.superintendent_pcn_no,
              'verification_status', _p.verification_status, 'review_note', _p.review_note,
              'is_listed', _p.is_listed, 'paused_reason', _p.paused_reason,
              'join_code', case when _m.role = 'owner' and _m.is_active then _p.join_code end));
end;
$$;

-- Owner edits pharmacy details. Changing a licence detail sends it back for review.
create or replace function public.update_my_pharmacy(p_data jsonb)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  _pid uuid := private.my_pharmacy_id();
  _p public.pharmacies;
  _licence_changed boolean;
begin
  if _pid is null or not private.is_pharmacy_owner(_pid) then
    raise exception 'Only the pharmacy owner can change these details' using errcode = '42501';
  end if;
  select * into _p from public.pharmacies where id = _pid for update;
  _licence_changed :=
       (p_data ? 'premises_licence_no' and nullif(btrim(p_data->>'premises_licence_no'), '') is distinct from _p.premises_licence_no)
    or (p_data ? 'premises_licence_expiry' and nullif(p_data->>'premises_licence_expiry', '')::date is distinct from _p.premises_licence_expiry)
    or (p_data ? 'superintendent_pcn_no' and nullif(btrim(p_data->>'superintendent_pcn_no'), '') is distinct from _p.superintendent_pcn_no);
  update public.pharmacies set
    name = case when p_data ? 'name' then coalesce(nullif(left(btrim(p_data->>'name'), 120), ''), name) else name end,
    address = case when p_data ? 'address' then nullif(left(btrim(p_data->>'address'), 300), '') else address end,
    city = case when p_data ? 'city' then nullif(left(btrim(p_data->>'city'), 80), '') else city end,
    state = case when p_data ? 'state' then nullif(left(btrim(p_data->>'state'), 80), '') else state end,
    phone = case when p_data ? 'phone' then nullif(left(btrim(p_data->>'phone'), 30), '') else phone end,
    premises_licence_no = case when p_data ? 'premises_licence_no' then nullif(left(btrim(p_data->>'premises_licence_no'), 60), '') else premises_licence_no end,
    premises_licence_expiry = case when p_data ? 'premises_licence_expiry' then nullif(p_data->>'premises_licence_expiry', '')::date else premises_licence_expiry end,
    superintendent_name = case when p_data ? 'superintendent_name' then nullif(left(btrim(p_data->>'superintendent_name'), 120), '') else superintendent_name end,
    superintendent_pcn_no = case when p_data ? 'superintendent_pcn_no' then nullif(left(btrim(p_data->>'superintendent_pcn_no'), 60), '') else superintendent_pcn_no end,
    verification_status = case when _licence_changed and verification_status in ('approved', 'rejected') then 'pending' else verification_status end
  where id = _pid;
end;
$$;

-- A member edits their own professional details. A change sends them back for review.
create or replace function public.update_my_pharmacist_details(p_pcn_reg_no text, p_licence_expiry date,
                                                                p_phone text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  _m public.pharmacy_members;
  _pcn text := nullif(left(btrim(coalesce(p_pcn_reg_no, '')), 60), '');
begin
  select * into _m from public.pharmacy_members where user_id = auth.uid() and is_active for update;
  if _m.id is null then raise exception 'No pharmacy account' using errcode = '42501'; end if;
  update public.pharmacy_members
     set pcn_reg_no = _pcn,
         licence_expiry = p_licence_expiry,
         phone = coalesce(nullif(left(btrim(coalesce(p_phone, '')), 30), ''), phone),
         verification_status = case when (_pcn, p_licence_expiry) is distinct from (_m.pcn_reg_no, _m.licence_expiry)
                                    then 'pending' else verification_status end
   where id = _m.id;
end;
$$;

-- Owner turns a member on or off (not themself).
create or replace function public.pharmacy_set_member_active(p_member_id uuid, p_active boolean)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare _m public.pharmacy_members;
begin
  select * into _m from public.pharmacy_members where id = p_member_id for update;
  if _m.id is null or not private.is_pharmacy_owner(_m.pharmacy_id) then
    raise exception 'Member not found' using errcode = '42501';
  end if;
  if _m.user_id = auth.uid() then raise exception 'You cannot deactivate yourself'; end if;
  update public.pharmacy_members set is_active = coalesce(p_active, false) where id = _m.id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 9. Doctor: prescriber details
-- -----------------------------------------------------------------------------
create or replace function public.my_prescriber_details()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('licence_number', d.license_number, 'licence_council', d.license_council,
                            'practice_address', d.practice_address, 'signature_data', d.signature_data,
                            'ready', d.license_number is not null and d.signature_data is not null
                                     and d.verification_status = 'approved')
    from public.doctors d where d.user_id = auth.uid()
$$;

-- -----------------------------------------------------------------------------
-- 10. Reading a prescription document
--     _full = drugs, patient identity, signature, dispense history.
-- -----------------------------------------------------------------------------
create or replace function private.rx_payload(_doc_id uuid, _full boolean)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  _d public.rx_documents;
  _pt public.patients;
  _items jsonb;
  _dispensable int;
  _total int;
  _cancelled int;
  _issued int;
  _status text;
  _doctor_user uuid;
begin
  select * into _d from public.rx_documents where id = _doc_id;
  if _d.id is null then return jsonb_build_object('status', 'not_found'); end if;
  _doctor_user := public.doctor_user_id(_d.doctor_id);

  select jsonb_agg(jsonb_build_object(
           'prescription_id', p.id, 'drug_name', p.drug_name, 'dosage', p.dosage, 'frequency', p.frequency,
           'duration', p.duration, 'instructions', p.instructions,
           'refills_allowed', coalesce(p.refills_allowed, 0),
           'times_dispensed', (select count(*) from public.rx_dispenses x where x.prescription_id = p.id),
           'remaining', greatest(0, 1 + coalesce(p.refills_allowed, 0)
                                    - (select count(*) from public.rx_dispenses x where x.prescription_id = p.id)),
           'status', p.status,
           'doctor_issued', p.prescribed_by is not null and p.prescribed_by = _doctor_user,
           'dispensable', p.status = 'active' and p.prescribed_by is not null and p.prescribed_by = _doctor_user
                          and (select count(*) from public.rx_dispenses x where x.prescription_id = p.id) < 1 + coalesce(p.refills_allowed, 0))
           order by p.created_at),
         count(*),
         count(*) filter (where p.status = 'cancelled'),
         count(*) filter (where p.prescribed_by is not null and p.prescribed_by = _doctor_user),
         count(*) filter (where p.status = 'active' and p.prescribed_by is not null and p.prescribed_by = _doctor_user
                          and (select count(*) from public.rx_dispenses x where x.prescription_id = p.id) < 1 + coalesce(p.refills_allowed, 0))
    into _items, _total, _cancelled, _issued, _dispensable
    from public.prescriptions p where p.rx_document_id = _d.id;

  _status := case
    when coalesce(_total, 0) = 0 or _cancelled = _total then 'cancelled'
    when not coalesce((_d.prescriber->>'doctor_verified')::boolean, false)
         or _d.prescriber->>'licence_number' is null or _issued = 0 then 'not_valid'
    when now() > _d.expires_at then 'expired'
    when _dispensable = 0 then 'used'
    else 'valid' end;

  if not _full then
    return jsonb_build_object(
      'status', _status, 'code', _d.code, 'issued_at', _d.issued_at, 'expires_at', _d.expires_at,
      'prescriber', jsonb_build_object('name', _d.prescriber->>'doctor_name',
                                       'licence_number', _d.prescriber->>'licence_number',
                                       'licence_council', _d.prescriber->>'licence_council'),
      'hospital_name', _d.prescriber->>'hospital_name',
      'full', false);
  end if;

  select * into _pt from public.patients where id = _d.patient_id;
  return jsonb_build_object(
    'status', _status, 'document_id', _d.id, 'code', _d.code, 'issued_at', _d.issued_at, 'expires_at', _d.expires_at,
    'prescriber', _d.prescriber, 'signature_data', _d.signature_data,
    'hospital_name', _d.prescriber->>'hospital_name',
    'patient', jsonb_build_object('name', btrim(_pt.first_name || ' ' || _pt.last_name),
                                  'date_of_birth', _pt.date_of_birth, 'gender', _pt.gender),
    'items', coalesce(_items, '[]'::jsonb),
    'dispenses', coalesce((select jsonb_agg(jsonb_build_object('prescription_id', x.prescription_id,
                              'pharmacy', ph.name, 'pharmacist', x.pharmacist_name, 'pcn_reg_no', x.pcn_reg_no,
                              'quantity', x.quantity, 'is_refill', x.is_refill, 'at', x.dispensed_at) order by x.dispensed_at)
                             from public.rx_dispenses x join public.pharmacies ph on ph.id = x.pharmacy_id
                            where x.rx_document_id = _d.id), '[]'::jsonb),
    'full', true);
end;
$$;
revoke all on function private.rx_payload(uuid, boolean) from public, anon, authenticated;

-- Anyone (even signed out) may check a code. Only a pharmacist who may dispense,
-- or the patient, sees the full document.
create or replace function public.rx_verify(p_code text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  _doc public.rx_documents;
  _full boolean;
begin
  select * into _doc from public.rx_documents where code = private.normalize_rx_code(p_code);
  if _doc.id is null then return jsonb_build_object('status', 'not_found'); end if;
  _full := auth.uid() is not null and (private.can_dispense() or private.is_own_patient(_doc.patient_id));
  if _full and private.can_dispense() then
    insert into public.rx_access_log (rx_document_id, user_id, pharmacy_id, action)
    values (_doc.id, auth.uid(), private.my_pharmacy_id(), 'view');
  end if;
  return private.rx_payload(_doc.id, _full);
end;
$$;

-- The patient's or prescriber's own copy (for the printable page).
create or replace function public.rx_document(p_document_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare _doc public.rx_documents;
begin
  select * into _doc from public.rx_documents where id = p_document_id;
  if _doc.id is null or not (private.is_own_patient(_doc.patient_id)
                             or (_doc.doctor_id is not null and _doc.doctor_id = private.my_doctor_id())
                             or private.can_work_at(_doc.hospital_id, 'emr')) then
    raise exception 'Prescription not found' using errcode = '42501';
  end if;
  return private.rx_payload(_doc.id, true);
end;
$$;

-- -----------------------------------------------------------------------------
-- 11. Dispensing at a pharmacy
--     p_items = [{"prescription_id": "...", "quantity": "2 packs"}, ...]
-- -----------------------------------------------------------------------------
create or replace function public.rx_dispense(p_code text, p_items jsonb)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  _doc public.rx_documents;
  _m public.pharmacy_members;
  _ph public.pharmacies;
  _req public.rx_pharmacy_requests;
  _it jsonb;
  _rx public.prescriptions;
  _done int;
  _doctor_user uuid;
  _count int := 0;
  _fee public.pharmacy_fee_settings;
begin
  if not private.can_dispense() then
    raise exception 'Only a verified pharmacist with an in-date licence can dispense' using errcode = '42501';
  end if;
  select * into _m from public.pharmacy_members where user_id = auth.uid() and is_active;
  select * into _ph from public.pharmacies where id = _m.pharmacy_id;

  select * into _doc from public.rx_documents where code = private.normalize_rx_code(p_code) for update;
  if _doc.id is null then raise exception 'Prescription not found'; end if;
  if now() > _doc.expires_at then raise exception 'This prescription expired on %', to_char(_doc.expires_at, 'DD Mon YYYY'); end if;
  if not coalesce((_doc.prescriber->>'doctor_verified')::boolean, false) or _doc.prescriber->>'licence_number' is null then
    raise exception 'This prescription is not valid for dispensing outside the hospital';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Choose at least one medicine to dispense';
  end if;
  _doctor_user := public.doctor_user_id(_doc.doctor_id);

  for _it in select * from jsonb_array_elements(p_items) loop
    select * into _rx from public.prescriptions
     where id = (_it->>'prescription_id')::uuid and rx_document_id = _doc.id for update;
    if _rx.id is null then raise exception 'A medicine on this list is not on the prescription'; end if;
    if _rx.status <> 'active' then raise exception '% is %', _rx.drug_name, _rx.status; end if;
    if _rx.prescribed_by is null or _rx.prescribed_by is distinct from _doctor_user then
      raise exception '% was not written by the prescribing doctor and cannot be dispensed here', _rx.drug_name;
    end if;
    select count(*) into _done from public.rx_dispenses where prescription_id = _rx.id;
    if _done >= 1 + coalesce(_rx.refills_allowed, 0) then
      raise exception '% has already been dispensed', _rx.drug_name;
    end if;

    insert into public.rx_dispenses (rx_document_id, prescription_id, pharmacy_id, member_id, pharmacist_name,
                                     pcn_reg_no, quantity, is_refill)
    values (_doc.id, _rx.id, _ph.id, _m.id, btrim(_m.first_name || ' ' || _m.last_name), _m.pcn_reg_no,
            nullif(left(btrim(coalesce(_it->>'quantity', '')), 60), ''), _done >= 1);

    update public.prescriptions
       set refills_used = case when _done >= 1 then coalesce(refills_used, 0) + 1 else refills_used end,
           status = case when _done + 1 >= 1 + coalesce(refills_allowed, 0) then 'completed' else status end
     where id = _rx.id;
    _count := _count + 1;
  end loop;

  insert into public.rx_access_log (rx_document_id, user_id, pharmacy_id, action)
  values (_doc.id, auth.uid(), _ph.id, 'dispense');

  -- Came through HealingNet? Close this pharmacy's open request and record the fee.
  select * into _req from public.rx_pharmacy_requests
   where rx_document_id = _doc.id and pharmacy_id = _ph.id and status in ('sent', 'available', 'partial')
   for update;
  if _req.id is not null then
    update public.rx_pharmacy_requests set status = 'collected', collected_at = now() where id = _req.id;
    update public.rx_dispenses set request_id = _req.id
     where rx_document_id = _doc.id and pharmacy_id = _ph.id and request_id is null;
    select * into _fee from public.pharmacy_fee_settings where id;
    insert into public.pharmacy_fees (pharmacy_id, request_id, amount_kobo, status)
    values (_ph.id, _req.id,
            case when _fee.billing_enabled then _fee.fee_kobo else 0 end,
            case when _fee.billing_enabled then 'accrued' else 'waived' end)
    on conflict (request_id) do nothing;
  end if;

  perform public.emit_user_notification(public.patient_user_id(_doc.patient_id), 'patient', 'prescription',
    'Prescription dispensed',
    'Your prescription ' || _doc.code || ' was dispensed at ' || _ph.name || '. If this was not you, report it from your prescriptions page.',
    _doc.id, 'rx_document', '/patient/prescriptions');

  return jsonb_build_object('dispensed', _count, 'request_id', _req.id, 'document', private.rx_payload(_doc.id, true));
end;
$$;

-- -----------------------------------------------------------------------------
-- 12. Phase 2: directory and requests
-- -----------------------------------------------------------------------------
create or replace function public.pharmacy_directory(p_state text default null, p_city text default null)
returns table (id uuid, name text, address text, city text, state text, phone text,
               rating numeric, reviews bigint)
language sql stable security definer set search_path = '' as $$
  select p.id, p.name, p.address, p.city, p.state, p.phone,
         round(avg(r.rating)::numeric, 1), count(r.id)
    from public.pharmacies p
    left join public.pharmacy_reviews r on r.pharmacy_id = p.id
   where p.verification_status = 'approved' and p.is_listed
     and (p_state is null or p.state ilike p_state)
     and (p_city is null or p.city ilike p_city)
   group by p.id
   order by avg(r.rating) desc nulls last, p.name
   limit 100
$$;

create or replace function public.rx_send_to_pharmacy(p_document_id uuid, p_pharmacy_id uuid, p_note text default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  _doc public.rx_documents;
  _st text;
  _id uuid;
begin
  select * into _doc from public.rx_documents where id = p_document_id;
  if _doc.id is null or not private.is_own_patient(_doc.patient_id) then
    raise exception 'Prescription not found' using errcode = '42501';
  end if;
  _st := private.rx_payload(_doc.id, false)->>'status';
  if _st <> 'valid' then
    raise exception 'This prescription cannot be sent (%)', case _st when 'expired' then 'it has expired'
      when 'used' then 'it has already been dispensed' when 'cancelled' then 'it was cancelled'
      else 'it is not valid for dispensing outside the hospital' end;
  end if;
  if not exists (select 1 from public.pharmacies where id = p_pharmacy_id and verification_status = 'approved' and is_listed) then
    raise exception 'That pharmacy is not available on HealingNet';
  end if;
  if (select count(*) from public.rx_pharmacy_requests
       where rx_document_id = _doc.id and status in ('sent', 'available', 'partial')) >= 3 then
    raise exception 'You can send a prescription to at most 3 pharmacies at a time. Cancel one first';
  end if;
  begin
    insert into public.rx_pharmacy_requests (rx_document_id, patient_id, pharmacy_id, patient_note)
    values (_doc.id, _doc.patient_id, p_pharmacy_id, nullif(left(btrim(coalesce(p_note, '')), 500), ''))
    returning id into _id;
  exception when unique_violation then
    raise exception 'You already sent this prescription to that pharmacy';
  end;
  perform private.notify_pharmacy(p_pharmacy_id, 'New prescription request',
    'A patient sent prescription ' || _doc.code || '. Check stock and reply.', _id, '/pharmacy/requests');
  return _id;
end;
$$;

create or replace function public.rx_request_respond(p_request_id uuid, p_status text, p_price_kobo bigint default null,
                                                     p_ready_by timestamptz default null, p_note text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  _r public.rx_pharmacy_requests;
  _ph text;
begin
  select * into _r from public.rx_pharmacy_requests where id = p_request_id for update;
  if _r.id is null or not private.is_working_pharmacy_member(_r.pharmacy_id) then
    raise exception 'Request not found' using errcode = '42501';
  end if;
  if _r.status not in ('sent', 'available', 'partial') then
    raise exception 'This request is already %', _r.status;
  end if;
  if p_status not in ('available', 'partial', 'unavailable') then
    raise exception 'Choose available, partly available or not available';
  end if;
  if p_status in ('available', 'partial') and p_price_kobo is null then
    raise exception 'Give the price the patient will pay at the counter';
  end if;
  update public.rx_pharmacy_requests
     set status = p_status, price_kobo = p_price_kobo, ready_by = p_ready_by,
         pharmacy_note = nullif(left(btrim(coalesce(p_note, '')), 500), ''),
         responded_at = now(), responded_by = auth.uid()
   where id = _r.id;
  select name into _ph from public.pharmacies where id = _r.pharmacy_id;
  perform public.emit_user_notification(public.patient_user_id(_r.patient_id), 'patient', 'prescription',
    case p_status when 'unavailable' then _ph || ' cannot fill your prescription'
                  else _ph || ' has your medicine ready' end,
    case p_status when 'unavailable' then coalesce(nullif(btrim(coalesce(p_note, '')), ''), 'Try another pharmacy.')
                  when 'partial' then 'Some items are available. Open the request for the price and details.'
                  else 'Open the request for the price and pickup time.' end,
    _r.id, 'rx_request', '/patient/prescriptions');
end;
$$;

create or replace function public.rx_request_cancel(p_request_id uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare _r public.rx_pharmacy_requests;
begin
  select * into _r from public.rx_pharmacy_requests where id = p_request_id for update;
  if _r.id is null or not private.is_own_patient(_r.patient_id) then
    raise exception 'Request not found' using errcode = '42501';
  end if;
  if _r.status not in ('sent', 'available', 'partial') then
    raise exception 'This request is already %', _r.status;
  end if;
  update public.rx_pharmacy_requests set status = 'cancelled' where id = _r.id;
end;
$$;

-- The pharmacy's view of one request: the full document plus its code.
create or replace function public.rx_request_detail(p_request_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare _r public.rx_pharmacy_requests;
begin
  select * into _r from public.rx_pharmacy_requests where id = p_request_id;
  if _r.id is null or not (private.is_working_pharmacy_member(_r.pharmacy_id) or private.is_own_patient(_r.patient_id)) then
    raise exception 'Request not found' using errcode = '42501';
  end if;
  if private.is_working_pharmacy_member(_r.pharmacy_id) then
    insert into public.rx_access_log (rx_document_id, user_id, pharmacy_id, action)
    values (_r.rx_document_id, auth.uid(), _r.pharmacy_id, 'view');
  end if;
  return jsonb_build_object('request', to_jsonb(_r), 'document', private.rx_payload(_r.rx_document_id, true));
end;
$$;

create or replace function public.rx_review_pharmacy(p_request_id uuid, p_rating int, p_comment text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare _r public.rx_pharmacy_requests;
begin
  select * into _r from public.rx_pharmacy_requests where id = p_request_id;
  if _r.id is null or not private.is_own_patient(_r.patient_id) then
    raise exception 'Request not found' using errcode = '42501';
  end if;
  if _r.status <> 'collected' then raise exception 'You can rate a pharmacy after you collect your medicine'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Choose 1 to 5 stars'; end if;
  insert into public.pharmacy_reviews (request_id, pharmacy_id, patient_id, rating, comment)
  values (_r.id, _r.pharmacy_id, _r.patient_id, p_rating, nullif(left(btrim(coalesce(p_comment, '')), 500), ''))
  on conflict (request_id) do update set rating = excluded.rating, comment = excluded.comment;
end;
$$;

-- Patient records a medicine check. A pharmacy with suspected-fake reports from
-- 3 different patients in 30 days is hidden from the directory until an admin reviews it.
create or replace function public.record_medicine_check(p_prescription_id uuid, p_result text,
    p_batch_number text default null, p_nafdac_no text default null, p_details text default null)
returns uuid language plpgsql volatile security definer set search_path = '' as $$
declare
  _rx public.prescriptions;
  _pharmacy uuid;
  _id uuid;
  _n int;
begin
  select * into _rx from public.prescriptions where id = p_prescription_id;
  if _rx.id is null or not private.is_own_patient(_rx.patient_id) then
    raise exception 'Prescription not found' using errcode = '42501';
  end if;
  if p_result not in ('genuine', 'not_found', 'suspected_fake') then raise exception 'Invalid result'; end if;
  select x.pharmacy_id into _pharmacy from public.rx_dispenses x
   where x.prescription_id = _rx.id order by x.dispensed_at desc limit 1;
  insert into public.medicine_checks (patient_id, prescription_id, pharmacy_id, drug_name, batch_number, nafdac_no,
                                      result, details, status)
  values (_rx.patient_id, _rx.id, _pharmacy, _rx.drug_name,
          nullif(left(btrim(coalesce(p_batch_number, '')), 60), ''), nullif(left(btrim(coalesce(p_nafdac_no, '')), 60), ''),
          p_result, nullif(left(btrim(coalesce(p_details, '')), 1000), ''),
          case when p_result = 'genuine' then 'closed' else 'open' end)
  returning id into _id;

  if p_result = 'suspected_fake' and _pharmacy is not null then
    select count(distinct patient_id) into _n from public.medicine_checks
     where pharmacy_id = _pharmacy and result = 'suspected_fake' and status = 'open'
       and created_at > now() - interval '30 days';
    if _n >= 3 then
      update public.pharmacies
         set is_listed = false,
             paused_reason = 'Paused automatically: suspected fake medicine reported by 3 patients in 30 days'
       where id = _pharmacy and is_listed;
    end if;
  end if;
  return _id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 13. Platform admin
-- -----------------------------------------------------------------------------
create or replace function public.admin_pharmacy_queue()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return jsonb_build_object(
    'pharmacies', coalesce((select jsonb_agg(to_jsonb(p) - 'join_code' order by p.created_at)
                              from public.pharmacies p where p.verification_status = 'pending'), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(to_jsonb(m) || jsonb_build_object('pharmacy_name', p.name) order by m.created_at)
                           from public.pharmacy_members m join public.pharmacies p on p.id = m.pharmacy_id
                          where m.verification_status = 'pending' and m.is_active
                            and m.role in ('owner', 'pharmacist') and m.pcn_reg_no is not null), '[]'::jsonb),
    'open_reports', (select count(*) from public.medicine_checks where status = 'open'),
    'paused', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'reason', p.paused_reason))
                          from public.pharmacies p where not p.is_listed and p.paused_reason is not null), '[]'::jsonb));
end;
$$;

create or replace function public.admin_list_pharmacies(p_status text default null, p_search text default null,
                                                        p_limit int default 25, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return coalesce((select jsonb_agg(x) from (
    select to_jsonb(p) - 'join_code'
           || jsonb_build_object('members', (select count(*) from public.pharmacy_members m where m.pharmacy_id = p.id and m.is_active),
                                 'requests_30d', (select count(*) from public.rx_pharmacy_requests r where r.pharmacy_id = p.id and r.created_at > now() - interval '30 days'),
                                 'collected_30d', (select count(*) from public.rx_pharmacy_requests r where r.pharmacy_id = p.id and r.status = 'collected' and r.collected_at > now() - interval '30 days'),
                                 'fees_accrued_kobo', (select coalesce(sum(f.amount_kobo), 0) from public.pharmacy_fees f where f.pharmacy_id = p.id and f.status = 'accrued')) as x
      from public.pharmacies p
     where (p_status is null or p.verification_status = p_status)
       and (p_search is null or p.name ilike '%' || p_search || '%' or p.city ilike '%' || p_search || '%')
     order by p.created_at desc
     limit private.page_limit(p_limit) offset private.page_offset(p_offset)) s), '[]'::jsonb);
end;
$$;

create or replace function public.admin_review_pharmacy(p_pharmacy_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare _p public.pharmacies;
begin
  perform private.require_platform_admin();
  select * into _p from public.pharmacies where id = p_pharmacy_id for update;
  if _p.id is null then raise exception 'Pharmacy not found'; end if;
  if not p_approve and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Give a reason when rejecting';
  end if;
  if p_approve and (_p.premises_licence_no is null or _p.address is null or _p.city is null or _p.state is null) then
    raise exception 'The pharmacy needs a premises licence number and a full address before approval';
  end if;
  update public.pharmacies
     set verification_status = case when p_approve then 'approved' else 'rejected' end,
         review_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_at = now()
   where id = _p.id;
  perform private.notify_pharmacy(_p.id,
    case when p_approve then 'Your pharmacy is verified' else 'Your pharmacy was not verified' end,
    case when p_approve then 'You can now be found by patients on HealingNet.' else 'Reason: ' || btrim(p_note) end,
    _p.id, '/pharmacy/settings');
  perform private.admin_log(case when p_approve then 'pharmacy.approve' else 'pharmacy.reject' end,
                            'pharmacy', _p.id, jsonb_build_object('note', p_note));
end;
$$;

create or replace function public.admin_review_pharmacist(p_member_id uuid, p_approve boolean, p_note text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare _m public.pharmacy_members;
begin
  perform private.require_platform_admin();
  select * into _m from public.pharmacy_members where id = p_member_id for update;
  if _m.id is null then raise exception 'Pharmacist not found'; end if;
  if not p_approve and nullif(btrim(coalesce(p_note, '')), '') is null then
    raise exception 'Give a reason when rejecting';
  end if;
  if p_approve and (_m.pcn_reg_no is null or _m.licence_expiry is null) then
    raise exception 'A PCN registration number and licence expiry are needed before approval';
  end if;
  if p_approve and _m.licence_expiry < current_date then
    raise exception 'This licence has expired';
  end if;
  update public.pharmacy_members
     set verification_status = case when p_approve then 'approved' else 'rejected' end,
         review_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_at = now()
   where id = _m.id;
  perform public.emit_user_notification(_m.user_id, 'pharmacy', 'verification',
    case when p_approve then 'You are verified to dispense' else 'Your pharmacist details were not verified' end,
    case when p_approve then 'You can now dispense HealingNet prescriptions.' else 'Reason: ' || btrim(p_note) end,
    _m.id, 'pharmacy_member', '/pharmacy/settings');
  perform private.admin_log(case when p_approve then 'pharmacist.approve' else 'pharmacist.reject' end,
                            'pharmacy_member', _m.id, jsonb_build_object('note', p_note));
end;
$$;

-- Suspend / restore, list or hide from the directory.
create or replace function public.admin_set_pharmacy_status(p_pharmacy_id uuid, p_status text, p_listed boolean,
                                                            p_reason text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  if p_status not in ('approved', 'suspended') then raise exception 'Status must be approved or suspended'; end if;
  if (p_status = 'suspended' or not p_listed) and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Give a reason';
  end if;
  update public.pharmacies
     set verification_status = p_status, is_listed = coalesce(p_listed, false),
         paused_reason = case when coalesce(p_listed, false) and p_status = 'approved' then null else btrim(p_reason) end
   where id = p_pharmacy_id;
  if not found then raise exception 'Pharmacy not found'; end if;
  perform private.admin_log('pharmacy.status', 'pharmacy', p_pharmacy_id,
                            jsonb_build_object('status', p_status, 'listed', p_listed, 'reason', p_reason));
end;
$$;

create or replace function public.admin_list_medicine_checks(p_status text default 'open', p_limit int default 25, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  return coalesce((select jsonb_agg(x) from (
    select to_jsonb(c) || jsonb_build_object('pharmacy_name', p.name) as x
      from public.medicine_checks c left join public.pharmacies p on p.id = c.pharmacy_id
     where (p_status is null or c.status = p_status) and c.result <> 'genuine'
     order by c.created_at desc
     limit private.page_limit(p_limit) offset private.page_offset(p_offset)) s), '[]'::jsonb);
end;
$$;

create or replace function public.admin_resolve_medicine_check(p_check_id uuid, p_status text, p_note text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  if p_status not in ('reviewed', 'closed') then raise exception 'Status must be reviewed or closed'; end if;
  update public.medicine_checks set status = p_status, admin_note = nullif(btrim(coalesce(p_note, '')), ''), reviewed_at = now()
   where id = p_check_id;
  if not found then raise exception 'Report not found'; end if;
  perform private.admin_log('medicine_check.' || p_status, 'medicine_check', p_check_id, jsonb_build_object('note', p_note));
end;
$$;

create or replace function public.admin_pharmacy_fee_settings(p_fee_kobo bigint default null, p_billing_enabled boolean default null)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare _s public.pharmacy_fee_settings;
begin
  perform private.require_platform_admin();
  if p_fee_kobo is not null or p_billing_enabled is not null then
    if p_fee_kobo is not null and p_fee_kobo < 0 then raise exception 'Fee cannot be negative'; end if;
    update public.pharmacy_fee_settings
       set fee_kobo = coalesce(p_fee_kobo, fee_kobo), billing_enabled = coalesce(p_billing_enabled, billing_enabled),
           updated_at = now(), updated_by = auth.uid()
     where id;
    perform private.admin_log('pharmacy_fee.settings', 'pharmacy_fee_settings', null,
                              jsonb_build_object('fee_kobo', p_fee_kobo, 'billing_enabled', p_billing_enabled));
  end if;
  select * into _s from public.pharmacy_fee_settings where id;
  return jsonb_build_object('fee_kobo', _s.fee_kobo, 'billing_enabled', _s.billing_enabled, 'updated_at', _s.updated_at);
end;
$$;

create or replace function public.admin_set_pharmacy_fee_status(p_fee_id uuid, p_status text, p_note text default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.require_platform_admin();
  if p_status not in ('accrued', 'waived', 'invoiced', 'paid') then raise exception 'Invalid status'; end if;
  update public.pharmacy_fees set status = p_status, note = nullif(btrim(coalesce(p_note, '')), '') where id = p_fee_id;
  if not found then raise exception 'Fee not found'; end if;
  perform private.admin_log('pharmacy_fee.' || p_status, 'pharmacy_fee', p_fee_id, jsonb_build_object('note', p_note));
end;
$$;

-- -----------------------------------------------------------------------------
-- 14. Row level security and grants
-- -----------------------------------------------------------------------------
alter table public.pharmacies enable row level security;
alter table public.pharmacy_members enable row level security;
alter table public.rx_documents enable row level security;
alter table public.rx_pharmacy_requests enable row level security;
alter table public.rx_dispenses enable row level security;
alter table public.rx_access_log enable row level security;
alter table public.pharmacy_fee_settings enable row level security;
alter table public.pharmacy_fees enable row level security;
alter table public.pharmacy_reviews enable row level security;
alter table public.medicine_checks enable row level security;

grant all on public.pharmacies, public.pharmacy_members, public.rx_documents, public.rx_pharmacy_requests,
             public.rx_dispenses, public.rx_access_log, public.pharmacy_fee_settings, public.pharmacy_fees,
             public.pharmacy_reviews, public.medicine_checks to service_role;

-- Pharmacies: directory columns only (join code and licence details via my_pharmacy / admin functions).
grant select (id, name, address, city, state, phone, verification_status, is_listed, created_at)
  on public.pharmacies to authenticated;
create policy "Directory, own pharmacy, admins" on public.pharmacies
  for select to authenticated
  using ((verification_status = 'approved' and is_listed)
         or id = private.my_pharmacy_id()
         or private.is_platform_admin());

grant select (id, pharmacy_id, user_id, first_name, last_name, role, pcn_reg_no, licence_expiry,
              verification_status, review_note, is_active, created_at)
  on public.pharmacy_members to authenticated;
create policy "Own team and admins" on public.pharmacy_members
  for select to authenticated
  using (user_id = auth.uid() or pharmacy_id = private.my_pharmacy_id() or private.is_platform_admin());

grant select on public.rx_documents to authenticated;
create policy "Patient, prescriber, hospital" on public.rx_documents
  for select to authenticated
  using (private.is_own_patient(patient_id)
         or (doctor_id is not null and doctor_id = private.my_doctor_id())
         or private.can_work_at(hospital_id, 'emr'));

grant select on public.rx_pharmacy_requests to authenticated;
create policy "Patient, the pharmacy, admins" on public.rx_pharmacy_requests
  for select to authenticated
  using (private.is_own_patient(patient_id)
         or private.is_working_pharmacy_member(pharmacy_id)
         or private.is_platform_admin());

grant select on public.rx_dispenses to authenticated;
create policy "Patient, prescriber, hospital, the pharmacy" on public.rx_dispenses
  for select to authenticated
  using (private.is_working_pharmacy_member(pharmacy_id)
         or exists (select 1 from public.rx_documents d where d.id = rx_document_id
                     and (private.is_own_patient(d.patient_id)
                          or (d.doctor_id is not null and d.doctor_id = private.my_doctor_id())
                          or private.can_work_at(d.hospital_id, 'emr'))));

-- rx_access_log and pharmacy_fee_settings: no browser access (admin functions / service role).

grant select on public.pharmacy_fees to authenticated;
create policy "Pharmacy owner and admins" on public.pharmacy_fees
  for select to authenticated
  using (private.is_pharmacy_owner(pharmacy_id) or private.is_platform_admin());

grant select on public.pharmacy_reviews to authenticated;
create policy "Anyone signed in reads reviews of listed pharmacies" on public.pharmacy_reviews
  for select to authenticated
  using (private.is_own_patient(patient_id)
         or pharmacy_id = private.my_pharmacy_id()
         or private.is_platform_admin()
         or exists (select 1 from public.pharmacies p where p.id = pharmacy_id and p.verification_status = 'approved' and p.is_listed));

grant select on public.medicine_checks to authenticated;
create policy "Own checks and admins" on public.medicine_checks
  for select to authenticated
  using (private.is_own_patient(patient_id) or private.is_platform_admin());

-- Helpers used by policies (evaluated as the calling role).
grant execute on function
  private.my_pharmacy_member_id(),
  private.my_pharmacy_id(),
  private.is_working_pharmacy_member(uuid),
  private.is_pharmacy_owner(uuid),
  private.can_dispense()
to authenticated;
revoke all on function private.random_code(int), private.normalize_rx_code(text) from public, anon, authenticated;

-- RPCs.
revoke all on function
  public.pharmacy_for_join_code(text), public.my_pharmacy(), public.update_my_pharmacy(jsonb),
  public.update_my_pharmacist_details(text, date, text), public.pharmacy_set_member_active(uuid, boolean),
  public.my_prescriber_details(), public.rx_verify(text), public.rx_document(uuid), public.rx_dispense(text, jsonb),
  public.pharmacy_directory(text, text), public.rx_send_to_pharmacy(uuid, uuid, text),
  public.rx_request_respond(uuid, text, bigint, timestamptz, text), public.rx_request_cancel(uuid),
  public.rx_request_detail(uuid), public.rx_review_pharmacy(uuid, int, text),
  public.record_medicine_check(uuid, text, text, text, text),
  public.admin_pharmacy_queue(), public.admin_list_pharmacies(text, text, int, int),
  public.admin_review_pharmacy(uuid, boolean, text), public.admin_review_pharmacist(uuid, boolean, text),
  public.admin_set_pharmacy_status(uuid, text, boolean, text), public.admin_list_medicine_checks(text, int, int),
  public.admin_resolve_medicine_check(uuid, text, text), public.admin_pharmacy_fee_settings(bigint, boolean),
  public.admin_set_pharmacy_fee_status(uuid, text, text)
from public, anon;

-- Signed out: check a join code before sign-up, and verify a prescription code.
grant execute on function public.pharmacy_for_join_code(text), public.rx_verify(text) to anon, authenticated;
grant execute on function
  public.my_pharmacy(), public.update_my_pharmacy(jsonb),
  public.update_my_pharmacist_details(text, date, text), public.pharmacy_set_member_active(uuid, boolean),
  public.my_prescriber_details(), public.rx_document(uuid), public.rx_dispense(text, jsonb),
  public.pharmacy_directory(text, text), public.rx_send_to_pharmacy(uuid, uuid, text),
  public.rx_request_respond(uuid, text, bigint, timestamptz, text), public.rx_request_cancel(uuid),
  public.rx_request_detail(uuid), public.rx_review_pharmacy(uuid, int, text),
  public.record_medicine_check(uuid, text, text, text, text),
  public.admin_pharmacy_queue(), public.admin_list_pharmacies(text, text, int, int),
  public.admin_review_pharmacy(uuid, boolean, text), public.admin_review_pharmacist(uuid, boolean, text),
  public.admin_set_pharmacy_status(uuid, text, boolean, text), public.admin_list_medicine_checks(text, int, int),
  public.admin_resolve_medicine_check(uuid, text, text), public.admin_pharmacy_fee_settings(bigint, boolean),
  public.admin_set_pharmacy_fee_status(uuid, text, text)
to authenticated;

-- Live updates for the pharmacy request inbox and the patient's request status.
alter publication supabase_realtime add table public.rx_pharmacy_requests;
