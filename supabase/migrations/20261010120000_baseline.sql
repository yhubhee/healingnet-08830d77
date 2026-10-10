-- =============================================================================
-- HealingNet baseline schema
--
-- Built from the Lovable Cloud live schema dump (Oct 2026) with the security
-- fixes from HealingNet_Audit_Report.md (#1-#14) and HealingNet_Rebuild_Plan.md
-- (N1-N10, D1-D8) applied directly. Replaces supabase/migrations_legacy/ and
-- legacy/drizzle/. Intended for a fresh project with "automatically expose new
-- tables" OFF: every privilege anon/authenticated has is granted explicitly in
-- section 9.
--
-- Access model (summary)
--   * A patient belongs to a hospital only through public.hospital_patients.
--   * Hospital staff and *active* hospital doctors see a hospital's clinical
--     data only while the hospital has a current plan (private.hospital_has_plan).
--   * Patients always see their own records, whatever the hospital's plan.
--   * Plan, subscription, payment and doctor-verification state are written only
--     by the service role (edge functions) or by SECURITY DEFINER RPCs with checks.
-- =============================================================================

set check_function_bodies = off;

-- -----------------------------------------------------------------------------
-- 1. Schemas and default privileges
-- -----------------------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Tables
-- -----------------------------------------------------------------------------

-- 2.1 Platform ------------------------------------------------------------------

-- D1: platform administrators (doctor verification). Rows are added by the owner
-- with SQL / service role only.
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  created_at timestamptz not null default now()
);

-- D4: the only source of plan prices.
create table public.plan_prices (
  plan text not null check (plan in ('emr', 'telemedicine')),
  billing_cycle text not null check (billing_cycle in ('monthly', 'yearly')),
  amount_kobo bigint not null check (amount_kobo > 0),
  currency text not null default 'NGN' check (currency = 'NGN'),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (plan, billing_cycle)
);

-- #12 / #16: rate limiting for edge functions (service role only).
-- user_id is the caller (null for internal server-to-server calls);
-- subject_user_id is who the call is about (e.g. the email recipient).
create table public.function_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  fn text not null,
  subject_user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  subject text,
  message text not null,
  created_at timestamptz not null default now()
);

-- 2.2 Hospitals, staff, doctors, patients -------------------------------------

create table public.hospitals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  city text,
  state text,
  phone text,
  email text,
  logo_url text,
  license_number text,
  is_active boolean not null default true,
  lat numeric,
  lng numeric,
  active_plan text not null default 'none'
    check (active_plan in ('none', 'emr', 'telemedicine')),
  subscription_status text not null default 'inactive'
    check (subscription_status in ('inactive', 'pending', 'trialing', 'active', 'expired')),
  trial_ends_at timestamptz,          -- D5
  plan_expires_at timestamptz,        -- end of the paid period (set by Paystack functions)
  -- Platform verification. A pending hospital can use its own trial, but is
  -- invisible to patients until a platform admin approves it (review_hospital).
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'approved', 'rejected')),
  verified_at timestamptz,
  verification_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A paid plan or a trial always has an end date.
  constraint hospitals_active_has_expiry check (subscription_status <> 'active' or plan_expires_at is not null),
  constraint hospitals_trial_has_end check (subscription_status <> 'trialing' or trial_ends_at is not null)
);

create table public.hospital_staff (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  role text not null default 'receptionist'
    check (role in ('admin', 'receptionist', 'nurse', 'lab_tech', 'pharmacist', 'manager', 'medical_officer')),
  department text,
  profile_image_url text,
  is_active boolean not null default true,
  last_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, hospital_id)
);

create table public.hospital_subscriptions (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  plan text not null default 'emr' check (plan in ('emr', 'telemedicine')),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'trialing', 'past_due', 'canceled', 'expired')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hospital_subscriptions_has_expiry check (status not in ('active', 'trialing') or expires_at is not null)
);

create table public.hospital_notification_prefs (
  hospital_id uuid primary key references public.hospitals(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.hospital_notifications (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  type text not null default 'system'
    check (type in ('checkin', 'call_in', 'appointment', 'billing', 'lab', 'pharmacy', 'consultation',
                    'emergency', 'referral', 'system', 'emr')),   -- N7: 'call_in' added
  title text not null,
  message text,
  reference_id uuid,
  reference_type text,
  is_read boolean default false,
  created_at timestamptz not null default now()
);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,   -- N2: one profile per user
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  specialty text,
  years_experience integer default 0,
  rating numeric default 0,
  profile_image_url text,
  bio text,
  is_available boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified', 'pending_review', 'approved', 'rejected')),
  license_number text,
  license_council text,
  license_expiry date,
  verification_submitted_at timestamptz,
  verification_reviewed_at timestamptz,
  verification_rejection_reason text,
  current_practice jsonb,
  credential_documents jsonb,
  reference_contact jsonb
);

create table public.hospital_doctors (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  employment_type text not null default 'full_time'
    check (employment_type in ('full_time', 'visiting_consultant', 'locum')),
  department text,
  contract_start date,
  contract_end date,
  salary numeric,
  commission_rate numeric default 0,
  is_active boolean not null default false,                       -- #9: access starts on acceptance
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'declined', 'expired')),
  unique (hospital_id, doctor_id)
);

create table public.doctor_settings (
  doctor_id uuid primary key references public.doctors(id) on delete cascade,
  availability_mode text not null default 'global' check (availability_mode in ('global', 'per_hospital')),
  is_currently_available boolean not null default true,
  accepts_virtual_global boolean not null default false,
  virtual_consultation_fee numeric default 0,
  notification_prefs jsonb not null default '{"sms": false, "email": true, "in_app": true}'::jsonb,
  language text default 'en',
  timezone text default 'Africa/Lagos',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.doctor_availability (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  hospital_id uuid references public.hospitals(id) on delete cascade,
  day_of_week integer not null check (day_of_week >= 0 and day_of_week <= 6),
  start_time time not null default '09:00:00',
  end_time time not null default '17:00:00',
  is_available boolean not null default true,
  accepts_virtual boolean not null default false,
  accepts_in_person boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.doctor_marketplace (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null unique references public.doctors(id) on delete cascade,
  home_hospital_id uuid references public.hospitals(id) on delete set null,
  is_available_for_external boolean default true,
  external_consultation_fee numeric default 0,
  external_virtual_fee numeric default 0,
  specialties_offered jsonb,
  max_external_hours_per_week integer default 10,
  bio_for_marketplace text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,   -- N2: one profile per user
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other')),
  blood_group text,
  genotype text,
  address text,
  city text,
  state text,
  emergency_contact_name text,
  emergency_contact_phone text,
  insurance_provider text,
  insurance_policy_number text,
  profile_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'outpatient'
);

-- #1 / D2: the only thing that connects a patient to a hospital.
create table public.hospital_patients (
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (hospital_id, patient_id)
);

create table public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default true,
  email_appointments boolean not null default true,
  email_lab_results boolean not null default true,
  email_prescriptions boolean not null default true,
  email_letters boolean not null default true,
  email_billing boolean not null default true,
  language text default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  audience text not null default 'patient',
  type text not null,
  title text not null,
  message text,
  reference_id uuid,
  reference_type text,
  action_url text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.patient_messages (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  body text not null check (char_length(body) between 1 and 10000),
  is_read boolean default false,
  created_at timestamptz not null default now()
);

-- 2.3 Front desk, appointments, triage -------------------------------------------

create table public.patient_checkins (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  checkin_type text not null default 'walk_in' check (checkin_type in ('pre_booked', 'walk_in')),
  queue_number integer,
  status text not null default 'checked_in'
    check (status in ('checked_in', 'waiting', 'called', 'in_consultation', 'completed', 'no_show', 'cancelled')),  -- N7
  checkin_time timestamptz default now(),
  called_time timestamptz,
  consultation_start timestamptz,
  consultation_end timestamptz,
  assigned_doctor_id uuid references public.doctors(id) on delete set null,
  department text,
  urgency text default 'routine' check (urgency in ('routine', 'soon', 'urgent', 'emergency')),
  vitals jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patient_appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  requested_date date not null,
  requested_time time,
  reason text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_telemedicine boolean not null default false,
  meeting_link text,
  daily_room_name text
);

create table public.triage_sessions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  symptoms jsonb not null default '[]'::jsonb,
  duration text,
  severity_self integer check (severity_self >= 1 and severity_self <= 10),
  severity_score integer check (severity_score >= 1 and severity_score <= 10),
  recommended_specialty text,
  urgency text check (urgency in ('routine', 'soon', 'urgent', 'emergency')),
  recommended_hospitals jsonb default '[]'::jsonb,
  chosen_hospital_id uuid references public.hospitals(id) on delete set null,
  chosen_doctor_id uuid references public.doctors(id) on delete set null,
  status text not null default 'completed',
  lat numeric,
  lng numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.4 Clinical -------------------------------------------------------------------

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id),
  patient_id uuid not null references public.patients(id),
  doctor_id uuid not null references public.doctors(id),
  appointment_id uuid references public.patient_appointments(id),
  checkin_id uuid references public.patient_checkins(id),
  mode text not null default 'in_person' check (mode in ('in_person', 'telemedicine')),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  provisional_diagnosis text,
  final_diagnosis text,
  advice_plan text,
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consultation_history (
  consultation_id uuid primary key references public.consultations(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id),
  chief_complaints jsonb not null default '[]'::jsonb,
  history_of_presenting_complaint text,
  past_medical_history text,
  past_surgical_history text,
  drug_history text,
  allergies text,
  family_history text,
  social_history text,
  lmp date,
  edd date,
  obstetric_notes text,
  review_of_systems text,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_by_role text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.consultation_examinations (
  consultation_id uuid primary key references public.consultations(id) on delete cascade,
  hospital_id uuid not null references public.hospitals(id),
  bp_systolic integer,
  bp_diastolic integer,
  pulse_rate integer,
  respiratory_rate integer,
  temperature_c numeric,
  spo2 integer,
  weight_kg numeric,
  height_cm numeric,
  rbs_mmol_l numeric,
  general_examination text,
  systemic_examination text,
  other_findings text,
  recorded_by uuid references auth.users(id) on delete set null,
  recorded_by_role text,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.pharmacy_inventory (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  drug_name text not null,
  generic_name text,
  category text,
  dosage_form text default 'tablet'
    check (dosage_form in ('tablet', 'capsule', 'syrup', 'injection', 'cream', 'inhaler', 'drops', 'iv_fluid', 'other')),
  strength text,
  quantity_in_stock integer not null default 0 check (quantity_in_stock >= 0),
  reorder_level integer default 50,
  unit_price numeric,
  supplier text,
  batch_number text,
  expiry_date date,
  location text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.consultation_treatment_items (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  line_no integer not null default 1,
  kind text not null default 'drug' check (kind in ('drug', 'procedure', 'other')),
  inventory_item_id uuid references public.pharmacy_inventory(id),
  drug_name text not null,
  strength text,
  dose text,
  route text,
  frequency text,
  duration_value integer,
  duration_unit text,
  quantity integer,
  instructions text,
  give_in_clinic boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.consultation_addenda (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  note text not null,
  created_at timestamptz not null default now()
);

create table public.diagnostic_catalog (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references public.hospitals(id),
  kind text not null check (kind in ('imaging', 'other')),
  section text not null,
  name text not null,
  aliases text[] not null default '{}'::text[],
  allowed_views text[] not null default '{}'::text[],
  has_laterality boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table public.diagnostic_requests (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id),
  consultation_id uuid references public.consultations(id),
  patient_id uuid not null references public.patients(id),
  ordered_by uuid references public.doctors(id),
  catalog_item_id uuid references public.diagnostic_catalog(id),
  item_name text not null,
  kind text not null default 'imaging' check (kind in ('imaging', 'other', 'lab')),
  section text,
  views text[] not null default '{}'::text[],
  laterality text check (laterality in ('left', 'right', 'bilateral')),
  other_view text,
  priority text not null default 'routine' check (priority in ('routine', 'urgent', 'stat')),
  fasting boolean not null default false,
  clinical_info text,
  bill_to text check (bill_to in ('patient', 'hmo', 'company', 'hospital')),
  destination text not null default 'in_house' check (destination in ('in_house', 'external')),
  external_facility text,
  ordered_at timestamptz not null default now(),
  performed_at timestamptz,
  reported_at timestamptz,
  cancelled_at timestamptz,
  report_text text,
  report_file_path text,
  reported_by uuid references auth.users(id) on delete set null
);

create table public.emr_entries (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  checkin_id uuid references public.patient_checkins(id) on delete set null,
  entry_type text not null
    check (entry_type in ('consultation_note', 'vitals', 'diagnosis', 'procedure', 'lab_order', 'lab_result',
                          'imaging', 'referral', 'discharge_summary', 'surgery_note', 'antenatal', 'delivery', 'postnatal')),
  title text not null,
  content text,
  structured_data jsonb,
  attachments jsonb,
  is_confidential boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  vital_data jsonb
);

create table public.lab_results (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  ordered_by uuid references public.doctors(id) on delete set null,
  status text default 'pending'
    check (status in ('pending', 'ordered', 'processing', 'in_progress', 'completed', 'final')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  consultation_id uuid references public.consultations(id),
  clinical_info text,
  priority text,
  fasting boolean,
  bill_to text
);

create table public.lab_result_tests (
  id uuid primary key default gen_random_uuid(),
  lab_result_id uuid not null references public.lab_results(id) on delete cascade,
  test_name text not null,
  category_name text,
  sample_type text,
  result_value text,
  reference_range text,
  unit text,
  is_abnormal boolean default false,
  created_at timestamptz not null default now(),
  catalog_test_id text,
  is_custom boolean not null default false,
  parameters jsonb,
  status text not null default 'pending' check (status in ('pending', 'completed')),
  completed_at timestamptz
);

create table public.lab_result_parameters (
  id uuid primary key default gen_random_uuid(),
  order_test_id uuid not null references public.lab_result_tests(id) on delete cascade,
  parameter_name text not null,
  result_value text,
  unit_snapshot text,
  ref_range_snapshot text,
  flag text not null default 'unknown' check (flag in ('normal', 'low', 'high', 'abnormal', 'unknown')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null,
  hospital_id uuid not null,
  doctor_id uuid,
  drug_name text not null,
  dosage text,
  frequency text,
  duration text,
  instructions text,
  refills_allowed integer default 0,
  refills_used integer default 0,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  consultation_id uuid references public.consultations(id),
  constraint fk_prescriptions_patient foreign key (patient_id) references public.patients(id) on delete cascade,
  constraint fk_prescriptions_hospital foreign key (hospital_id) references public.hospitals(id) on delete cascade,
  constraint fk_prescriptions_doctor foreign key (doctor_id) references public.doctors(id) on delete set null
);

create table public.pharmacy_dispensing (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  drug_id uuid references public.pharmacy_inventory(id) on delete set null,
  drug_name text not null,
  dosage text,
  quantity_dispensed integer,
  dispensed_by uuid references public.hospital_staff(id) on delete set null,
  payment_status text default 'pending' check (payment_status in ('pending', 'paid', 'insurance', 'waived')),
  dispensed_at timestamptz default now(),
  notes text,
  created_at timestamptz not null default now(),
  prescription_id uuid references public.prescriptions(id) on delete set null   -- #13: audit trail
);

create table public.hospital_wards (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  ward_name text not null,
  ward_type text not null default 'general',
  total_beds integer not null default 0,
  floor text,
  notes text,
  is_active boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hospital_beds (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  ward_id uuid not null references public.hospital_wards(id) on delete cascade,
  bed_number text not null,
  bed_type text not null default 'standard',
  status text not null default 'available',
  daily_rate numeric default 0,
  patient_id uuid references public.patients(id),
  assigned_at timestamptz,
  discharged_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hospital_billing (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  checkin_id uuid references public.patient_checkins(id) on delete set null,
  billing_type text not null
    check (billing_type in ('consultation', 'procedure', 'lab', 'pharmacy', 'surgery', 'maternity', 'imaging')),
  description text,
  amount numeric not null,
  discount numeric default 0,
  tax numeric default 0,
  total numeric not null,
  payment_status text default 'pending' check (payment_status in ('pending', 'partial', 'paid', 'refunded', 'waived')),
  payment_method text default 'cash' check (payment_method in ('cash', 'card', 'transfer', 'insurance', 'hmo')),
  insurance_provider text,
  insurance_policy_number text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.insurance_claims (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  billing_id uuid references public.hospital_billing(id) on delete set null,
  insurance_provider text not null,
  policy_number text,
  claim_amount numeric not null,
  approved_amount numeric,
  service_description text,
  claim_date date not null,
  status text default 'draft'
    check (status in ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'appealed', 'paid')),
  rejection_reason text,
  paid_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.maternity_records (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  lmp_date date,
  edd date,
  gestational_age_weeks integer,
  gravida integer default 1,
  para integer default 0,
  risk_level text default 'low' check (risk_level in ('low', 'moderate', 'high')),
  blood_group text,
  genotype text,
  status text default 'anc_registered'
    check (status in ('anc_registered', 'active_anc', 'labour', 'delivered', 'postnatal', 'discharged')),
  delivery_date timestamptz,
  delivery_type text check (delivery_type in ('normal', 'caesarean', 'assisted', 'vacuum')),
  baby_weight numeric,
  baby_gender text check (baby_gender in ('male', 'female')),
  apgar_score text,
  complications text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.surgery_records (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  surgeon_id uuid not null references public.doctors(id) on delete cascade,
  anaesthetist_id uuid references public.doctors(id) on delete set null,
  procedure_name text not null,
  procedure_type text default 'elective' check (procedure_type in ('elective', 'emergency', 'day_case')),
  theatre_number text,
  anaesthesia_type text default 'general'
    check (anaesthesia_type in ('general', 'local', 'spinal', 'epidural', 'sedation')),
  scheduled_date date not null,
  scheduled_time time not null,
  actual_start timestamptz,
  actual_end timestamptz,
  duration_minutes integer,
  status text default 'scheduled'
    check (status in ('scheduled', 'prep', 'in_progress', 'recovery', 'completed', 'cancelled', 'postponed')),
  pre_op_diagnosis text,
  post_op_diagnosis text,
  operative_findings text,
  complications text,
  blood_loss_ml integer,
  post_op_instructions text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.hospital_referrals (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid not null references public.hospitals(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  referring_doctor_id uuid references public.doctors(id) on delete set null,
  referred_to_doctor_id uuid references public.doctors(id) on delete set null,
  referred_to_hospital text,
  referral_type text not null check (referral_type in ('internal', 'external_outgoing', 'external_incoming')),
  specialty text,
  reason text not null,
  clinical_summary text,
  urgency text default 'routine' check (urgency in ('routine', 'urgent', 'emergency')),
  status text default 'pending' check (status in ('pending', 'accepted', 'in_progress', 'completed', 'declined')),
  appointment_date date,
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patient_letters (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  hospital_id uuid references public.hospitals(id) on delete set null,
  letter_type text not null
    check (letter_type in ('fit_to_work', 'pregnancy_maternity', 'sick_leave', 'excuse_of_duty', 'vaccination_record', 'lab_report')),
  title text not null,
  body text not null default '',
  issued_at date not null default current_date,
  valid_until date,
  status text not null default 'issued' check (status in ('issued', 'pending', 'expired')),
  pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2.5 Telemedicine marketplace and payments ------------------------------------

create table public.consultation_requests (
  id uuid primary key default gen_random_uuid(),
  requesting_hospital_id uuid not null references public.hospitals(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  specialty_needed text,
  urgency text default 'moderate' check (urgency in ('low', 'moderate', 'high', 'urgent')),
  request_type text default 'virtual' check (request_type in ('virtual', 'in_person', 'either')),
  reason text not null,
  patient_summary text,
  preferred_date date,
  preferred_time time,
  status text default 'pending' check (status in ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
  doctor_notes text,
  meeting_link text,
  fee_agreed numeric check (fee_agreed is null or fee_agreed >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  video_provider text,
  daily_room_name text,
  recording_url text,
  recording_status text,
  call_started_at timestamptz,
  call_ended_at timestamptz,
  paid_at timestamptz             -- set by private.fulfill_payment
);

-- #3 / #10 / D3: one payments table for subscriptions, bills, pharmacy and consultations.
-- Written only by the service role (Paystack edge functions). amount is in kobo.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  hospital_id uuid references public.hospitals(id),
  patient_id uuid references public.patients(id),
  purpose text not null check (purpose in ('billing', 'pharmacy', 'consultation', 'subscription')),
  reference_id uuid,              -- hospital_billing.id / pharmacy_dispensing.id / consultation_requests.id
  amount bigint not null check (amount > 0),   -- kobo
  currency text not null default 'NGN' check (currency = 'NGN'),
  email text,
  paystack_reference text not null unique,
  status text not null default 'pending' check (status in ('pending', 'success', 'failed', 'abandoned')),
  channel text,
  authorization_url text,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  plan text check (plan is null or plan in ('emr', 'telemedicine')),
  billing_cycle text check (billing_cycle is null or billing_cycle in ('monthly', 'yearly')),
  payer_user_id uuid references auth.users(id) on delete set null,
  payee_doctor_id uuid references public.doctors(id) on delete set null,
  constraint payments_subscription_fields check (
    purpose <> 'subscription' or (plan is not null and billing_cycle is not null and hospital_id is not null))
);

-- -----------------------------------------------------------------------------
-- 3. Indexes (primary keys and UNIQUE constraints are created above)
-- -----------------------------------------------------------------------------
create index idx_hospital_staff_hospital on public.hospital_staff (hospital_id);
create index idx_hospital_staff_user on public.hospital_staff (user_id);
create index idx_hospital_subscriptions_hospital on public.hospital_subscriptions (hospital_id, started_at desc);
create index idx_notifications_hospital on public.hospital_notifications (hospital_id);
create index idx_notifications_read on public.hospital_notifications (hospital_id, is_read);
create index idx_doctors_verification_status on public.doctors (verification_status);
create index idx_hospital_doctors_doctor on public.hospital_doctors (doctor_id);
create index idx_hospital_doctors_hospital on public.hospital_doctors (hospital_id);
create unique index doctor_availability_unique on public.doctor_availability
  (doctor_id, coalesce(hospital_id, '00000000-0000-0000-0000-000000000000'::uuid), day_of_week);
create index idx_doctor_availability_doctor on public.doctor_availability (doctor_id);
create index idx_hospital_patients_patient on public.hospital_patients (patient_id);
create index idx_user_notifications_user on public.user_notifications (user_id, created_at desc);
create index idx_patient_messages_to on public.patient_messages (to_user_id, created_at desc);
create index idx_patient_messages_from on public.patient_messages (from_user_id, created_at desc);
create index idx_checkins_hospital on public.patient_checkins (hospital_id);
create index idx_checkins_status on public.patient_checkins (status);
create index idx_checkins_patient on public.patient_checkins (patient_id);
create unique index patient_appointments_doctor_slot_unique on public.patient_appointments
  (doctor_id, requested_date, requested_time)
  where status in ('pending', 'accepted') and requested_time is not null;
create index idx_appointments_patient on public.patient_appointments (patient_id);
create index idx_appointments_hospital on public.patient_appointments (hospital_id);
create index idx_appointments_doctor on public.patient_appointments (doctor_id);
create index idx_triage_patient on public.triage_sessions (patient_id);
create unique index consultations_open_appt_uq on public.consultations (appointment_id)
  where appointment_id is not null and submitted_at is null;
create unique index consultations_open_checkin_uq on public.consultations (checkin_id)
  where checkin_id is not null and submitted_at is null;
create index consultations_patient_idx on public.consultations (patient_id);
create index consultations_doctor_idx on public.consultations (doctor_id);
create index cti_consult_idx on public.consultation_treatment_items (consultation_id);
create index consultation_addenda_consult_idx on public.consultation_addenda (consultation_id);
create unique index diagnostic_catalog_uq on public.diagnostic_catalog
  (coalesce(hospital_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name), section);
create index diagnostic_requests_consult_idx on public.diagnostic_requests (consultation_id);
create index diagnostic_requests_hospital_idx on public.diagnostic_requests (hospital_id);
create index diagnostic_requests_patient_idx on public.diagnostic_requests (patient_id);
create index idx_emr_hospital on public.emr_entries (hospital_id);
create index idx_emr_patient on public.emr_entries (patient_id);
create index idx_lab_results_hospital on public.lab_results (hospital_id);
create index idx_lab_results_patient on public.lab_results (patient_id);
create index idx_lab_results_consultation on public.lab_results (consultation_id);
create index idx_lab_tests_result on public.lab_result_tests (lab_result_id);
create index lab_result_parameters_order_test_idx on public.lab_result_parameters (order_test_id);
create index idx_prescriptions_hospital on public.prescriptions (hospital_id);
create index idx_prescriptions_patient on public.prescriptions (patient_id);
create index idx_prescriptions_consultation on public.prescriptions (consultation_id);
create index idx_pharmacy_hospital on public.pharmacy_inventory (hospital_id);
create index idx_dispensing_hospital on public.pharmacy_dispensing (hospital_id);
create index idx_wards_hospital on public.hospital_wards (hospital_id);
create index idx_beds_hospital on public.hospital_beds (hospital_id);
create index idx_beds_ward on public.hospital_beds (ward_id);
create index idx_billing_hospital on public.hospital_billing (hospital_id);
create index idx_billing_patient on public.hospital_billing (patient_id);
create index idx_claims_hospital on public.insurance_claims (hospital_id);
create index idx_maternity_patient on public.maternity_records (patient_id);
create index idx_maternity_hospital on public.maternity_records (hospital_id);
create index idx_surgery_date on public.surgery_records (scheduled_date);
create index idx_surgery_patient on public.surgery_records (patient_id);
create index idx_surgery_hospital on public.surgery_records (hospital_id);
create index idx_referrals_hospital on public.hospital_referrals (hospital_id);
create index idx_referrals_referred_doctor on public.hospital_referrals (referred_to_doctor_id);
create index idx_patient_letters_doctor on public.patient_letters (doctor_id);
create index idx_patient_letters_patient on public.patient_letters (patient_id, issued_at desc);
create index idx_consultation_hospital on public.consultation_requests (requesting_hospital_id);
create index idx_consultation_requests_doctor on public.consultation_requests (doctor_id);
create index idx_consultation_requests_patient on public.consultation_requests (patient_id);
create index idx_payments_hospital on public.payments (hospital_id);
create index idx_payments_patient on public.payments (patient_id);
create index idx_payments_ref on public.payments (reference_id);
create index idx_payments_payer on public.payments (payer_user_id);
create index idx_function_calls_user on public.function_calls (user_id, fn, created_at);
create index idx_function_calls_subject on public.function_calls (subject_user_id, fn, created_at);

-- -----------------------------------------------------------------------------
-- 4. Private helper functions (used by RLS policies; not exposed by the API)
--
-- All are SECURITY DEFINER with an empty search_path so they can read the
-- tables they check without recursing into RLS. Each one answers a question
-- about the *calling* user (auth.uid()); none takes a user id argument (N9).
-- -----------------------------------------------------------------------------

-- True when the statement is not running as a browser role, i.e. it comes from
-- the service role, a SECURITY DEFINER function owned by postgres, or SQL run by
-- the owner. Must stay SECURITY INVOKER: it reads current_user.
create or replace function private.is_trusted()
returns boolean
language sql stable
set search_path = ''
as $$ select current_user not in ('anon', 'authenticated') $$;

create or replace function private.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.platform_admins where user_id = auth.uid()) $$;

create or replace function private.my_doctor_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$ select id from public.doctors where user_id = auth.uid() $$;

create or replace function private.my_patient_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$ select id from public.patients where user_id = auth.uid() $$;

create or replace function private.is_own_patient(_patient_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.patients where id = _patient_id and user_id = auth.uid())
$$;

create or replace function private.is_hospital_staff(_hospital_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.hospital_staff
    where user_id = auth.uid() and hospital_id = _hospital_id and is_active)
$$;

create or replace function private.is_hospital_admin(_hospital_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.hospital_staff
    where user_id = auth.uid() and hospital_id = _hospital_id and is_active and role = 'admin')
$$;

-- #9: only an accepted, active link counts.
create or replace function private.doctor_is_active_at(_doctor_id uuid, _hospital_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.hospital_doctors
    where doctor_id = _doctor_id and hospital_id = _hospital_id
      and status = 'active' and is_active)
$$;

create or replace function private.is_active_doctor_at(_hospital_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select private.doctor_is_active_at(private.my_doctor_id(), _hospital_id) $$;

create or replace function private.doctor_is_approved(_doctor_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.doctors where id = _doctor_id and verification_status = 'approved') $$;

-- Patient-facing visibility: only active hospitals approved by a platform admin.
create or replace function private.hospital_is_public(_hospital_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.hospitals
                 where id = _hospital_id and is_active and verification_status = 'approved')
$$;

-- The calling doctor has any link (including a pending invite) to the hospital,
-- so invitations from unverified hospitals still show the hospital's name.
create or replace function private.doctor_linked_to_hospital(_hospital_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.hospital_doctors
                 where hospital_id = _hospital_id and doctor_id = private.my_doctor_id())
$$;

-- The calling patient is registered at the hospital (so they can see its name
-- on their own records, whatever its verification status).
create or replace function private.is_patient_of_hospital(_hospital_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.hospital_patients
                 where hospital_id = _hospital_id and patient_id = private.my_patient_id())
$$;

-- #14 / D5: does the hospital currently have (at least) this plan?
-- Telemedicine includes EMR. The 30-day trial covers EMR only.
create or replace function private.hospital_has_plan(_hospital_id uuid, _plan text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.hospitals h
    where h.id = _hospital_id
      and h.is_active
      and (
        (h.subscription_status = 'active'
          and coalesce(h.plan_expires_at, 'infinity'::timestamptz) > now()
          and (h.active_plan = _plan or (h.active_plan = 'telemedicine' and _plan = 'emr')))
        or
        (h.subscription_status = 'trialing'
          and _plan = 'emr'
          and h.trial_ends_at > now())
      ))
$$;

create or replace function private.can_staff_work_at(_hospital_id uuid, _plan text default 'emr')
returns boolean
language sql stable security definer
set search_path = ''
as $$ select private.is_hospital_staff(_hospital_id) and private.hospital_has_plan(_hospital_id, _plan) $$;

create or replace function private.can_doctor_work_at(_hospital_id uuid, _plan text default 'emr')
returns boolean
language sql stable security definer
set search_path = ''
as $$ select private.is_active_doctor_at(_hospital_id) and private.hospital_has_plan(_hospital_id, _plan) $$;

-- Staff member or active doctor of a hospital that has the plan.
create or replace function private.can_work_at(_hospital_id uuid, _plan text default 'emr')
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (private.is_hospital_staff(_hospital_id) or private.is_active_doctor_at(_hospital_id))
     and private.hospital_has_plan(_hospital_id, _plan)
$$;

create or replace function private.patient_linked(_hospital_id uuid, _patient_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.hospital_patients where hospital_id = _hospital_id and patient_id = _patient_id)
$$;

-- Doctor's direct care relationship that is not tied to their own hospital
-- (their own consultations, external specialist consultation requests).
create or replace function private.doctor_has_direct_care(_patient_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  with me as (select private.my_doctor_id() as d)
  select (select d from me) is not null and (
    exists (select 1 from public.consultations c
            where c.patient_id = _patient_id and c.doctor_id = (select d from me))
    or exists (select 1 from public.consultation_requests cr
               where cr.patient_id = _patient_id and cr.doctor_id = (select d from me)
                 and cr.status in ('pending', 'accepted', 'completed')))
$$;

-- #1: who may read a patient's demographics.
create or replace function private.can_read_patient(_patient_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select private.is_own_patient(_patient_id)
      or exists (select 1 from public.hospital_patients hp
                 where hp.patient_id = _patient_id and private.can_work_at(hp.hospital_id, 'emr'))
      or private.doctor_has_direct_care(_patient_id)
$$;

-- #2: hospital staff may edit demographics of patients linked to their hospital.
create or replace function private.can_staff_edit_patient(_patient_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.hospital_patients hp
                 where hp.patient_id = _patient_id and private.can_staff_work_at(hp.hospital_id, 'emr'))
$$;

-- Hospital staff can see doctors linked to their hospital (any link status),
-- so invites and pending doctors show up in their lists.
create or replace function private.doctor_linked_to_my_hospital(_doctor_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.hospital_doctors hd
                 where hd.doctor_id = _doctor_id and private.is_hospital_staff(hd.hospital_id))
$$;

-- #8 / #9: hospital admins may read a doctor's private profile and credentials
-- only once the doctor has accepted (active link).
create or replace function private.is_hospital_admin_of_doctor(_doctor_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.hospital_doctors hd
                 where hd.doctor_id = _doctor_id and hd.status = 'active' and hd.is_active
                   and private.is_hospital_admin(hd.hospital_id))
$$;

-- Storage: may the caller read credential files stored under <owner uid>/... ?
create or replace function private.can_view_doctor_credentials(_owner_folder text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select _owner_folder = auth.uid()::text
      or private.is_platform_admin()
      or exists (select 1 from public.doctors d
                 where d.user_id::text = _owner_folder and private.is_hospital_admin_of_doctor(d.id))
$$;

-- Consultation workspace (from drizzle 0000, rewritten for the new helpers).
-- Returns 'owner' | 'staff' | 'doctor_read' | 'patient' | null.
create or replace function private.consultation_access(_consultation_id uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select case
    when c.doctor_id = private.my_doctor_id() and private.can_doctor_work_at(c.hospital_id, 'emr') then 'owner'
    when private.can_staff_work_at(c.hospital_id, 'emr') then 'staff'
    when c.doctor_id = private.my_doctor_id() then 'doctor_read'
    when private.can_doctor_work_at(c.hospital_id, 'emr') then 'doctor_read'
    when c.submitted_at is not null and private.is_own_patient(c.patient_id) then 'patient'
  end
  from public.consultations c
  where c.id = _consultation_id
$$;

create or replace function private.consultation_is_open(_consultation_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.consultations where id = _consultation_id and submitted_at is null) $$;

create or replace function private.consultation_hospital_id(_consultation_id uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$ select hospital_id from public.consultations where id = _consultation_id $$;

-- Lab order helpers (lab_result_tests / lab_result_parameters inherit from lab_results).
create or replace function private.can_read_lab_order(_lab_result_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.lab_results lr
                 where lr.id = _lab_result_id
                   and (private.can_work_at(lr.hospital_id, 'emr')
                        or lr.ordered_by = private.my_doctor_id()
                        or private.is_own_patient(lr.patient_id)))
$$;

create or replace function private.can_work_on_lab_order(_lab_result_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.lab_results lr
                 where lr.id = _lab_result_id and private.can_work_at(lr.hospital_id, 'emr'))
$$;

create or replace function private.lab_test_order_id(_test_id uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$ select lab_result_id from public.lab_result_tests where id = _test_id $$;

-- #7: is the caller the patient or the doctor on this call?
create or replace function private.is_call_participant(_kind text, _id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case _kind
    when 'appointment' then exists (
      select 1 from public.patient_appointments a
      where a.id = _id and a.is_telemedicine
        and (a.doctor_id = private.my_doctor_id() or private.is_own_patient(a.patient_id)))
    when 'consultation_request' then exists (
      select 1 from public.consultation_requests r
      where r.id = _id and r.status = 'accepted'
        and (r.doctor_id = private.my_doctor_id() or private.is_own_patient(r.patient_id)))
    else false
  end
$$;

-- Messaging: the caller may message _to_user_id only inside a care relationship.
create or replace function private.can_message(_to_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select
    -- doctor / staff -> a patient they can read
    exists (select 1 from public.patients p where p.user_id = _to_user_id and private.can_read_patient(p.id))
    -- patient -> a doctor they have an appointment, consultation or request with
    or exists (
      select 1 from public.doctors d
      where d.user_id = _to_user_id
        and (exists (select 1 from public.patient_appointments a
                     where a.doctor_id = d.id and private.is_own_patient(a.patient_id))
             or exists (select 1 from public.consultations c
                        where c.doctor_id = d.id and private.is_own_patient(c.patient_id))
             or exists (select 1 from public.consultation_requests r
                        where r.doctor_id = d.id and private.is_own_patient(r.patient_id))))
$$;

-- Creates the profile for a new user from their signup metadata.
-- N1: doctors start 'unverified'. N5/D5: hospitals start on a 30-day EMR trial.
create or replace function private.provision_user(_uid uuid, _email text, _meta jsonb)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  _role text := _meta->>'role';
  _hid uuid;
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

  else
    return null;
  end if;

  return _role;
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. Public functions: notification helpers and trigger functions
--    (no EXECUTE for anon/authenticated; called only by triggers / definer code)
-- -----------------------------------------------------------------------------

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.patient_display_name(_patient_id uuid)
returns text
language sql stable security definer
set search_path = ''
as $$
  select coalesce(first_name, '') || ' ' || coalesce(last_name, '') from public.patients where id = _patient_id
$$;

create or replace function public.patient_user_id(_patient_id uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$ select user_id from public.patients where id = _patient_id $$;

create or replace function public.doctor_user_id(_doctor_id uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$ select user_id from public.doctors where id = _doctor_id $$;

create or replace function public.emit_hospital_notification(
  _hospital_id uuid, _type text, _title text, _message text,
  _reference_id uuid default null, _reference_type text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if _hospital_id is null then return; end if;
  insert into public.hospital_notifications (hospital_id, type, title, message, reference_id, reference_type, is_read)
  values (_hospital_id, _type, _title, _message, _reference_id, _reference_type, false);
end;
$$;

create or replace function public.emit_user_notification(
  _user_id uuid, _audience text, _type text, _title text, _message text,
  _reference_id uuid default null, _reference_type text default null, _action_url text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if _user_id is null then return; end if;
  insert into public.user_notifications (user_id, audience, type, title, message, reference_id, reference_type, action_url)
  values (_user_id, _audience, _type, _title, _message, _reference_id, _reference_type, _action_url);
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform private.provision_user(new.id, new.email, coalesce(new.raw_user_meta_data, '{}'::jsonb));
  return new;
end;
$$;

create or replace function public.recompute_lab_order_status(_order_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  total int;
  pending_ct int;
  current_status text;
begin
  select status into current_status from public.lab_results where id = _order_id;
  if current_status = 'cancelled' then
    return;
  end if;

  select count(*), count(*) filter (where status <> 'completed')
    into total, pending_ct
    from public.lab_result_tests
    where lab_result_id = _order_id;

  if total > 0 and pending_ct = 0 then
    update public.lab_results set status = 'completed', updated_at = now() where id = _order_id;
  else
    update public.lab_results set status = 'pending', updated_at = now() where id = _order_id;
  end if;
end;
$$;

create or replace function public.lab_result_tests_status_sync()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_lab_order_status(old.lab_result_id);
    return old;
  else
    perform public.recompute_lab_order_status(new.lab_result_id);
    return new;
  end if;
end;
$$;

create or replace function public.notify_appointment()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_hospital_notification(new.hospital_id, 'consultation', 'New appointment request',
      public.patient_display_name(new.patient_id) || ' requested ' || new.requested_date::text ||
      coalesce(' at ' || new.requested_time::text, ''), new.id, 'appointment');
  else
    if new.requested_date is distinct from old.requested_date
       or new.requested_time is distinct from old.requested_time then
      perform public.emit_hospital_notification(new.hospital_id, 'consultation', 'Appointment rescheduled',
        public.patient_display_name(new.patient_id) || ' moved to ' || new.requested_date::text ||
        coalesce(' at ' || new.requested_time::text, ''), new.id, 'appointment');
    elsif new.status is distinct from old.status then
      perform public.emit_hospital_notification(new.hospital_id, 'consultation',
        'Appointment ' || new.status,
        public.patient_display_name(new.patient_id) || '''s appointment is now ' || new.status, new.id, 'appointment');
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.notify_billing()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_hospital_notification(new.hospital_id, 'billing', 'New bill created',
      '₦' || new.total::text || ' billed to ' || public.patient_display_name(new.patient_id), new.id, 'billing');
  elsif new.payment_status is distinct from old.payment_status and new.payment_status = 'paid' then
    perform public.emit_hospital_notification(new.hospital_id, 'billing', 'Payment received',
      '₦' || new.total::text || ' paid by ' || public.patient_display_name(new.patient_id), new.id, 'billing');
  end if;
  return new;
end;
$$;

-- N7: 'called' and 'call_in' are now valid values.
create or replace function public.notify_checkin()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_hospital_notification(new.hospital_id, 'checkin', 'New patient check-in',
      public.patient_display_name(new.patient_id) || ' checked in' ||
      coalesce(' (queue #' || new.queue_number || ')', ''), new.id, 'checkin');
    if new.urgency = 'emergency' then
      perform public.emit_hospital_notification(new.hospital_id, 'emergency', 'Emergency case',
        public.patient_display_name(new.patient_id) || ' arrived as an emergency', new.id, 'checkin');
    end if;
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'called' then
    perform public.emit_hospital_notification(new.hospital_id, 'call_in', 'Patient called in',
      public.patient_display_name(new.patient_id) || ' has been called in', new.id, 'checkin');
  end if;
  return new;
end;
$$;

create or replace function public.notify_claim()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_hospital_notification(new.hospital_id, 'billing', 'Insurance claim filed',
      new.insurance_provider || ' claim of ₦' || new.claim_amount::text || ' filed', new.id, 'claim');
  elsif new.status is distinct from old.status then
    perform public.emit_hospital_notification(new.hospital_id, 'billing', 'Claim ' || new.status,
      new.insurance_provider || ' claim is now ' || new.status, new.id, 'claim');
  end if;
  return new;
end;
$$;

create or replace function public.notify_consultation_request()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_hospital_notification(new.requesting_hospital_id, 'consultation', 'Consultation requested',
      'Specialist consult requested for ' || public.patient_display_name(new.patient_id), new.id, 'consultation');
    perform public.emit_user_notification(public.doctor_user_id(new.doctor_id), 'doctor', 'consultation',
      'New consultation request',
      'A hospital requested a consultation for ' || public.patient_display_name(new.patient_id),
      new.id, 'consultation', '/doctor/consultations');
  elsif new.status is distinct from old.status then
    perform public.emit_hospital_notification(new.requesting_hospital_id, 'consultation',
      'Consultation ' || new.status,
      'Consult for ' || public.patient_display_name(new.patient_id) || ' is now ' || new.status, new.id, 'consultation');
  end if;
  return new;
end;
$$;

create or replace function public.notify_lab_status()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_hospital_notification(new.hospital_id, 'lab', 'New lab order',
      'Lab order created for ' || public.patient_display_name(new.patient_id), new.id, 'lab_result');
  elsif new.status is distinct from old.status and new.status = 'completed' then
    perform public.emit_hospital_notification(new.hospital_id, 'lab', 'Lab results ready',
      'Results are ready for ' || public.patient_display_name(new.patient_id), new.id, 'lab_result');
  end if;
  return new;
end;
$$;

-- N8: patients request letters with status 'pending' (there is no 'requested').
create or replace function public.notify_letter()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' then
      perform public.emit_hospital_notification(new.hospital_id, 'consultation', 'Letter requested',
        public.patient_display_name(new.patient_id) || ' requested: ' || new.title, new.id, 'letter');
    else
      perform public.emit_hospital_notification(new.hospital_id, 'consultation', 'Document issued',
        new.title || ' issued for ' || public.patient_display_name(new.patient_id), new.id, 'letter');
    end if;
  elsif new.status is distinct from old.status and new.status = 'issued' then
    perform public.emit_hospital_notification(new.hospital_id, 'consultation', 'Document issued',
      new.title || ' issued for ' || public.patient_display_name(new.patient_id), new.id, 'letter');
  end if;
  return new;
end;
$$;

create or replace function public.notify_low_stock()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.reorder_level is not null and new.quantity_in_stock is not null
     and new.quantity_in_stock <= new.reorder_level
     and (tg_op = 'INSERT'
          or old.quantity_in_stock > old.reorder_level
          or (old.quantity_in_stock is distinct from new.quantity_in_stock
              and old.quantity_in_stock > new.quantity_in_stock
              and old.quantity_in_stock > coalesce(old.reorder_level, 0))) then
    perform public.emit_hospital_notification(new.hospital_id, 'pharmacy', 'Low stock alert',
      new.drug_name || ' is down to ' || new.quantity_in_stock::text || ' units', new.id, 'inventory');
  end if;
  return new;
end;
$$;

create or replace function public.notify_prescription()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.emit_hospital_notification(new.hospital_id, 'pharmacy', 'New prescription',
    new.drug_name || ' prescribed for ' || public.patient_display_name(new.patient_id), new.id, 'prescription');
  return new;
end;
$$;

create or replace function public.notify_user_appointment()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  p uuid;
  d uuid;
  when_txt text;
begin
  p := public.patient_user_id(new.patient_id);
  d := public.doctor_user_id(new.doctor_id);
  when_txt := new.requested_date::text || coalesce(' at ' || to_char(new.requested_time, 'HH24:MI'), '');
  if tg_op = 'INSERT' then
    perform public.emit_user_notification(p, 'patient', 'appointment', 'Appointment requested',
      'Your appointment request for ' || when_txt || ' was submitted.', new.id, 'appointment', '/patient/appointments');
    perform public.emit_user_notification(d, 'doctor', 'appointment', 'New appointment request',
      public.patient_display_name(new.patient_id) || ' requested ' || when_txt, new.id, 'appointment', '/doctor/appointments');
  elsif new.requested_date is distinct from old.requested_date or new.requested_time is distinct from old.requested_time then
    perform public.emit_user_notification(p, 'patient', 'appointment', 'Appointment rescheduled',
      'Your appointment moved to ' || when_txt, new.id, 'appointment', '/patient/appointments');
    perform public.emit_user_notification(d, 'doctor', 'appointment', 'Appointment rescheduled',
      public.patient_display_name(new.patient_id) || ' moved to ' || when_txt, new.id, 'appointment', '/doctor/appointments');
  elsif new.status is distinct from old.status then
    perform public.emit_user_notification(p, 'patient', 'appointment', 'Appointment ' || new.status,
      'Your appointment on ' || when_txt || ' is now ' || new.status, new.id, 'appointment', '/patient/appointments');
    perform public.emit_user_notification(d, 'doctor', 'appointment', 'Appointment ' || new.status,
      public.patient_display_name(new.patient_id) || '''s appointment is now ' || new.status, new.id, 'appointment', '/doctor/appointments');
  end if;
  return new;
end;
$$;

create or replace function public.notify_user_billing()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.emit_user_notification(public.patient_user_id(new.patient_id), 'patient', 'billing', 'New bill',
      'A bill of ₦' || new.total::text || ' was added to your account.', new.id, 'billing', '/patient');
  elsif new.payment_status is distinct from old.payment_status and new.payment_status = 'paid' then
    perform public.emit_user_notification(public.patient_user_id(new.patient_id), 'patient', 'billing', 'Payment confirmed',
      'Your payment of ₦' || new.total::text || ' was received.', new.id, 'billing', '/patient');
  end if;
  return new;
end;
$$;

create or replace function public.notify_user_checkin()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status and new.status = 'called' then
    perform public.emit_user_notification(public.patient_user_id(new.patient_id), 'patient', 'call_in', 'It''s your turn',
      'Please proceed to the consulting room.', new.id, 'checkin', '/patient');
  end if;
  return new;
end;
$$;

create or replace function public.notify_user_lab()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'completed' then
    perform public.emit_user_notification(public.patient_user_id(new.patient_id), 'patient', 'lab', 'Your lab results are ready',
      'Your lab results have been published. Tap to view.', new.id, 'lab_result', '/patient/lab-results');
    perform public.emit_user_notification(public.doctor_user_id(new.ordered_by), 'doctor', 'lab', 'Lab results ready',
      'Results are ready for ' || public.patient_display_name(new.patient_id), new.id, 'lab_result', '/doctor/lab-orders');
  end if;
  return new;
end;
$$;

create or replace function public.notify_user_letter()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.emit_user_notification(public.doctor_user_id(new.doctor_id), 'doctor', 'letter', 'Letter requested',
      public.patient_display_name(new.patient_id) || ' requested: ' || new.title, new.id, 'letter', '/doctor/patients');
  elsif (tg_op = 'INSERT' and new.status <> 'pending')
     or (tg_op = 'UPDATE' and new.status is distinct from old.status and new.status = 'issued') then
    perform public.emit_user_notification(public.patient_user_id(new.patient_id), 'patient', 'letter', 'New document available',
      new.title || ' is ready in your Letters & Reports.', new.id, 'letter', '/patient/letters');
  end if;
  return new;
end;
$$;

create or replace function public.notify_user_prescription()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  perform public.emit_user_notification(public.patient_user_id(new.patient_id), 'patient', 'prescription', 'New prescription',
    new.drug_name || coalesce(' — ' || new.dosage, '') || ' was prescribed for you.', new.id, 'prescription', '/patient/prescriptions');
  return new;
end;
$$;

-- #18: in-app notifications for doctor invites/removals (replaces the
-- send-doctor-notification edge function, which never worked).
create or replace function public.notify_doctor_link()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  _doctor_name text;
  _hospital_name text;
  _row public.hospital_doctors;
begin
  if tg_op = 'DELETE' then
    _row := old;
  else
    _row := new;
  end if;
  select 'Dr. ' || coalesce(first_name, '') || ' ' || coalesce(last_name, '') into _doctor_name
    from public.doctors where id = _row.doctor_id;
  select name into _hospital_name from public.hospitals where id = _row.hospital_id;

  if tg_op = 'INSERT' then
    perform public.emit_hospital_notification(new.hospital_id, 'system', 'Doctor invited',
      coalesce(_doctor_name, 'A doctor') || ' was invited to join', new.id, 'hospital_doctor');
    perform public.emit_user_notification(public.doctor_user_id(new.doctor_id), 'doctor', 'invitation',
      'New hospital invitation', coalesce(_hospital_name, 'A hospital') || ' invited you to join.',
      new.id, 'invitation', '/doctor/invitations');
  elsif tg_op = 'UPDATE' then
    if new.status is distinct from old.status and new.status in ('active', 'declined') then
      perform public.emit_hospital_notification(new.hospital_id, 'system',
        case when new.status = 'active' then 'Invitation accepted' else 'Invitation declined' end,
        coalesce(_doctor_name, 'A doctor') || case when new.status = 'active' then ' joined your hospital' else ' declined your invitation' end,
        new.id, 'hospital_doctor');
    elsif new.is_active is distinct from old.is_active and not new.is_active then
      perform public.emit_user_notification(public.doctor_user_id(new.doctor_id), 'doctor', 'system',
        'Hospital access paused', coalesce(_hospital_name, 'A hospital') || ' deactivated your access.',
        new.hospital_id, 'hospital', '/doctor');
    end if;
  else
    perform public.emit_hospital_notification(old.hospital_id, 'system', 'Doctor removed',
      coalesce(_doctor_name, 'A doctor') || ' was removed', old.id, 'hospital_doctor');
    perform public.emit_user_notification(public.doctor_user_id(old.doctor_id), 'doctor', 'system',
      'Removed from hospital', 'You were removed from ' || coalesce(_hospital_name, 'a hospital') || '.',
      old.hospital_id, 'hospital', '/doctor');
    return old;
  end if;
  return new;
end;
$$;

-- D2: a patient who books an appointment (or is checked in) is linked to that hospital.
create or replace function public.link_patient_to_hospital()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.hospital_patients (hospital_id, patient_id, created_by)
  values (new.hospital_id, new.patient_id, auth.uid())
  on conflict do nothing;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Guard triggers (SECURITY INVOKER on purpose: they read current_user)
--    They are a backstop behind the column grants in section 9.
-- -----------------------------------------------------------------------------

-- #2: a patient record can never be handed to another account from the browser.
create or replace function private.guard_patients()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_trusted() and new.user_id is distinct from old.user_id then
    raise exception 'patients.user_id cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- #4 / #14: plan and subscription state belong to the service role;
-- verification state belongs to review_hospital().
create or replace function private.guard_hospitals()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_trusted() and (
       new.active_plan is distinct from old.active_plan
    or new.subscription_status is distinct from old.subscription_status
    or new.trial_ends_at is distinct from old.trial_ends_at
    or new.plan_expires_at is distinct from old.plan_expires_at
    or new.is_active is distinct from old.is_active) then
    raise exception 'Plan and subscription fields can only be changed by the billing system' using errcode = '42501';
  end if;
  if not private.is_trusted() and (
       new.verification_status is distinct from old.verification_status
    or new.verified_at is distinct from old.verified_at
    or new.verification_notes is distinct from old.verification_notes) then
    raise exception 'Hospital verification can only be changed by a platform admin' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- #5: verification, rating and credential fields change only through
-- submit_doctor_verification() / review_doctor() or the service role.
create or replace function private.guard_doctors()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not private.is_trusted() and (
       new.user_id is distinct from old.user_id
    or new.verification_status is distinct from old.verification_status
    or new.verification_submitted_at is distinct from old.verification_submitted_at
    or new.verification_reviewed_at is distinct from old.verification_reviewed_at
    or new.verification_rejection_reason is distinct from old.verification_rejection_reason
    or new.rating is distinct from old.rating
    or new.license_number is distinct from old.license_number
    or new.license_council is distinct from old.license_council
    or new.license_expiry is distinct from old.license_expiry
    or new.credential_documents is distinct from old.credential_documents
    or new.reference_contact is distinct from old.reference_contact
    or new.current_practice is distinct from old.current_practice) then
    raise exception 'Verification fields can only be changed through the verification process' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- #6 / #9: invites always start pending + inactive; only the doctor (via
-- respond_to_invitation) can activate; staff may only deactivate.
create or replace function private.guard_hospital_doctors()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.is_active := false;
    return new;
  end if;
  if new.hospital_id is distinct from old.hospital_id
     or new.doctor_id is distinct from old.doctor_id
     or new.status is distinct from old.status
     or (new.is_active and not old.is_active) then
    raise exception 'This change to a hospital-doctor link is not allowed' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- N10: a patient may only reschedule or cancel their own appointment.
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
     or new.meeting_link is distinct from old.meeting_link then
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

create or replace function private.consultation_has_payment(_request_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.payments
                 where purpose = 'consultation' and reference_id = _request_id and status = 'success')
$$;

-- #7 / #3: call and fee fields. Room/recording/payment fields are service-role
-- only; the agreed fee can only be set by the consulted doctor, and is locked
-- once the request is accepted or paid (the Paystack function charges it).
create or replace function private.guard_consultation_requests()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if private.is_trusted() then
    return new;
  end if;
  if new.requesting_hospital_id is distinct from old.requesting_hospital_id
     or new.doctor_id is distinct from old.doctor_id
     or new.patient_id is distinct from old.patient_id
     or new.meeting_link is distinct from old.meeting_link
     or new.daily_room_name is distinct from old.daily_room_name
     or new.video_provider is distinct from old.video_provider
     or new.recording_url is distinct from old.recording_url
     or new.recording_status is distinct from old.recording_status
     or new.call_started_at is distinct from old.call_started_at
     or new.call_ended_at is distinct from old.call_ended_at
     or new.paid_at is distinct from old.paid_at then
    raise exception 'This consultation field cannot be changed' using errcode = '42501';
  end if;
  if new.fee_agreed is distinct from old.fee_agreed then
    if old.status in ('accepted', 'completed')
       or old.paid_at is not null
       or private.consultation_has_payment(old.id) then
      raise exception 'The fee is locked once the consultation is accepted' using errcode = '42501';
    end if;
    if old.doctor_id is distinct from private.my_doctor_id() then
      raise exception 'Only the consulted doctor can set the fee' using errcode = '42501';
    end if;
  end if;
  -- An accepted request cannot be reopened to unlock the fee.
  if old.status in ('accepted', 'completed') and new.status = 'pending' then
    raise exception 'An accepted consultation cannot be reopened' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Public RPCs (EXECUTE granted to authenticated in section 9)
-- -----------------------------------------------------------------------------

-- N9 replacements for get_user_doctor_id / get_user_hospital_id / get_doctor_hospital_id.
create or replace function public.my_doctor_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$ select private.my_doctor_id() $$;

create or replace function public.my_hospital_ids()
returns table (hospital_id uuid, membership text, role text)
language sql stable security definer
set search_path = ''
as $$
  select hs.hospital_id, 'staff'::text, hs.role
    from public.hospital_staff hs
   where hs.user_id = auth.uid() and hs.is_active
  union all
  select hd.hospital_id, 'doctor'::text, null::text
    from public.hospital_doctors hd
   where hd.doctor_id = private.my_doctor_id() and hd.status = 'active' and hd.is_active
$$;

-- #7: used by the daily-room edge function (with the caller's JWT) before it
-- issues a meeting token. _kind is 'appointment' or 'consultation_request'.
create or replace function public.can_join_call(_kind text, _id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$ select private.is_call_participant(_kind, _id) $$;

-- Approved, active hospitals where an approved doctor is actively practising
-- (for patient booking).
create or replace function public.doctor_hospital_ids(_doctor_id uuid)
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select hd.hospital_id
    from public.hospital_doctors hd
    join public.doctors d on d.id = hd.doctor_id
    join public.hospitals h on h.id = hd.hospital_id
   where hd.doctor_id = _doctor_id and hd.status = 'active' and hd.is_active
     and d.verification_status = 'approved'
     and h.is_active and h.verification_status = 'approved'
$$;

-- For Google/OAuth sign-ups, which carry no role metadata.
create or replace function public.complete_signup(p_role text, p_data jsonb default '{}'::jsonb)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
  _email text;
begin
  if _uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_role not in ('patient', 'doctor', 'hospital') then
    raise exception 'Invalid role';
  end if;
  if exists (select 1 from public.patients where user_id = _uid)
     or exists (select 1 from public.doctors where user_id = _uid)
     or exists (select 1 from public.hospital_staff where user_id = _uid) then
    raise exception 'This account already has a profile';
  end if;
  select email into _email from auth.users where id = _uid;
  return private.provision_user(_uid, _email, coalesce(p_data, '{}'::jsonb) || jsonb_build_object('role', p_role));
end;
$$;

-- #1 / #2 / D2: hospital staff register a patient; the link is created atomically.
create or replace function public.register_patient(p_hospital_id uuid, p_patient jsonb)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  _pid uuid;
begin
  if not private.can_staff_work_at(p_hospital_id, 'emr') then
    raise exception 'Not allowed to register patients for this hospital' using errcode = '42501';
  end if;
  if coalesce(trim(p_patient->>'first_name'), '') = '' or coalesce(trim(p_patient->>'last_name'), '') = '' then
    raise exception 'First and last name are required';
  end if;

  insert into public.patients (
    first_name, last_name, email, phone, date_of_birth, gender, blood_group, genotype,
    address, city, state, emergency_contact_name, emergency_contact_phone,
    insurance_provider, insurance_policy_number)
  values (
    trim(p_patient->>'first_name'),
    trim(p_patient->>'last_name'),
    nullif(trim(p_patient->>'email'), ''),
    nullif(trim(p_patient->>'phone'), ''),
    nullif(p_patient->>'date_of_birth', '')::date,
    nullif(p_patient->>'gender', ''),
    nullif(p_patient->>'blood_group', ''),
    nullif(p_patient->>'genotype', ''),
    nullif(p_patient->>'address', ''),
    nullif(p_patient->>'city', ''),
    nullif(p_patient->>'state', ''),
    nullif(p_patient->>'emergency_contact_name', ''),
    nullif(p_patient->>'emergency_contact_phone', ''),
    nullif(p_patient->>'insurance_provider', ''),
    nullif(p_patient->>'insurance_policy_number', ''))
  returning id into _pid;

  insert into public.hospital_patients (hospital_id, patient_id, created_by)
  values (p_hospital_id, _pid, auth.uid());

  return _pid;
end;
$$;

-- #6: the invited doctor accepts or declines.
create or replace function public.respond_to_invitation(p_link_id uuid, p_accept boolean)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  update public.hospital_doctors
     set status = case when p_accept then 'active' else 'declined' end,
         is_active = coalesce(p_accept, false)
   where id = p_link_id
     and doctor_id = private.my_doctor_id()
     and status = 'pending';
  if not found then
    raise exception 'Invitation not found or already answered';
  end if;
end;
$$;

-- #5: the doctor submits credentials for review.
create or replace function public.submit_doctor_verification(p_data jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  _docs jsonb := p_data->'credential_documents';
begin
  if _docs is not null and jsonb_typeof(_docs) <> 'null' then
    if jsonb_typeof(_docs) <> 'object' then
      raise exception 'credential_documents must be an object of storage paths';
    end if;
    if exists (select 1 from jsonb_each_text(_docs) e
               where e.value is not null and e.value not like auth.uid()::text || '/%') then
      raise exception 'Credential files must be in your own folder' using errcode = '42501';
    end if;
  end if;

  update public.doctors
     set license_number = nullif(trim(p_data->>'license_number'), ''),
         license_council = nullif(trim(p_data->>'license_council'), ''),
         license_expiry = nullif(p_data->>'license_expiry', '')::date,
         specialty = coalesce(nullif(trim(p_data->>'specialty'), ''), specialty),
         years_experience = coalesce(nullif(p_data->>'years_experience', '')::int, years_experience),
         current_practice = p_data->'current_practice',
         credential_documents = _docs,
         reference_contact = p_data->'reference_contact',
         verification_status = 'pending_review',
         verification_submitted_at = now(),
         verification_rejection_reason = null
   where user_id = auth.uid()
     and verification_status in ('unverified', 'rejected');
  if not found then
    raise exception 'Verification cannot be submitted right now';
  end if;
end;
$$;

-- #5 / D1: a platform admin approves or rejects a doctor.
create or replace function public.review_doctor(p_doctor_id uuid, p_approve boolean, p_reason text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not private.is_platform_admin() then
    raise exception 'Only platform admins can review doctors' using errcode = '42501';
  end if;
  update public.doctors
     set verification_status = case when p_approve then 'approved' else 'rejected' end,
         verification_reviewed_at = now(),
         verification_rejection_reason = case when p_approve then null else p_reason end
   where id = p_doctor_id;
  if not found then
    raise exception 'Doctor not found';
  end if;
  perform public.emit_user_notification(public.doctor_user_id(p_doctor_id), 'doctor', 'verification',
    case when p_approve then 'Verification approved' else 'Verification not approved' end,
    case when p_approve then 'Your credentials were approved. Welcome to HealingNet.'
         else coalesce('Reason: ' || p_reason, 'Please review and resubmit your credentials.') end,
    p_doctor_id, 'doctor', '/doctor/verification');
end;
$$;

-- A platform admin approves or rejects a hospital. Only approved hospitals are
-- visible to patients (booking, discovery, consultation requests).
create or replace function public.review_hospital(p_hospital_id uuid, p_approve boolean, p_notes text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  _name text;
  _admin uuid;
begin
  if not private.is_platform_admin() then
    raise exception 'Only platform admins can review hospitals' using errcode = '42501';
  end if;
  update public.hospitals
     set verification_status = case when p_approve then 'approved' else 'rejected' end,
         verified_at = case when p_approve then now() else null end,
         verification_notes = p_notes
   where id = p_hospital_id
  returning name into _name;
  if not found then
    raise exception 'Hospital not found';
  end if;

  perform public.emit_hospital_notification(p_hospital_id, 'system',
    case when p_approve then 'Hospital verified' else 'Hospital verification not approved' end,
    case when p_approve then _name || ' is now visible to patients on HealingNet.'
         else coalesce('Reason: ' || p_notes, 'Please contact HealingNet support.') end,
    p_hospital_id, 'hospital');

  for _admin in
    select user_id from public.hospital_staff
     where hospital_id = p_hospital_id and role = 'admin' and is_active
  loop
    perform public.emit_user_notification(_admin, 'hospital', 'verification',
      case when p_approve then 'Hospital verified' else 'Hospital verification not approved' end,
      case when p_approve then _name || ' is now visible to patients on HealingNet.'
           else coalesce('Reason: ' || p_notes, 'Please contact HealingNet support.') end,
      p_hospital_id, 'hospital', '/hospital/settings');
  end loop;
end;
$$;

-- #8: full doctor record for the doctor, platform admins, and admins of a
-- hospital where the doctor is active.
create or replace function public.doctor_private_profile(p_doctor_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  _row jsonb;
begin
  select to_jsonb(d) into _row from public.doctors d where d.id = p_doctor_id;
  if _row is null then
    return null;
  end if;
  if (_row->>'user_id')::uuid is distinct from auth.uid()
     and not private.is_platform_admin()
     and not private.is_hospital_admin_of_doctor(p_doctor_id) then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return _row;
end;
$$;

-- #3 / #22: settle a payment once Paystack has confirmed it. Called only by the
-- Paystack edge functions (service role) after they re-verify the transaction.
-- Returns false, with no side effects, if the payment is already settled or the
-- amount/currency does not match what we asked for.
create or replace function private.fulfill_payment(p_payment_id uuid, p_paid_amount bigint, p_currency text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  p public.payments;
  _start timestamptz;
  _expires timestamptz;
  _naira text;
  _sub_id uuid;
begin
  update public.payments
     set status = 'success', paid_at = now()
   where id = p_payment_id
     and status <> 'success'
     and amount = p_paid_amount
     and currency = p_currency
  returning * into p;
  if not found then
    return false;
  end if;

  _naira := '₦' || to_char(p.amount / 100.0, 'FM999,999,999,990.00');

  if p.purpose = 'subscription' then
    -- Renewing the same plan extends from the current end date; anything else starts now.
    select case
             when h.subscription_status = 'active' and h.active_plan = p.plan and h.plan_expires_at > now()
             then h.plan_expires_at else now()
           end
      into _start
      from public.hospitals h
     where h.id = p.hospital_id
       for update;
    if _start is null then
      raise exception 'Hospital not found for payment %', p.id;
    end if;
    _expires := _start + case when p.billing_cycle = 'yearly' then interval '1 year' else interval '1 month' end;

    update public.hospitals
       set active_plan = p.plan,
           subscription_status = 'active',
           plan_expires_at = _expires,
           trial_ends_at = null
     where id = p.hospital_id;

    -- Close the trial / pending rows and any active row for a different plan or cycle.
    update public.hospital_subscriptions
       set status = 'canceled'
     where hospital_id = p.hospital_id
       and (status in ('pending', 'trialing')
            or (status = 'active' and (plan <> p.plan or billing_cycle <> p.billing_cycle)));

    update public.hospital_subscriptions
       set expires_at = _expires
     where id = (select s.id from public.hospital_subscriptions s
                  where s.hospital_id = p.hospital_id and s.status = 'active'
                    and s.plan = p.plan and s.billing_cycle = p.billing_cycle
                  order by s.started_at desc
                  limit 1)
    returning id into _sub_id;
    if _sub_id is null then
      insert into public.hospital_subscriptions (hospital_id, plan, status, billing_cycle, started_at, expires_at)
      values (p.hospital_id, p.plan, 'active', p.billing_cycle, now(), _expires);
    end if;

    perform public.emit_hospital_notification(p.hospital_id, 'billing', 'Subscription active',
      initcap(p.plan) || ' plan paid (' || _naira || '), active until ' || to_char(_expires, 'DD Mon YYYY') || '.',
      p.id, 'payment');

  elsif p.purpose = 'billing' then
    -- notify_billing / notify_user_billing fire on the status change.
    update public.hospital_billing
       set payment_status = 'paid', paid_at = now(), payment_method = 'card'
     where id = p.reference_id and hospital_id = p.hospital_id;

  elsif p.purpose = 'pharmacy' then
    update public.pharmacy_dispensing
       set payment_status = 'paid'
     where id = p.reference_id and hospital_id = p.hospital_id;
    perform public.emit_hospital_notification(p.hospital_id, 'pharmacy', 'Pharmacy payment received',
      _naira || ' paid by ' || coalesce(public.patient_display_name(p.patient_id), 'a patient'), p.id, 'payment');

  elsif p.purpose = 'consultation' then
    update public.consultation_requests
       set paid_at = now()
     where id = p.reference_id;
    perform public.emit_hospital_notification(p.hospital_id, 'consultation', 'Consultation paid',
      _naira || ' paid for ' || coalesce(public.patient_display_name(p.patient_id), 'a patient') || '''s consultation',
      p.reference_id, 'consultation');
    perform public.emit_user_notification(public.doctor_user_id(p.payee_doctor_id), 'doctor', 'billing',
      'Consultation paid', 'The consultation fee of ' || _naira || ' has been paid.',
      p.reference_id, 'consultation', '/doctor/consultations');
  end if;

  return true;
end;
$$;

-- Thin wrapper so the edge functions can reach it through the Data API.
-- EXECUTE is granted to service_role only (section 9.11).
create or replace function public.fulfill_payment(p_payment_id uuid, p_paid_amount bigint, p_currency text)
returns boolean
language sql security definer
set search_path = ''
as $$ select private.fulfill_payment(p_payment_id, p_paid_amount, p_currency) $$;

-- #13: dispense against a prescription in one transaction.
create or replace function public.dispense_prescription(p_rx_id uuid, p_drug_id uuid, p_qty integer)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  _rx public.prescriptions;
  _drug public.pharmacy_inventory;
  _staff uuid;
  _id uuid;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  select * into _rx from public.prescriptions where id = p_rx_id for update;
  if not found then
    raise exception 'Prescription not found';
  end if;
  if not private.can_staff_work_at(_rx.hospital_id, 'emr') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if _rx.status <> 'active' then
    raise exception 'Prescription is not active';
  end if;

  update public.pharmacy_inventory
     set quantity_in_stock = quantity_in_stock - p_qty
   where id = p_drug_id and hospital_id = _rx.hospital_id and quantity_in_stock >= p_qty
  returning * into _drug;
  if not found then
    raise exception 'Drug not found or not enough stock';
  end if;

  select id into _staff from public.hospital_staff
   where user_id = auth.uid() and hospital_id = _rx.hospital_id and is_active
   limit 1;

  insert into public.pharmacy_dispensing
    (hospital_id, patient_id, drug_id, drug_name, dosage, quantity_dispensed, dispensed_by, prescription_id)
  values
    (_rx.hospital_id, _rx.patient_id, _drug.id, _drug.drug_name, _rx.dosage, p_qty, _staff, _rx.id)
  returning id into _id;

  update public.prescriptions set status = 'completed' where id = _rx.id;
  return _id;
end;
$$;

-- #13: dispense without a prescription (walk-in counter sale).
create or replace function public.dispense_drug(
  p_drug_id uuid, p_patient_id uuid, p_qty integer, p_dosage text default null, p_notes text default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  _drug public.pharmacy_inventory;
  _staff uuid;
  _id uuid;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;
  select * into _drug from public.pharmacy_inventory where id = p_drug_id;
  if not found or not private.can_staff_work_at(_drug.hospital_id, 'emr') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if not private.patient_linked(_drug.hospital_id, p_patient_id) then
    raise exception 'Patient is not registered at this hospital';
  end if;

  update public.pharmacy_inventory
     set quantity_in_stock = quantity_in_stock - p_qty
   where id = p_drug_id and quantity_in_stock >= p_qty
  returning * into _drug;
  if not found then
    raise exception 'Not enough stock';
  end if;

  select id into _staff from public.hospital_staff
   where user_id = auth.uid() and hospital_id = _drug.hospital_id and is_active
   limit 1;

  insert into public.pharmacy_dispensing
    (hospital_id, patient_id, drug_id, drug_name, dosage, quantity_dispensed, dispensed_by, notes)
  values
    (_drug.hospital_id, p_patient_id, _drug.id, _drug.drug_name, p_dosage, p_qty, _staff, p_notes)
  returning id into _id;
  return _id;
end;
$$;

-- #13: restock / correct stock (stock is not directly updatable by the browser).
create or replace function public.adjust_stock(p_drug_id uuid, p_delta integer)
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  _hid uuid;
  _qty integer;
begin
  select hospital_id into _hid from public.pharmacy_inventory where id = p_drug_id;
  if _hid is null or not private.can_staff_work_at(_hid, 'emr') then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  update public.pharmacy_inventory
     set quantity_in_stock = quantity_in_stock + p_delta
   where id = p_drug_id and quantity_in_stock + p_delta >= 0
  returning quantity_in_stock into _qty;
  if not found then
    raise exception 'Stock cannot go below zero';
  end if;
  return _qty;
end;
$$;

-- Audit #20: replace a doctor's availability in one transaction.
-- p_global = true replaces the global rows (hospital_id null); otherwise the rows
-- for p_hospital_ids are replaced.
create or replace function public.save_doctor_availability(p_global boolean, p_hospital_ids uuid[], p_slots jsonb)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  _d uuid := private.my_doctor_id();
begin
  if _d is null then
    raise exception 'Only doctors can save availability' using errcode = '42501';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_slots, '[]'::jsonb)) as x(hospital_id uuid)
     where x.hospital_id is not null and not private.doctor_is_active_at(_d, x.hospital_id)) then
    raise exception 'You are not active at one of these hospitals' using errcode = '42501';
  end if;

  if p_global then
    delete from public.doctor_availability where doctor_id = _d and hospital_id is null;
  else
    delete from public.doctor_availability where doctor_id = _d and hospital_id = any (coalesce(p_hospital_ids, '{}'));
  end if;

  insert into public.doctor_availability
    (doctor_id, hospital_id, day_of_week, start_time, end_time, is_available, accepts_virtual, accepts_in_person)
  select _d, x.hospital_id, x.day_of_week,
         coalesce(x.start_time, '09:00'), coalesce(x.end_time, '17:00'),
         coalesce(x.is_available, true), coalesce(x.accepts_virtual, false), coalesce(x.accepts_in_person, true)
    from jsonb_to_recordset(coalesce(p_slots, '[]'::jsonb)) as x(
      hospital_id uuid, day_of_week int, start_time time, end_time time,
      is_available boolean, accepts_virtual boolean, accepts_in_person boolean);
end;
$$;

-- Consultation workspace (from drizzle 0000, using the new helpers).
create or replace function public.start_consultation(
  p_patient_id uuid, p_checkin_id uuid default null, p_appointment_id uuid default null)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  d uuid;
  h uuid;
  cid uuid;
  src_patient uuid;
  m text := 'in_person';
begin
  d := private.my_doctor_id();
  if d is null then
    raise exception 'Only doctors can start a consultation';
  end if;

  if p_checkin_id is not null then
    select hospital_id, patient_id into h, src_patient from public.patient_checkins where id = p_checkin_id;
  elsif p_appointment_id is not null then
    select hospital_id, patient_id, case when is_telemedicine then 'telemedicine' else 'in_person' end
      into h, src_patient, m
      from public.patient_appointments where id = p_appointment_id;
  else
    -- Ad-hoc consultation: the doctor's (first) active hospital where the patient is registered.
    select hp.hospital_id into h
      from public.hospital_patients hp
     where hp.patient_id = p_patient_id and private.doctor_is_active_at(d, hp.hospital_id)
     order by hp.created_at
     limit 1;
    src_patient := p_patient_id;
  end if;

  -- All access checks happen before any consultation id is returned.
  if src_patient is distinct from p_patient_id then
    raise exception 'Patient does not match this check-in or appointment';
  end if;
  if h is null or not private.doctor_is_active_at(d, h) then
    raise exception 'You are not attached to this hospital';
  end if;
  if not private.hospital_has_plan(h, case when m = 'telemedicine' then 'telemedicine' else 'emr' end) then
    raise exception 'Hospital plan does not include consultations';
  end if;

  -- Resume the open consultation for this check-in / appointment, if any.
  if p_checkin_id is not null then
    select id into cid from public.consultations
     where checkin_id = p_checkin_id and hospital_id = h and submitted_at is null;
  elsif p_appointment_id is not null then
    select id into cid from public.consultations
     where appointment_id = p_appointment_id and hospital_id = h and submitted_at is null;
  end if;
  if cid is not null then
    return cid;
  end if;

  insert into public.consultations (hospital_id, patient_id, doctor_id, checkin_id, appointment_id, mode)
  values (h, p_patient_id, d, p_checkin_id, p_appointment_id, m)
  returning id into cid;
  return cid;
exception when unique_violation then
  -- A concurrent call created it first. Re-check access before returning its id.
  if d is null or h is null or not private.doctor_is_active_at(d, h) then
    raise exception 'You are not attached to this hospital';
  end if;
  select id into cid from public.consultations
   where submitted_at is null and hospital_id = h
     and ((p_checkin_id is not null and checkin_id = p_checkin_id)
          or (p_appointment_id is not null and appointment_id = p_appointment_id))
   limit 1;
  return cid;
end;
$$;

create or replace function public.submit_consultation(p_consultation_id uuid)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.consultations%rowtype;
  n_rx int := 0;
  n_lab int;
  n_dx int;
begin
  select * into c from public.consultations where id = p_consultation_id for update;
  if not found then
    raise exception 'Consultation not found';
  end if;
  if c.doctor_id is distinct from private.my_doctor_id() then
    raise exception 'Not your consultation';
  end if;
  if not private.doctor_is_active_at(c.doctor_id, c.hospital_id) then
    raise exception 'You are no longer attached to this hospital';
  end if;
  if c.submitted_at is not null then
    raise exception 'Consultation already submitted';
  end if;
  if coalesce(trim(c.provisional_diagnosis), '') = '' then
    raise exception 'Provisional diagnosis is required';
  end if;
  if not exists (select 1 from public.consultation_history
                 where consultation_id = c.id and jsonb_array_length(chief_complaints) > 0) then
    raise exception 'At least one chief complaint is required';
  end if;

  insert into public.prescriptions
    (patient_id, hospital_id, doctor_id, drug_name, dosage, frequency, duration, instructions, status, consultation_id)
  select c.patient_id, c.hospital_id, c.doctor_id,
         trim(coalesce(t.route || ' ', '') || t.drug_name || coalesce(' ' || t.strength, '')),
         t.dose, t.frequency,
         case when t.duration_value is not null then t.duration_value::text || ' ' || coalesce(t.duration_unit, 'days') end,
         concat_ws(' | ', t.instructions,
                   case when t.quantity is not null then 'Qty: ' || t.quantity end,
                   case when t.give_in_clinic then 'Give in clinic' end),
         'active', c.id
    from public.consultation_treatment_items t
   where t.consultation_id = c.id and t.kind = 'drug'
   order by t.line_no;
  get diagnostics n_rx = row_count;

  update public.consultations set submitted_at = now() where id = c.id;
  if c.checkin_id is not null then
    update public.patient_checkins set status = 'completed', consultation_end = now() where id = c.checkin_id;
  end if;
  select count(*) into n_lab from public.lab_results where consultation_id = c.id;
  select count(*) into n_dx from public.diagnostic_requests where consultation_id = c.id and cancelled_at is null;
  return jsonb_build_object('consultation_id', c.id, 'prescriptions', n_rx, 'lab_orders', n_lab,
                            'diagnostic_requests', n_dx, 'follow_up_date', c.follow_up_date);
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Triggers
-- -----------------------------------------------------------------------------
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at
create trigger update_hospitals_updated_at before update on public.hospitals for each row execute function public.update_updated_at_column();
create trigger update_hospital_staff_updated_at before update on public.hospital_staff for each row execute function public.update_updated_at_column();
create trigger trg_subs_updated before update on public.hospital_subscriptions for each row execute function public.update_updated_at_column();
create trigger update_doctors_updated_at before update on public.doctors for each row execute function public.update_updated_at_column();
create trigger update_hospital_doctors_updated_at before update on public.hospital_doctors for each row execute function public.update_updated_at_column();
create trigger update_doctor_settings_updated_at before update on public.doctor_settings for each row execute function public.update_updated_at_column();
create trigger update_doctor_availability_updated_at before update on public.doctor_availability for each row execute function public.update_updated_at_column();
create trigger update_marketplace_updated_at before update on public.doctor_marketplace for each row execute function public.update_updated_at_column();
create trigger update_patients_updated_at before update on public.patients for each row execute function public.update_updated_at_column();
create trigger trg_prefs_updated before update on public.notification_preferences for each row execute function public.update_updated_at_column();
create trigger update_checkins_updated_at before update on public.patient_checkins for each row execute function public.update_updated_at_column();
create trigger trg_appts_updated before update on public.patient_appointments for each row execute function public.update_updated_at_column();
create trigger update_triage_sessions_updated_at before update on public.triage_sessions for each row execute function public.update_updated_at_column();
create trigger trg_consultations_updated before update on public.consultations for each row execute function public.update_updated_at_column();
create trigger update_pharmacy_updated_at before update on public.pharmacy_inventory for each row execute function public.update_updated_at_column();
create trigger update_emr_updated_at before update on public.emr_entries for each row execute function public.update_updated_at_column();
create trigger update_lab_results_updated_at before update on public.lab_results for each row execute function public.update_updated_at_column();
create trigger lab_result_parameters_updated_at before update on public.lab_result_parameters for each row execute function public.update_updated_at_column();
create trigger trg_rx_updated before update on public.prescriptions for each row execute function public.update_updated_at_column();
create trigger update_hospital_wards_updated_at before update on public.hospital_wards for each row execute function public.update_updated_at_column();
create trigger update_hospital_beds_updated_at before update on public.hospital_beds for each row execute function public.update_updated_at_column();
create trigger update_billing_updated_at before update on public.hospital_billing for each row execute function public.update_updated_at_column();
create trigger update_claims_updated_at before update on public.insurance_claims for each row execute function public.update_updated_at_column();
create trigger update_maternity_updated_at before update on public.maternity_records for each row execute function public.update_updated_at_column();
create trigger update_surgery_updated_at before update on public.surgery_records for each row execute function public.update_updated_at_column();
create trigger update_referrals_updated_at before update on public.hospital_referrals for each row execute function public.update_updated_at_column();
create trigger update_patient_letters_updated_at before update on public.patient_letters for each row execute function public.update_updated_at_column();
create trigger update_consultation_updated_at before update on public.consultation_requests for each row execute function public.update_updated_at_column();
create trigger update_payments_updated_at before update on public.payments for each row execute function public.update_updated_at_column();
create trigger update_plan_prices_updated_at before update on public.plan_prices for each row execute function public.update_updated_at_column();

-- guards
create trigger guard_patients before update on public.patients for each row execute function private.guard_patients();
create trigger guard_hospitals before update on public.hospitals for each row execute function private.guard_hospitals();
create trigger guard_doctors before update on public.doctors for each row execute function private.guard_doctors();
create trigger guard_hospital_doctors before insert or update on public.hospital_doctors for each row execute function private.guard_hospital_doctors();
create trigger guard_patient_appointments before update on public.patient_appointments for each row execute function private.guard_patient_appointments();
create trigger guard_consultation_requests before update on public.consultation_requests for each row execute function private.guard_consultation_requests();

-- hospital_patients links
create trigger link_patient_on_appointment after insert on public.patient_appointments for each row execute function public.link_patient_to_hospital();
create trigger link_patient_on_checkin after insert on public.patient_checkins for each row execute function public.link_patient_to_hospital();

-- lab status
create trigger lab_result_tests_sync_order_status
  after insert or delete or update of status on public.lab_result_tests
  for each row execute function public.lab_result_tests_status_sync();

-- notifications
create trigger trg_notify_consultation_request after insert or update on public.consultation_requests for each row execute function public.notify_consultation_request();
create trigger trg_notify_billing after insert or update on public.hospital_billing for each row execute function public.notify_billing();
create trigger trg_notify_user_billing after insert or update on public.hospital_billing for each row execute function public.notify_user_billing();
create trigger trg_notify_claim after insert or update on public.insurance_claims for each row execute function public.notify_claim();
create trigger trg_notify_lab_status after insert or update on public.lab_results for each row execute function public.notify_lab_status();
create trigger trg_notify_user_lab after update on public.lab_results for each row execute function public.notify_user_lab();
create trigger trg_notify_appointment after insert or update on public.patient_appointments for each row execute function public.notify_appointment();
create trigger trg_notify_user_appointment after insert or update on public.patient_appointments for each row execute function public.notify_user_appointment();
create trigger trg_notify_checkin after insert or update on public.patient_checkins for each row execute function public.notify_checkin();
create trigger trg_notify_user_checkin after update on public.patient_checkins for each row execute function public.notify_user_checkin();
create trigger trg_notify_letter after insert or update on public.patient_letters for each row execute function public.notify_letter();
create trigger trg_notify_user_letter after insert or update on public.patient_letters for each row execute function public.notify_user_letter();
create trigger trg_notify_low_stock after insert or update of quantity_in_stock, reorder_level on public.pharmacy_inventory for each row execute function public.notify_low_stock();
create trigger trg_notify_prescription after insert on public.prescriptions for each row execute function public.notify_prescription();
create trigger trg_notify_user_prescription after insert on public.prescriptions for each row execute function public.notify_user_prescription();
create trigger trg_notify_doctor_link after insert or update or delete on public.hospital_doctors for each row execute function public.notify_doctor_link();

-- -----------------------------------------------------------------------------
-- 9. Row level security, policies and grants
--
-- Every table has RLS enabled. Policies are TO authenticated (anon only on
-- contact_messages and plan_prices). Grants say which verbs/columns a role may
-- use at all; policies say which rows.
-- -----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'platform_admins', 'plan_prices', 'function_calls', 'contact_messages',
    'hospitals', 'hospital_staff', 'hospital_subscriptions', 'hospital_notification_prefs', 'hospital_notifications',
    'doctors', 'hospital_doctors', 'doctor_settings', 'doctor_availability', 'doctor_marketplace',
    'patients', 'hospital_patients', 'notification_preferences', 'user_notifications', 'patient_messages',
    'patient_checkins', 'patient_appointments', 'triage_sessions',
    'consultations', 'consultation_history', 'consultation_examinations', 'consultation_treatment_items',
    'consultation_addenda', 'diagnostic_catalog', 'diagnostic_requests', 'emr_entries',
    'lab_results', 'lab_result_tests', 'lab_result_parameters', 'prescriptions',
    'pharmacy_inventory', 'pharmacy_dispensing', 'hospital_wards', 'hospital_beds',
    'hospital_billing', 'insurance_claims', 'maternity_records', 'surgery_records', 'hospital_referrals',
    'patient_letters', 'consultation_requests', 'payments']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;

-- 9.1 Start from nothing ------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;
revoke all on all functions in schema private from public, anon, authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
grant execute on all functions in schema private to service_role;

-- 9.2 Platform tables -----------------------------------------------------------
-- platform_admins, function_calls: service role only (no grants, no policies).

grant select on public.plan_prices to anon, authenticated;
create policy "Anyone can read active prices" on public.plan_prices
  for select to anon, authenticated using (is_active);

grant insert (name, email, subject, message) on public.contact_messages to anon, authenticated;
grant select on public.contact_messages to authenticated;
create policy "Anyone can submit a contact message" on public.contact_messages
  for insert to anon, authenticated
  with check (char_length(name) between 1 and 200
              and char_length(email) between 3 and 320
              and char_length(message) between 1 and 5000
              and (subject is null or char_length(subject) <= 300));
create policy "Platform admins read contact messages" on public.contact_messages
  for select to authenticated using (private.is_platform_admin());

-- 9.3 Hospitals and staff -------------------------------------------------------
grant select on public.hospitals to authenticated;
grant update (name, address, city, state, phone, email, logo_url, license_number, lat, lng)
  on public.hospitals to authenticated;
-- Patients and other users see only active, platform-approved hospitals. Staff,
-- invited/linked doctors and patients registered there also see their own hospital.
create policy "Read approved hospitals and own hospital" on public.hospitals
  for select to authenticated
  using ((is_active and verification_status = 'approved')
         or private.is_hospital_staff(id)
         or private.doctor_linked_to_hospital(id)
         or private.is_patient_of_hospital(id)
         or private.is_platform_admin());
create policy "Hospital admins update their hospital" on public.hospitals
  for update to authenticated
  using (private.is_hospital_admin(id))
  with check (private.is_hospital_admin(id));

grant select, delete on public.hospital_staff to authenticated;
grant insert (user_id, hospital_id, first_name, last_name, email, phone, role, department, profile_image_url, is_active)
  on public.hospital_staff to authenticated;
grant update (first_name, last_name, email, phone, role, department, profile_image_url, is_active, last_login)
  on public.hospital_staff to authenticated;
create policy "Staff see colleagues; users see own rows" on public.hospital_staff
  for select to authenticated
  using (user_id = auth.uid() or private.is_hospital_staff(hospital_id));
create policy "Admins add staff" on public.hospital_staff
  for insert to authenticated with check (private.is_hospital_admin(hospital_id));
create policy "Admins update staff" on public.hospital_staff
  for update to authenticated
  using (private.is_hospital_admin(hospital_id))
  with check (private.is_hospital_admin(hospital_id));
create policy "Admins remove staff" on public.hospital_staff
  for delete to authenticated using (private.is_hospital_admin(hospital_id));

-- #4: read-only for the browser; written by the service role.
grant select on public.hospital_subscriptions to authenticated;
create policy "Staff read their subscriptions" on public.hospital_subscriptions
  for select to authenticated using (private.is_hospital_staff(hospital_id));

grant select, insert, update on public.hospital_notification_prefs to authenticated;
create policy "Staff read notification prefs" on public.hospital_notification_prefs
  for select to authenticated using (private.is_hospital_staff(hospital_id));
create policy "Admins insert notification prefs" on public.hospital_notification_prefs
  for insert to authenticated with check (private.is_hospital_admin(hospital_id));
create policy "Admins update notification prefs" on public.hospital_notification_prefs
  for update to authenticated
  using (private.is_hospital_admin(hospital_id))
  with check (private.is_hospital_admin(hospital_id));

-- #25: no browser inserts (the triggers create notifications).
grant select on public.hospital_notifications to authenticated;
grant update (is_read) on public.hospital_notifications to authenticated;
create policy "Staff read hospital notifications" on public.hospital_notifications
  for select to authenticated using (private.is_hospital_staff(hospital_id));
create policy "Staff mark hospital notifications read" on public.hospital_notifications
  for update to authenticated
  using (private.is_hospital_staff(hospital_id))
  with check (private.is_hospital_staff(hospital_id));

-- 9.4 Doctors -------------------------------------------------------------------
-- #8: directory columns only; private fields via my_doctor_profile / doctor_private_profile().
grant select (id, user_id, first_name, last_name, specialty, years_experience, rating, profile_image_url,
              bio, is_available, verification_status, created_at, updated_at)
  on public.doctors to authenticated;
-- #5: no INSERT (the signup trigger creates the row); no verification columns.
grant update (first_name, last_name, phone, specialty, years_experience, profile_image_url, bio, is_available)
  on public.doctors to authenticated;
create policy "Directory: approved doctors, self, linked hospitals, admins" on public.doctors
  for select to authenticated
  using (verification_status = 'approved'
         or user_id = auth.uid()
         or private.doctor_linked_to_my_hospital(id)
         or private.is_platform_admin());
create policy "Doctors update own profile" on public.doctors
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- #6 / #9: doctors have no UPDATE; they answer invites with respond_to_invitation().
grant select, delete on public.hospital_doctors to authenticated;
grant insert (hospital_id, doctor_id, employment_type, department, contract_start, contract_end, salary,
              commission_rate, notes, is_active, status)
  on public.hospital_doctors to authenticated;
grant update (employment_type, department, contract_start, contract_end, salary, commission_rate, notes, is_active)
  on public.hospital_doctors to authenticated;
create policy "Doctors see own links; staff see hospital links" on public.hospital_doctors
  for select to authenticated
  using (doctor_id = private.my_doctor_id()
         or private.is_hospital_staff(hospital_id)
         or private.is_platform_admin());
create policy "Admins invite doctors" on public.hospital_doctors
  for insert to authenticated with check (private.is_hospital_admin(hospital_id));
create policy "Admins edit doctor links" on public.hospital_doctors
  for update to authenticated
  using (private.is_hospital_admin(hospital_id))
  with check (private.is_hospital_admin(hospital_id));
create policy "Admins remove doctor links" on public.hospital_doctors
  for delete to authenticated using (private.is_hospital_admin(hospital_id));

grant select, insert, update, delete on public.doctor_settings to authenticated;
create policy "Doctors manage own settings" on public.doctor_settings
  for all to authenticated
  using (doctor_id = private.my_doctor_id())
  with check (doctor_id = private.my_doctor_id());

grant select, insert, update, delete on public.doctor_availability to authenticated;
create policy "Read available slots" on public.doctor_availability
  for select to authenticated
  using ((is_available and private.doctor_is_approved(doctor_id)) or doctor_id = private.my_doctor_id());
create policy "Doctors insert own availability" on public.doctor_availability
  for insert to authenticated
  with check (doctor_id = private.my_doctor_id()
              and (hospital_id is null or private.doctor_is_active_at(doctor_id, hospital_id)));
create policy "Doctors update own availability" on public.doctor_availability
  for update to authenticated
  using (doctor_id = private.my_doctor_id())
  with check (doctor_id = private.my_doctor_id()
              and (hospital_id is null or private.doctor_is_active_at(doctor_id, hospital_id)));
create policy "Doctors delete own availability" on public.doctor_availability
  for delete to authenticated using (doctor_id = private.my_doctor_id());

grant select, insert, update, delete on public.doctor_marketplace to authenticated;
create policy "Read marketplace of approved doctors" on public.doctor_marketplace
  for select to authenticated
  using (private.doctor_is_approved(doctor_id) or doctor_id = private.my_doctor_id());
create policy "Doctors insert own marketplace profile" on public.doctor_marketplace
  for insert to authenticated
  with check (doctor_id = private.my_doctor_id()
              and (home_hospital_id is null or private.doctor_is_active_at(doctor_id, home_hospital_id)));
create policy "Doctors update own marketplace profile" on public.doctor_marketplace
  for update to authenticated
  using (doctor_id = private.my_doctor_id())
  with check (doctor_id = private.my_doctor_id()
              and (home_hospital_id is null or private.doctor_is_active_at(doctor_id, home_hospital_id)));
create policy "Doctors delete own marketplace profile" on public.doctor_marketplace
  for delete to authenticated using (doctor_id = private.my_doctor_id());

-- 9.5 Patients ------------------------------------------------------------------
-- #1 / #2: no INSERT (register_patient() / signup trigger); user_id never updatable.
grant select on public.patients to authenticated;
grant update (first_name, last_name, email, phone, date_of_birth, gender, blood_group, genotype, address, city,
              state, emergency_contact_name, emergency_contact_phone, insurance_provider, insurance_policy_number,
              profile_image_url, status)
  on public.patients to authenticated;
create policy "Read own or linked patients" on public.patients
  for select to authenticated using (private.can_read_patient(id));
create policy "Patients and linked staff update patients" on public.patients
  for update to authenticated
  using (user_id = auth.uid() or private.can_staff_edit_patient(id))
  with check (user_id = auth.uid() or private.can_staff_edit_patient(id));

grant select on public.hospital_patients to authenticated;
create policy "Read hospital-patient links" on public.hospital_patients
  for select to authenticated
  using (private.is_hospital_staff(hospital_id)
         or private.is_active_doctor_at(hospital_id)
         or private.is_own_patient(patient_id));

grant select, insert, update on public.notification_preferences to authenticated;
create policy "Users read own preferences" on public.notification_preferences
  for select to authenticated using (user_id = auth.uid());
create policy "Users create own preferences" on public.notification_preferences
  for insert to authenticated with check (user_id = auth.uid());
create policy "Users update own preferences" on public.notification_preferences
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, delete on public.user_notifications to authenticated;
grant update (is_read) on public.user_notifications to authenticated;
create policy "Users read own notifications" on public.user_notifications
  for select to authenticated using (user_id = auth.uid());
create policy "Users mark own notifications read" on public.user_notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users delete own notifications" on public.user_notifications
  for delete to authenticated using (user_id = auth.uid());

grant select on public.patient_messages to authenticated;
grant insert (from_user_id, to_user_id, subject, body) on public.patient_messages to authenticated;
grant update (is_read) on public.patient_messages to authenticated;
create policy "Read own messages" on public.patient_messages
  for select to authenticated using (from_user_id = auth.uid() or to_user_id = auth.uid());
create policy "Send messages within a care relationship" on public.patient_messages
  for insert to authenticated
  with check (from_user_id = auth.uid() and private.can_message(to_user_id));
create policy "Recipients mark messages read" on public.patient_messages
  for update to authenticated using (to_user_id = auth.uid()) with check (to_user_id = auth.uid());

-- 9.6 Front desk, appointments, triage -------------------------------------------
grant select, insert on public.patient_checkins to authenticated;
grant update (status, queue_number, called_time, consultation_start, consultation_end, assigned_doctor_id,
              department, urgency, vitals, notes, checkin_type)
  on public.patient_checkins to authenticated;
create policy "Read check-ins" on public.patient_checkins
  for select to authenticated
  using (private.can_work_at(hospital_id, 'emr') or private.is_own_patient(patient_id));
create policy "Staff check in registered patients" on public.patient_checkins
  for insert to authenticated
  with check (private.can_staff_work_at(hospital_id, 'emr')
              and private.patient_linked(hospital_id, patient_id)
              and (assigned_doctor_id is null or private.doctor_is_active_at(assigned_doctor_id, hospital_id)));
create policy "Staff and hospital doctors update check-ins" on public.patient_checkins
  for update to authenticated
  using (private.can_work_at(hospital_id, 'emr'))
  with check (private.can_work_at(hospital_id, 'emr'));

-- N10: patients book (pending only) and may later only reschedule/cancel (guard trigger).
grant select on public.patient_appointments to authenticated;
grant insert (patient_id, hospital_id, doctor_id, requested_date, requested_time, reason, status, notes, is_telemedicine)
  on public.patient_appointments to authenticated;
grant update (doctor_id, requested_date, requested_time, reason, status, notes, is_telemedicine)
  on public.patient_appointments to authenticated;
create policy "Read appointments" on public.patient_appointments
  for select to authenticated
  using (private.is_own_patient(patient_id)
         or doctor_id = private.my_doctor_id()
         or private.can_work_at(hospital_id, 'emr'));
create policy "Patients book appointments" on public.patient_appointments
  for insert to authenticated
  with check (private.is_own_patient(patient_id)
              and status = 'pending'
              and private.hospital_is_public(hospital_id)
              and (doctor_id is null or (private.doctor_is_active_at(doctor_id, hospital_id)
                                          and private.doctor_is_approved(doctor_id)))
              and (not is_telemedicine or private.hospital_has_plan(hospital_id, 'telemedicine')));
create policy "Staff create appointments for registered patients" on public.patient_appointments
  for insert to authenticated
  with check (private.can_staff_work_at(hospital_id, 'emr')
              and private.patient_linked(hospital_id, patient_id)
              and (doctor_id is null or private.doctor_is_active_at(doctor_id, hospital_id))
              and (not is_telemedicine or private.hospital_has_plan(hospital_id, 'telemedicine')));
create policy "Update appointments" on public.patient_appointments
  for update to authenticated
  using (private.is_own_patient(patient_id)
         or (doctor_id = private.my_doctor_id() and private.can_doctor_work_at(hospital_id, 'emr'))
         or private.can_staff_work_at(hospital_id, 'emr'))
  with check (private.is_own_patient(patient_id)
              or (doctor_id = private.my_doctor_id() and private.can_doctor_work_at(hospital_id, 'emr'))
              or private.can_staff_work_at(hospital_id, 'emr'));
  -- doctor / telemedicine changes are validated by guard_patient_appointments.

grant select, insert, delete on public.triage_sessions to authenticated;
grant update (symptoms, duration, severity_self, severity_score, recommended_specialty, urgency,
              recommended_hospitals, chosen_hospital_id, chosen_doctor_id, status, lat, lng, notes)
  on public.triage_sessions to authenticated;
create policy "Read triage sessions" on public.triage_sessions
  for select to authenticated
  using (private.is_own_patient(patient_id)
         or (chosen_hospital_id is not null and private.can_work_at(chosen_hospital_id, 'emr'))
         or (chosen_doctor_id is not null and chosen_doctor_id = private.my_doctor_id()));
-- A triage session is shared with the chosen hospital, so only approved hospitals can be chosen.
create policy "Patients create own triage" on public.triage_sessions
  for insert to authenticated
  with check (private.is_own_patient(patient_id)
              and (chosen_hospital_id is null or private.hospital_is_public(chosen_hospital_id)));
create policy "Patients update own triage" on public.triage_sessions
  for update to authenticated
  using (private.is_own_patient(patient_id))
  with check (private.is_own_patient(patient_id)
              and (chosen_hospital_id is null or private.hospital_is_public(chosen_hospital_id)));
create policy "Patients delete own triage" on public.triage_sessions
  for delete to authenticated using (private.is_own_patient(patient_id));

-- 9.7 Consultation workspace ------------------------------------------------------
-- Consultations are created by start_consultation() and closed by submit_consultation().
grant select on public.consultations to authenticated;
grant update (provisional_diagnosis, final_diagnosis, advice_plan, follow_up_date) on public.consultations to authenticated;
create policy "consult select" on public.consultations
  for select to authenticated using (private.consultation_access(id) is not null);
create policy "consult update" on public.consultations
  for update to authenticated
  using (private.consultation_access(id) = 'owner' and submitted_at is null)
  with check (private.consultation_access(id) = 'owner' and submitted_at is null);

grant select, insert, update on public.consultation_history to authenticated;
create policy sel on public.consultation_history
  for select to authenticated using (private.consultation_access(consultation_id) is not null);
create policy ins on public.consultation_history
  for insert to authenticated
  with check (private.consultation_access(consultation_id) in ('owner', 'staff')
              and private.consultation_is_open(consultation_id)
              and hospital_id = private.consultation_hospital_id(consultation_id));
create policy upd on public.consultation_history
  for update to authenticated
  using (private.consultation_access(consultation_id) in ('owner', 'staff')
         and private.consultation_is_open(consultation_id))
  with check (private.consultation_is_open(consultation_id)
              and hospital_id = private.consultation_hospital_id(consultation_id));

grant select, insert, update on public.consultation_examinations to authenticated;
create policy sel on public.consultation_examinations
  for select to authenticated using (private.consultation_access(consultation_id) is not null);
create policy ins on public.consultation_examinations
  for insert to authenticated
  with check (private.consultation_access(consultation_id) in ('owner', 'staff')
              and private.consultation_is_open(consultation_id)
              and hospital_id = private.consultation_hospital_id(consultation_id));
create policy upd on public.consultation_examinations
  for update to authenticated
  using (private.consultation_access(consultation_id) in ('owner', 'staff')
         and private.consultation_is_open(consultation_id))
  with check (private.consultation_is_open(consultation_id)
              and hospital_id = private.consultation_hospital_id(consultation_id));

grant select, insert, update, delete on public.consultation_treatment_items to authenticated;
create policy sel on public.consultation_treatment_items
  for select to authenticated using (private.consultation_access(consultation_id) is not null);
create policy ins on public.consultation_treatment_items
  for insert to authenticated
  with check (private.consultation_access(consultation_id) = 'owner'
              and private.consultation_is_open(consultation_id)
              and hospital_id = private.consultation_hospital_id(consultation_id));
create policy upd on public.consultation_treatment_items
  for update to authenticated
  using (private.consultation_access(consultation_id) = 'owner' and private.consultation_is_open(consultation_id))
  with check (private.consultation_is_open(consultation_id)
              and hospital_id = private.consultation_hospital_id(consultation_id));
create policy del on public.consultation_treatment_items
  for delete to authenticated
  using (private.consultation_access(consultation_id) = 'owner' and private.consultation_is_open(consultation_id));

grant select, insert on public.consultation_addenda to authenticated;
create policy sel on public.consultation_addenda
  for select to authenticated using (private.consultation_access(consultation_id) is not null);
create policy ins on public.consultation_addenda
  for insert to authenticated
  with check (author_id = auth.uid()
              and private.consultation_access(consultation_id) in ('owner', 'staff')
              and not private.consultation_is_open(consultation_id)
              and hospital_id = private.consultation_hospital_id(consultation_id));

grant select, insert, update on public.diagnostic_catalog to authenticated;
create policy sel on public.diagnostic_catalog
  for select to authenticated
  using (hospital_id is null or private.can_work_at(hospital_id, 'emr'));
create policy ins on public.diagnostic_catalog
  for insert to authenticated
  with check (hospital_id is not null and private.is_hospital_admin(hospital_id));
create policy upd on public.diagnostic_catalog
  for update to authenticated
  using (hospital_id is not null and private.is_hospital_admin(hospital_id))
  with check (hospital_id is not null and private.is_hospital_admin(hospital_id));

grant select, insert on public.diagnostic_requests to authenticated;
grant update (performed_at, reported_at, cancelled_at, report_text, report_file_path, reported_by, priority,
              clinical_info, bill_to, destination, external_facility)
  on public.diagnostic_requests to authenticated;
create policy sel on public.diagnostic_requests
  for select to authenticated
  using (private.can_work_at(hospital_id, 'emr')
         or ordered_by = private.my_doctor_id()
         or private.is_own_patient(patient_id));
create policy ins on public.diagnostic_requests
  for insert to authenticated
  with check (ordered_by = private.my_doctor_id()
              and private.can_doctor_work_at(hospital_id, 'emr')
              and private.patient_linked(hospital_id, patient_id)
              and (consultation_id is null or hospital_id = private.consultation_hospital_id(consultation_id)));
create policy upd on public.diagnostic_requests
  for update to authenticated
  using (private.can_staff_work_at(hospital_id, 'emr')
         or (ordered_by = private.my_doctor_id() and private.can_doctor_work_at(hospital_id, 'emr')))
  with check (private.can_staff_work_at(hospital_id, 'emr')
              or (ordered_by = private.my_doctor_id() and private.can_doctor_work_at(hospital_id, 'emr')));

-- 9.8 EMR, labs, prescriptions --------------------------------------------------
grant select, insert on public.emr_entries to authenticated;
grant update (entry_type, title, content, structured_data, attachments, is_confidential, vital_data)
  on public.emr_entries to authenticated;
create policy "Read EMR entries" on public.emr_entries
  for select to authenticated
  using (private.can_work_at(hospital_id, 'emr')
         or (private.is_own_patient(patient_id) and not coalesce(is_confidential, false)));
create policy "Write EMR entries for registered patients" on public.emr_entries
  for insert to authenticated
  with check (private.can_work_at(hospital_id, 'emr')
              and private.patient_linked(hospital_id, patient_id)
              and (doctor_id is null
                   or doctor_id = private.my_doctor_id()
                   or (private.is_hospital_staff(hospital_id) and private.doctor_is_active_at(doctor_id, hospital_id))));
create policy "Staff and authoring doctor update EMR entries" on public.emr_entries
  for update to authenticated
  using (private.can_staff_work_at(hospital_id, 'emr')
         or (doctor_id = private.my_doctor_id() and private.can_doctor_work_at(hospital_id, 'emr')))
  with check (private.can_staff_work_at(hospital_id, 'emr')
              or (doctor_id = private.my_doctor_id() and private.can_doctor_work_at(hospital_id, 'emr')));

grant select, insert on public.lab_results to authenticated;
grant update (status, notes, clinical_info, priority, fasting, bill_to) on public.lab_results to authenticated;
create policy "Read lab orders" on public.lab_results
  for select to authenticated
  using (private.can_work_at(hospital_id, 'emr')
         or ordered_by = private.my_doctor_id()
         or private.is_own_patient(patient_id));
create policy "Create lab orders for registered patients" on public.lab_results
  for insert to authenticated
  with check (private.can_work_at(hospital_id, 'emr')
              and private.patient_linked(hospital_id, patient_id)
              and (ordered_by is null
                   or ordered_by = private.my_doctor_id()
                   or (private.is_hospital_staff(hospital_id) and private.doctor_is_active_at(ordered_by, hospital_id)))
              and (consultation_id is null or hospital_id = private.consultation_hospital_id(consultation_id)));
create policy "Update lab orders" on public.lab_results
  for update to authenticated
  using (private.can_work_at(hospital_id, 'emr'))
  with check (private.can_work_at(hospital_id, 'emr'));

grant select, insert, delete on public.lab_result_tests to authenticated;
grant update (test_name, category_name, sample_type, result_value, reference_range, unit, is_abnormal,
              catalog_test_id, is_custom, parameters, status, completed_at)
  on public.lab_result_tests to authenticated;
create policy "Read lab tests" on public.lab_result_tests
  for select to authenticated using (private.can_read_lab_order(lab_result_id));
create policy "Add lab tests" on public.lab_result_tests
  for insert to authenticated with check (private.can_work_on_lab_order(lab_result_id));
create policy "Update lab tests" on public.lab_result_tests
  for update to authenticated
  using (private.can_work_on_lab_order(lab_result_id))
  with check (private.can_work_on_lab_order(lab_result_id));
create policy "Remove pending lab tests" on public.lab_result_tests
  for delete to authenticated
  using (private.can_work_on_lab_order(lab_result_id) and status = 'pending');

grant select, insert, update, delete on public.lab_result_parameters to authenticated;
create policy "Read lab parameters" on public.lab_result_parameters
  for select to authenticated using (private.can_read_lab_order(private.lab_test_order_id(order_test_id)));
create policy "Add lab parameters" on public.lab_result_parameters
  for insert to authenticated with check (private.can_work_on_lab_order(private.lab_test_order_id(order_test_id)));
create policy "Update lab parameters" on public.lab_result_parameters
  for update to authenticated
  using (private.can_work_on_lab_order(private.lab_test_order_id(order_test_id)))
  with check (private.can_work_on_lab_order(private.lab_test_order_id(order_test_id)));
create policy "Remove lab parameters" on public.lab_result_parameters
  for delete to authenticated using (private.can_work_on_lab_order(private.lab_test_order_id(order_test_id)));

grant select, insert on public.prescriptions to authenticated;
grant update (status, dosage, frequency, duration, instructions, refills_allowed, refills_used)
  on public.prescriptions to authenticated;
create policy "Read prescriptions" on public.prescriptions
  for select to authenticated
  using (private.can_work_at(hospital_id, 'emr')
         or doctor_id = private.my_doctor_id()
         or private.is_own_patient(patient_id));
create policy "Prescribe for registered patients" on public.prescriptions
  for insert to authenticated
  with check (private.can_work_at(hospital_id, 'emr')
              and private.patient_linked(hospital_id, patient_id)
              and (doctor_id = private.my_doctor_id()
                   or (private.is_hospital_staff(hospital_id)
                       and (doctor_id is null or private.doctor_is_active_at(doctor_id, hospital_id))))
              and (consultation_id is null or hospital_id = private.consultation_hospital_id(consultation_id)));
create policy "Staff and prescriber update prescriptions" on public.prescriptions
  for update to authenticated
  using (private.can_staff_work_at(hospital_id, 'emr')
         or (doctor_id = private.my_doctor_id() and private.can_doctor_work_at(hospital_id, 'emr')))
  with check (private.can_staff_work_at(hospital_id, 'emr')
              or (doctor_id = private.my_doctor_id() and private.can_doctor_work_at(hospital_id, 'emr')));

-- 9.9 Pharmacy, wards, billing and other hospital records ----------------------------
-- #13: stock is changed only by dispense_prescription / dispense_drug / adjust_stock.
grant select on public.pharmacy_inventory to authenticated;
grant insert (hospital_id, drug_name, generic_name, category, dosage_form, strength, quantity_in_stock, reorder_level,
              unit_price, supplier, batch_number, expiry_date, location)
  on public.pharmacy_inventory to authenticated;
grant update (drug_name, generic_name, category, dosage_form, strength, reorder_level, unit_price, supplier,
              batch_number, expiry_date, location)
  on public.pharmacy_inventory to authenticated;
create policy "Read pharmacy inventory" on public.pharmacy_inventory
  for select to authenticated using (private.can_work_at(hospital_id, 'emr'));
create policy "Staff add inventory" on public.pharmacy_inventory
  for insert to authenticated with check (private.can_staff_work_at(hospital_id, 'emr'));
create policy "Staff edit inventory" on public.pharmacy_inventory
  for update to authenticated
  using (private.can_staff_work_at(hospital_id, 'emr'))
  with check (private.can_staff_work_at(hospital_id, 'emr'));

grant select on public.pharmacy_dispensing to authenticated;
grant update (payment_status, notes) on public.pharmacy_dispensing to authenticated;
create policy "Staff read dispensing" on public.pharmacy_dispensing
  for select to authenticated using (private.can_staff_work_at(hospital_id, 'emr'));
create policy "Staff update dispensing payment status" on public.pharmacy_dispensing
  for update to authenticated
  using (private.can_staff_work_at(hospital_id, 'emr'))
  with check (private.can_staff_work_at(hospital_id, 'emr'));

grant select, insert, update, delete on public.hospital_wards to authenticated;
create policy "Read wards" on public.hospital_wards
  for select to authenticated using (private.can_work_at(hospital_id, 'emr'));
create policy "Staff add wards" on public.hospital_wards
  for insert to authenticated with check (private.can_staff_work_at(hospital_id, 'emr'));
create policy "Staff edit wards" on public.hospital_wards
  for update to authenticated
  using (private.can_staff_work_at(hospital_id, 'emr'))
  with check (private.can_staff_work_at(hospital_id, 'emr'));
create policy "Staff remove wards" on public.hospital_wards
  for delete to authenticated using (private.can_staff_work_at(hospital_id, 'emr'));

grant select, insert, update, delete on public.hospital_beds to authenticated;
create policy "Read beds" on public.hospital_beds
  for select to authenticated using (private.can_work_at(hospital_id, 'emr'));
create policy "Staff add beds" on public.hospital_beds
  for insert to authenticated
  with check (private.can_staff_work_at(hospital_id, 'emr')
              and (patient_id is null or private.patient_linked(hospital_id, patient_id)));
create policy "Staff edit beds" on public.hospital_beds
  for update to authenticated
  using (private.can_staff_work_at(hospital_id, 'emr'))
  with check (private.can_staff_work_at(hospital_id, 'emr')
              and (patient_id is null or private.patient_linked(hospital_id, patient_id)));
create policy "Staff remove beds" on public.hospital_beds
  for delete to authenticated using (private.can_staff_work_at(hospital_id, 'emr'));

-- Cash/transfer settlement at the counter is the hospital's own business, so staff
-- may set payment_status. Online payments are settled by the Paystack functions.
grant select, insert on public.hospital_billing to authenticated;
grant update (description, amount, discount, tax, total, payment_status, payment_method, insurance_provider,
              insurance_policy_number, paid_at)
  on public.hospital_billing to authenticated;
create policy "Read bills" on public.hospital_billing
  for select to authenticated
  using (private.can_staff_work_at(hospital_id, 'emr') or private.is_own_patient(patient_id));
create policy "Staff bill registered patients" on public.hospital_billing
  for insert to authenticated
  with check (private.can_staff_work_at(hospital_id, 'emr') and private.patient_linked(hospital_id, patient_id));
create policy "Staff update bills" on public.hospital_billing
  for update to authenticated
  using (private.can_staff_work_at(hospital_id, 'emr'))
  with check (private.can_staff_work_at(hospital_id, 'emr'));

grant select, insert on public.insurance_claims to authenticated;
grant update (insurance_provider, policy_number, claim_amount, approved_amount, service_description, claim_date,
              status, rejection_reason, paid_date, notes, billing_id)
  on public.insurance_claims to authenticated;
create policy "Staff read claims" on public.insurance_claims
  for select to authenticated using (private.can_staff_work_at(hospital_id, 'emr'));
create policy "Staff file claims" on public.insurance_claims
  for insert to authenticated
  with check (private.can_staff_work_at(hospital_id, 'emr') and private.patient_linked(hospital_id, patient_id));
create policy "Staff update claims" on public.insurance_claims
  for update to authenticated
  using (private.can_staff_work_at(hospital_id, 'emr'))
  with check (private.can_staff_work_at(hospital_id, 'emr'));

grant select, insert on public.maternity_records to authenticated;
grant update (doctor_id, lmp_date, edd, gestational_age_weeks, gravida, para, risk_level, blood_group, genotype, status,
              delivery_date, delivery_type, baby_weight, baby_gender, apgar_score, complications, notes)
  on public.maternity_records to authenticated;
create policy "Read maternity records" on public.maternity_records
  for select to authenticated using (private.can_work_at(hospital_id, 'emr'));
create policy "Create maternity records" on public.maternity_records
  for insert to authenticated
  with check (private.can_work_at(hospital_id, 'emr') and private.patient_linked(hospital_id, patient_id));
create policy "Update maternity records" on public.maternity_records
  for update to authenticated
  using (private.can_work_at(hospital_id, 'emr'))
  with check (private.can_work_at(hospital_id, 'emr'));

grant select, insert on public.surgery_records to authenticated;
grant update (surgeon_id, anaesthetist_id, procedure_name, procedure_type, theatre_number, anaesthesia_type,
              scheduled_date, scheduled_time, actual_start, actual_end, duration_minutes, status, pre_op_diagnosis,
              post_op_diagnosis, operative_findings, complications, blood_loss_ml, post_op_instructions, notes)
  on public.surgery_records to authenticated;
create policy "Read surgery records" on public.surgery_records
  for select to authenticated using (private.can_work_at(hospital_id, 'emr'));
create policy "Create surgery records" on public.surgery_records
  for insert to authenticated
  with check (private.can_work_at(hospital_id, 'emr') and private.patient_linked(hospital_id, patient_id));
create policy "Update surgery records" on public.surgery_records
  for update to authenticated
  using (private.can_work_at(hospital_id, 'emr'))
  with check (private.can_work_at(hospital_id, 'emr'));

grant select, insert on public.hospital_referrals to authenticated;
grant update (referred_to_doctor_id, referred_to_hospital, specialty, reason, clinical_summary, urgency, status,
              appointment_date, feedback)
  on public.hospital_referrals to authenticated;
create policy "Read referrals" on public.hospital_referrals
  for select to authenticated
  using (private.can_work_at(hospital_id, 'emr') or referred_to_doctor_id = private.my_doctor_id());
create policy "Create referrals" on public.hospital_referrals
  for insert to authenticated
  with check (private.can_work_at(hospital_id, 'emr') and private.patient_linked(hospital_id, patient_id));
create policy "Update referrals" on public.hospital_referrals
  for update to authenticated
  using (private.can_work_at(hospital_id, 'emr') or referred_to_doctor_id = private.my_doctor_id())
  with check (private.can_work_at(hospital_id, 'emr') or referred_to_doctor_id = private.my_doctor_id());

grant select, insert on public.patient_letters to authenticated;
grant update (title, body, issued_at, valid_until, status, pdf_url, letter_type) on public.patient_letters to authenticated;
create policy "Read letters" on public.patient_letters
  for select to authenticated
  using (private.is_own_patient(patient_id)
         or doctor_id = private.my_doctor_id()
         or (hospital_id is not null and private.can_work_at(hospital_id, 'emr')));
create policy "Patients request letters" on public.patient_letters
  for insert to authenticated
  with check (private.is_own_patient(patient_id)
              and status = 'pending'
              and (hospital_id is null or private.patient_linked(hospital_id, patient_id)));
create policy "Doctors issue letters" on public.patient_letters
  for insert to authenticated
  with check (doctor_id = private.my_doctor_id()
              and private.can_read_patient(patient_id)
              and (hospital_id is null or private.can_doctor_work_at(hospital_id, 'emr')));
create policy "Staff issue letters" on public.patient_letters
  for insert to authenticated
  with check (hospital_id is not null
              and private.can_staff_work_at(hospital_id, 'emr')
              and private.patient_linked(hospital_id, patient_id));
create policy "Doctor and staff update letters" on public.patient_letters
  for update to authenticated
  using (doctor_id = private.my_doctor_id()
         or (hospital_id is not null and private.can_staff_work_at(hospital_id, 'emr')))
  with check (doctor_id = private.my_doctor_id()
              or (hospital_id is not null and private.can_staff_work_at(hospital_id, 'emr')));

-- 9.10 Telemedicine and payments -------------------------------------------------
-- #7: room, link and recording columns are not updatable by the browser.
grant select on public.consultation_requests to authenticated;
grant insert (requesting_hospital_id, doctor_id, patient_id, specialty_needed, urgency, request_type, reason,
              patient_summary, preferred_date, preferred_time)
  on public.consultation_requests to authenticated;
grant update (status, doctor_notes, fee_agreed, preferred_date, preferred_time, reason, patient_summary,
              specialty_needed, urgency, request_type)
  on public.consultation_requests to authenticated;
create policy "Read consultation requests" on public.consultation_requests
  for select to authenticated
  using (doctor_id = private.my_doctor_id()
         or private.can_staff_work_at(requesting_hospital_id, 'telemedicine')
         or private.is_own_patient(patient_id));
create policy "Staff request consultations" on public.consultation_requests
  for insert to authenticated
  with check (private.can_staff_work_at(requesting_hospital_id, 'telemedicine')
              and private.hospital_is_public(requesting_hospital_id)
              and private.patient_linked(requesting_hospital_id, patient_id)
              and private.doctor_is_approved(doctor_id));
create policy "Doctor and requesting staff update consultation requests" on public.consultation_requests
  for update to authenticated
  using (doctor_id = private.my_doctor_id()
         or private.can_staff_work_at(requesting_hospital_id, 'telemedicine'))
  with check (doctor_id = private.my_doctor_id()
              or private.can_staff_work_at(requesting_hospital_id, 'telemedicine'));

-- #3 / #4: read-only for the browser; written by the Paystack edge functions.
grant select on public.payments to authenticated;
create policy "Read own or hospital payments" on public.payments
  for select to authenticated
  using ((hospital_id is not null and private.is_hospital_staff(hospital_id))
         or payer_user_id = auth.uid()
         or (patient_id is not null and private.is_own_patient(patient_id))
         or (payee_doctor_id is not null and payee_doctor_id = private.my_doctor_id()));

-- 9.11 Function EXECUTE ---------------------------------------------------------
-- Policy helpers (evaluated as the calling role). The private schema is not
-- exposed by the Data API, so these are not callable over HTTP.
grant execute on function
  private.is_trusted(),
  private.is_platform_admin(),
  private.my_doctor_id(),
  private.my_patient_id(),
  private.is_own_patient(uuid),
  private.is_hospital_staff(uuid),
  private.is_hospital_admin(uuid),
  private.doctor_is_active_at(uuid, uuid),
  private.is_active_doctor_at(uuid),
  private.doctor_is_approved(uuid),
  private.consultation_has_payment(uuid),
  private.hospital_is_public(uuid),
  private.doctor_linked_to_hospital(uuid),
  private.is_patient_of_hospital(uuid),
  private.hospital_has_plan(uuid, text),
  private.can_staff_work_at(uuid, text),
  private.can_doctor_work_at(uuid, text),
  private.can_work_at(uuid, text),
  private.patient_linked(uuid, uuid),
  private.doctor_has_direct_care(uuid),
  private.can_read_patient(uuid),
  private.can_staff_edit_patient(uuid),
  private.doctor_linked_to_my_hospital(uuid),
  private.is_hospital_admin_of_doctor(uuid),
  private.can_view_doctor_credentials(text),
  private.consultation_access(uuid),
  private.consultation_is_open(uuid),
  private.consultation_hospital_id(uuid),
  private.can_read_lab_order(uuid),
  private.can_work_on_lab_order(uuid),
  private.lab_test_order_id(uuid),
  private.can_message(uuid)
to authenticated;
-- private.provision_user and private.is_call_participant: definer code only
-- (is_call_participant is reached through public.can_join_call).

-- Payment settlement: service role only (Paystack edge functions).
revoke all on function public.fulfill_payment(uuid, bigint, text) from public, anon, authenticated;
revoke all on function private.fulfill_payment(uuid, bigint, text) from public, anon, authenticated;
grant execute on function public.fulfill_payment(uuid, bigint, text) to service_role;
grant execute on function private.fulfill_payment(uuid, bigint, text) to service_role;

-- RPCs callable from the app.
grant execute on function
  public.my_doctor_id(),
  public.my_hospital_ids(),
  public.can_join_call(text, uuid),
  public.doctor_hospital_ids(uuid),
  public.complete_signup(text, jsonb),
  public.register_patient(uuid, jsonb),
  public.respond_to_invitation(uuid, boolean),
  public.submit_doctor_verification(jsonb),
  public.review_doctor(uuid, boolean, text),
  public.review_hospital(uuid, boolean, text),
  public.doctor_private_profile(uuid),
  public.dispense_prescription(uuid, uuid, integer),
  public.dispense_drug(uuid, uuid, integer, text, text),
  public.adjust_stock(uuid, integer),
  public.save_doctor_availability(boolean, uuid[], jsonb),
  public.start_consultation(uuid, uuid, uuid),
  public.submit_consultation(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- 10. View: the doctor's own full profile (#8)
-- Owned by postgres and filtered to auth.uid(), so a doctor can read their own
-- private columns even though the column grants on public.doctors hide them.
-- -----------------------------------------------------------------------------
create view public.my_doctor_profile
with (security_barrier = true)
as
select id, user_id, first_name, last_name, email, phone, specialty, years_experience, rating,
       profile_image_url, bio, is_available, created_at, updated_at, verification_status,
       license_number, license_council, license_expiry, verification_submitted_at,
       verification_reviewed_at, verification_rejection_reason, current_practice,
       credential_documents, reference_contact
  from public.doctors
 where user_id = auth.uid();

revoke all on public.my_doctor_profile from anon, authenticated;
grant select on public.my_doctor_profile to authenticated;
grant all on public.my_doctor_profile to service_role;

-- -----------------------------------------------------------------------------
-- 11. Storage: doctor credential documents (private bucket)
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('doctor-credentials', 'doctor-credentials', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do nothing;

create policy "Doctors upload own credentials" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'doctor-credentials'
              and (storage.foldername(name))[1] = auth.uid()::text
              and private.my_doctor_id() is not null);
create policy "Doctors update own credentials" on storage.objects
  for update to authenticated
  using (bucket_id = 'doctor-credentials' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'doctor-credentials' and (storage.foldername(name))[1] = auth.uid()::text);
-- #8 / #9: owner, platform admins, and admins of a hospital where the doctor is active.
create policy "Read doctor credentials" on storage.objects
  for select to authenticated
  using (bucket_id = 'doctor-credentials'
         and private.can_view_doctor_credentials((storage.foldername(name))[1]));

-- -----------------------------------------------------------------------------
-- 12. Realtime (postgres_changes respects RLS per subscriber)
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table
  public.patient_checkins,
  public.hospital_notifications,
  public.hospital_beds,
  public.emr_entries,
  public.user_notifications,
  public.prescriptions,
  public.lab_result_tests,
  public.diagnostic_requests,
  public.patient_appointments;

-- -----------------------------------------------------------------------------
-- 13. Production reference data
-- -----------------------------------------------------------------------------

-- D4: plan prices in kobo. Telemedicine includes EMR.
insert into public.plan_prices (plan, billing_cycle, amount_kobo) values
  ('emr',          'monthly',   7500000),   -- ₦75,000
  ('emr',          'yearly',   75000000),   -- ₦750,000
  ('telemedicine', 'monthly',  15000000),   -- ₦150,000
  ('telemedicine', 'yearly',  150000000)    -- ₦1,500,000
on conflict (plan, billing_cycle) do nothing;

-- D8: global diagnostic catalog (imaging and other investigations; lab tests live
-- in src/lib/lab/catalog.ts and appendixCatalog.ts). Exported from Lovable Cloud,
-- same ids.
insert into public.diagnostic_catalog
  (id, hospital_id, kind, section, name, aliases, allowed_views, has_laterality, is_active, sort_order)
values
  ('763996e9-707d-47bc-9251-a2601fbb80e3', null, 'imaging', 'X-ray', 'Skull', array['Digital X-Ray']::text[], array['AP', 'LAT']::text[], false, true, 0),
  ('7b376b74-e676-4e24-8abb-4cc7881c2c3a', null, 'imaging', 'X-ray', 'Paranasal Sinuses (PNS)', array['PNS', 'Digital X-Ray']::text[], '{}'::text[], false, true, 1),
  ('3863865a-3a97-4b09-a9d4-51f13a3ce5b8', null, 'imaging', 'X-ray', 'Post-Nasal Space', array['Digital X-Ray']::text[], array['LAT']::text[], false, true, 2),
  ('8be1e812-0ad8-4229-87d1-d8e39c047143', null, 'imaging', 'X-ray', 'Mastoids', array['Digital X-Ray']::text[], '{}'::text[], false, true, 3),
  ('52144ad3-a8b8-4762-ad4a-f389576334e9', null, 'imaging', 'X-ray', 'Chest', array['Digital X-Ray', 'CXR']::text[], array['PA', 'AP', 'LAT']::text[], false, true, 4),
  ('36902fbf-591c-4c55-ab9d-98309991d993', null, 'imaging', 'X-ray', 'Cervical Spine', array['Digital X-Ray']::text[], array['AP', 'LAT', 'Oblique']::text[], false, true, 5),
  ('3bf88f8e-5a5a-4b48-ab85-e3723221718b', null, 'imaging', 'X-ray', 'Thoracic Spine', array['Digital X-Ray']::text[], array['AP', 'LAT']::text[], false, true, 6),
  ('3a61d4d5-37e9-4033-981b-5f71d96712d2', null, 'imaging', 'X-ray', 'Thoraco-Lumbar Spine', array['Digital X-Ray']::text[], array['AP', 'LAT']::text[], false, true, 7),
  ('21976f9d-1e4d-409b-a7b2-edaa559cc824', null, 'imaging', 'X-ray', 'Lumbo-Sacral Spine', array['Digital X-Ray']::text[], array['AP', 'LAT', 'Oblique']::text[], false, true, 8),
  ('3b5640f6-47b4-4b03-a1e9-101f01418f39', null, 'imaging', 'X-ray', 'Abdomen (Plain)', array['Plain', 'Digital X-Ray']::text[], array['Erect', 'Supine']::text[], false, true, 9),
  ('d4c8ec50-082b-472b-bd07-59b2f79523fa', null, 'imaging', 'X-ray', 'Pelvis', array['Digital X-Ray']::text[], array['AP']::text[], false, true, 10),
  ('f8a540bd-89f3-4496-bc23-03073b728c89', null, 'imaging', 'X-ray', 'Hip (incl. Pelvis & Hip)', array['Digital X-Ray']::text[], array['AP', 'LAT']::text[], true, true, 11),
  ('007b0a92-bcbf-4385-b6b8-2978211685bf', null, 'imaging', 'X-ray', 'Shoulder', array['Digital X-Ray']::text[], array['AP', 'LAT']::text[], true, true, 12),
  ('52327c3f-2505-4d2a-800a-226c3c7a3232', null, 'imaging', 'X-ray', 'Upper Arm (Humerus)', array['Humerus', 'Digital X-Ray']::text[], array['AP', 'LAT']::text[], true, true, 13),
  ('9508b425-0a42-4b33-a691-66d7b744e17b', null, 'imaging', 'X-ray', 'Elbow', array['Digital X-Ray']::text[], array['AP', 'LAT']::text[], true, true, 14),
  ('a2518b3d-a90e-4305-9aa6-fc5120326ba8', null, 'imaging', 'X-ray', 'Forearm', array['Digital X-Ray']::text[], array['AP', 'LAT']::text[], true, true, 15),
  ('e27530c8-dc1e-41f6-88b5-34b0aa33340e', null, 'imaging', 'X-ray', 'Wrist', array['Digital X-Ray']::text[], array['AP', 'LAT', 'Oblique']::text[], true, true, 16),
  ('629c6ad9-1388-4afb-9b70-f0b4330f8e80', null, 'imaging', 'X-ray', 'Hand', array['Digital X-Ray']::text[], array['AP', 'LAT', 'Oblique']::text[], true, true, 17),
  ('54ec2ba7-0d7c-4193-88c0-1bef34c208cf', null, 'imaging', 'X-ray', 'Thigh (Femur)', array['Femur', 'Digital X-Ray']::text[], array['AP', 'LAT']::text[], true, true, 18),
  ('9cffeb44-b98f-4743-9722-6cc86b369e78', null, 'imaging', 'X-ray', 'Knee', array['Digital X-Ray']::text[], array['AP', 'LAT', 'Oblique', 'Skyline (Patella)']::text[], true, true, 19),
  ('03d069bd-0827-46a4-8802-c69c56e5ceae', null, 'imaging', 'X-ray', 'Leg (Tibia/Fibula)', array['Digital X-Ray']::text[], array['AP', 'LAT']::text[], true, true, 20),
  ('71db4472-ff64-40f4-b139-b9fa0f121fae', null, 'imaging', 'X-ray', 'Ankle', array['Digital X-Ray']::text[], array['AP', 'LAT', 'Mortise']::text[], true, true, 21),
  ('1179bd63-ae7e-4551-921d-44166f40796a', null, 'imaging', 'X-ray', 'Foot', array['Digital X-Ray']::text[], array['AP', 'LAT', 'Oblique']::text[], true, true, 22),
  ('3821be5e-e6d2-4e6a-8e8a-bd7e20a58e61', null, 'imaging', 'Ultrasound', 'Obstetric Scan', array['Ultrasound - Obstetric & Gynaecology']::text[], '{}'::text[], false, true, 23),
  ('fc1e6dd5-fc68-4926-8495-6d84cfbc01be', null, 'imaging', 'Ultrasound', 'Anomaly Scan', array['Ultrasound - Obstetric & Gynaecology']::text[], '{}'::text[], false, true, 24),
  ('9bd6ead7-cb0e-4def-a7b6-f97edd58cd68', null, 'imaging', 'Ultrasound', 'Biophysical Profile', array['Ultrasound - Obstetric & Gynaecology']::text[], '{}'::text[], false, true, 25),
  ('f0438d1a-b224-4e07-9d5e-3ca439964434', null, 'imaging', 'Ultrasound', 'Folliculometry', array['Ultrasound - Obstetric & Gynaecology']::text[], '{}'::text[], false, true, 26),
  ('eb8ffa03-3051-41fd-b58c-d05518a5d44a', null, 'imaging', 'Ultrasound', 'Pelvic / Gynaecological Scan', array['Ultrasound - Obstetric & Gynaecology']::text[], '{}'::text[], false, true, 27),
  ('5b5acffc-f9b4-4245-8e31-f89cbca6bf5b', null, 'imaging', 'Ultrasound', 'Transvaginal Scan (TVS)', array['TVS', 'Ultrasound - Obstetric & Gynaecology']::text[], '{}'::text[], false, true, 28),
  ('bb0be2d0-a54f-4d04-add8-a897b4f9a6a2', null, 'imaging', 'Ultrasound', 'Sono-HSG', array['Ultrasound - Obstetric & Gynaecology']::text[], '{}'::text[], false, true, 29),
  ('a33836a1-ced6-4511-978d-b6f1449cd008', null, 'imaging', 'Ultrasound', '3D/4D Scan', array['Ultrasound - Obstetric & Gynaecology']::text[], '{}'::text[], false, true, 30),
  ('c9c966de-dde3-4e73-b4cd-4c49c91c5fd6', null, 'imaging', 'Ultrasound', 'Abdominal Scan (Full)', array['Ultrasound - Abdomen & Pelvis']::text[], '{}'::text[], false, true, 31),
  ('0091073e-92d8-46f8-b5b5-84ce02d6b6fe', null, 'imaging', 'Ultrasound', 'Abdomino-Pelvic Scan', array['Ultrasound - Abdomen & Pelvis']::text[], '{}'::text[], false, true, 32),
  ('82cb35e1-8cce-47df-b482-ef4232bfc653', null, 'imaging', 'Ultrasound', 'Renal / Urinary Tract & Pelvis (Urology)', array['Urology', 'Ultrasound - Abdomen & Pelvis']::text[], '{}'::text[], false, true, 33),
  ('28afdeb4-ada7-472a-9553-6c6907163682', null, 'imaging', 'Ultrasound', 'Prostate (Transabdominal)', array['Ultrasound - Abdomen & Pelvis']::text[], '{}'::text[], false, true, 34),
  ('655cb132-f50b-4d7a-be54-da13dab82626', null, 'imaging', 'Ultrasound', 'Transrectal / Prostate (TRUS)', array['TRUS', 'Ultrasound - Abdomen & Pelvis']::text[], '{}'::text[], false, true, 35),
  ('502707db-638a-475d-9748-270f5e65c7a5', null, 'imaging', 'Ultrasound', 'Adrenals', array['Ultrasound - Abdomen & Pelvis']::text[], '{}'::text[], false, true, 36),
  ('66e67f54-e5b8-4760-ab85-27ef6d7b8e0c', null, 'imaging', 'Ultrasound', 'Thorax', array['Ultrasound - Abdomen & Pelvis']::text[], '{}'::text[], false, true, 37),
  ('40e70cca-78c5-403f-92d4-cc847c3366e5', null, 'imaging', 'Ultrasound', 'Thyroid / Neck Scan', array['Ultrasound - Small Parts & Others']::text[], '{}'::text[], false, true, 38),
  ('4b5659cd-f10f-4c3a-bccb-e2de71ea3e8e', null, 'imaging', 'Ultrasound', 'Breast Ultrasound', array['Ultrasound - Small Parts & Others']::text[], '{}'::text[], false, true, 39),
  ('6ae03748-a94d-4cd5-91a7-76dc40e2b6f9', null, 'imaging', 'Ultrasound', 'Scrotal / Testicular Scan', array['Ultrasound - Small Parts & Others']::text[], '{}'::text[], false, true, 40),
  ('239b0f31-5953-4da4-a320-6a5d544a50a7', null, 'imaging', 'Ultrasound', 'Penile Doppler', array['Ultrasound - Small Parts & Others']::text[], '{}'::text[], false, true, 41),
  ('c23ad0ef-f62c-4d73-8979-1703ac5ab479', null, 'imaging', 'Ultrasound', 'Musculoskeletal Scan', array['Ultrasound - Small Parts & Others']::text[], '{}'::text[], false, true, 42),
  ('dbc887c4-148c-4145-b7dd-c96ead8707c5', null, 'imaging', 'Ultrasound', 'Soft Tissue / Superficial Tumour Scan', array['Ultrasound - Small Parts & Others']::text[], '{}'::text[], false, true, 43),
  ('8fad2045-7260-41ca-9b9f-01ea8d720ef3', null, 'imaging', 'Ultrasound', 'Parotid / Salivary Glands', array['Ultrasound - Small Parts & Others']::text[], '{}'::text[], false, true, 44),
  ('1b34666f-2a31-4b2d-ba36-d25f467a96ef', null, 'imaging', 'Ultrasound', 'Ocular Scan', array['Ultrasound - Small Parts & Others']::text[], '{}'::text[], false, true, 45),
  ('e4cc96c4-cecd-4968-8f75-abd06928d3dd', null, 'imaging', 'Ultrasound', 'Trans-fontanelle Scan', array['Ultrasound - Small Parts & Others']::text[], '{}'::text[], false, true, 46),
  ('1e4a44fd-c4d2-491c-b004-d403248905cf', null, 'imaging', 'Ultrasound', 'Deep Tissue Imaging', array['Ultrasound - Small Parts & Others']::text[], '{}'::text[], false, true, 47),
  ('142f7211-c9ce-46df-a2da-9241937aa490', null, 'imaging', 'Ultrasound', 'Interventional (Ultrasound-Guided Procedure)', array['Ultrasound - Small Parts & Others']::text[], '{}'::text[], false, true, 48),
  ('9c8f865e-0261-43bf-98cc-1002d0dda546', null, 'imaging', 'Ultrasound', 'Doppler Studies (General)', array['Ultrasound - Doppler / Vascular']::text[], '{}'::text[], false, true, 49),
  ('5bf0f93b-5247-4739-8bc9-350ed268d230', null, 'imaging', 'Ultrasound', 'Arterial Doppler', array['Ultrasound - Doppler / Vascular']::text[], '{}'::text[], false, true, 50),
  ('67332546-a57c-481f-9a7c-f6883c6770b6', null, 'imaging', 'Ultrasound', 'Venous Doppler', array['Ultrasound - Doppler / Vascular']::text[], '{}'::text[], false, true, 51),
  ('7c0f9d7d-d48b-4a56-89b2-e757f348ea74', null, 'imaging', 'Ultrasound', 'Carotid Doppler', array['Ultrasound - Doppler / Vascular']::text[], '{}'::text[], false, true, 52),
  ('a136ccf2-b904-4ab6-a216-199a1bac6e4a', null, 'imaging', 'Ultrasound', 'Peripheral Doppler', array['Ultrasound - Doppler / Vascular']::text[], '{}'::text[], false, true, 53),
  ('b110b10d-37d7-4b0c-b947-d1acb23e8716', null, 'imaging', 'Ultrasound', 'Renal Doppler', array['Ultrasound - Doppler / Vascular']::text[], '{}'::text[], false, true, 54),
  ('92866cdc-0a8c-43b6-956d-f98c2051022e', null, 'imaging', 'Ultrasound', 'Upper Extremities Doppler', array['Ultrasound - Doppler / Vascular']::text[], '{}'::text[], false, true, 55),
  ('d7d45c66-6ddb-48e9-a55d-1d69723e65da', null, 'imaging', 'Ultrasound', 'Lower Extremities Doppler', array['Ultrasound - Doppler / Vascular']::text[], '{}'::text[], false, true, 56),
  ('8ca73f3e-21c0-4cf4-baf5-d607038efb7d', null, 'imaging', 'CT', 'CT Brain', '{}'::text[], '{}'::text[], false, true, 57),
  ('85529d8d-264e-4d95-b053-5cb8ea0fcfc2', null, 'imaging', 'CT', 'CT Brain (Trauma)', '{}'::text[], '{}'::text[], false, true, 58),
  ('4fab9864-6dab-421e-a224-9deabd21a152', null, 'imaging', 'CT', 'CT Paranasal Sinuses', '{}'::text[], '{}'::text[], false, true, 59),
  ('6c31cc44-3da3-43dc-9537-a1faf0799322', null, 'imaging', 'CT', 'CT Orbits', '{}'::text[], '{}'::text[], false, true, 60),
  ('d5b91988-7621-4d13-bcf8-99eff52193fc', null, 'imaging', 'CT', 'CT Mastoids / IAM', '{}'::text[], '{}'::text[], false, true, 61),
  ('bb6553b8-18b8-4d9a-a12b-17786d5acfee', null, 'imaging', 'CT', 'CT Neck', '{}'::text[], '{}'::text[], false, true, 62),
  ('1f96e571-48f5-42dd-8cf8-423c848325d0', null, 'imaging', 'CT', 'CT Chest (HRCT)', array['HRCT']::text[], '{}'::text[], false, true, 63),
  ('a85cef2d-9578-4e9f-b12f-f9baf4783961', null, 'imaging', 'CT', 'CT Chest (Contrast)', '{}'::text[], '{}'::text[], false, true, 64),
  ('2197fa98-d5d0-4580-ac6d-ae548e982d1e', null, 'imaging', 'CT', 'CT Abdomen', '{}'::text[], '{}'::text[], false, true, 65),
  ('aa3d4d43-5324-4e61-8ac0-bec8f1ef48e0', null, 'imaging', 'CT', 'CT Pelvis', '{}'::text[], '{}'::text[], false, true, 66),
  ('1d37c8c2-4b92-478a-bb2d-fa68c5250c04', null, 'imaging', 'CT', 'CT Abdomen & Pelvis', '{}'::text[], '{}'::text[], false, true, 67),
  ('a8587bfd-32b1-4d70-85b5-4ac0aae1e5ac', null, 'imaging', 'CT', 'CT Cervical Spine', '{}'::text[], '{}'::text[], false, true, 68),
  ('3b5f920f-a981-4a17-b15d-df9cf572c86b', null, 'imaging', 'CT', 'CT Thoracic Spine', '{}'::text[], '{}'::text[], false, true, 69),
  ('87150ad8-11e8-429c-a3c8-5d53a9cc0f42', null, 'imaging', 'CT', 'CT Lumbo-Sacral Spine', '{}'::text[], '{}'::text[], false, true, 70),
  ('297049cc-dbf8-4218-892e-450efc6c333c', null, 'imaging', 'CT', 'CT Angiography', '{}'::text[], '{}'::text[], false, true, 71),
  ('f33be201-dbcc-4d81-bdca-bcce7a72a50f', null, 'imaging', 'CT', 'CT Urography', '{}'::text[], '{}'::text[], false, true, 72),
  ('3a62c450-56c0-477f-b44a-4637d0759e61', null, 'imaging', 'CT', 'CT Colonography', '{}'::text[], '{}'::text[], false, true, 73),
  ('35d5b5cd-c9d2-4292-b98c-80555063cab1', null, 'imaging', 'CT', 'CT Cancer Staging', '{}'::text[], '{}'::text[], false, true, 74),
  ('6474c9b4-9f71-437e-b233-882af0163028', null, 'imaging', 'CT', 'CT Others (specify)', '{}'::text[], '{}'::text[], false, true, 75),
  ('94707ff6-7474-40e6-a398-d2fa5a5f5c9e', null, 'imaging', 'MRI', 'MRI Brain / Head', '{}'::text[], '{}'::text[], false, true, 76),
  ('01309b06-cd08-4160-8607-2f5e182d7fb7', null, 'imaging', 'MRI', 'MRI Orbits', '{}'::text[], '{}'::text[], false, true, 77),
  ('3082cee9-524a-491b-ac8b-181774915880', null, 'imaging', 'MRI', 'MRI Sinuses', '{}'::text[], '{}'::text[], false, true, 78),
  ('aeba63c9-779b-4d91-bd0a-0098d4e295a0', null, 'imaging', 'MRI', 'MRI IAM', '{}'::text[], '{}'::text[], false, true, 79),
  ('11a854f2-ee8c-4c58-869e-a42b8cb1103c', null, 'imaging', 'MRI', 'MRI TMJ', '{}'::text[], '{}'::text[], false, true, 80),
  ('2a48c362-712d-4f60-acef-dd0abaf98baa', null, 'imaging', 'MRI', 'MRI Mastoids', '{}'::text[], '{}'::text[], false, true, 81),
  ('bbd334c4-323a-4758-8e2b-b5440c220c47', null, 'imaging', 'MRI', 'MRI Cervical Spine', '{}'::text[], '{}'::text[], false, true, 82),
  ('02499bcf-219c-4a0a-98c1-18d79c88c76e', null, 'imaging', 'MRI', 'MRI Thoracic Spine', '{}'::text[], '{}'::text[], false, true, 83),
  ('65bc76be-0b09-44e3-9f21-e09f7ceeb037', null, 'imaging', 'MRI', 'MRI Lumbo-Sacral Spine', '{}'::text[], '{}'::text[], false, true, 84),
  ('7f35b279-d755-477c-88cc-05bc328c805c', null, 'imaging', 'MRI', 'MRI Whole Spine', '{}'::text[], '{}'::text[], false, true, 85),
  ('56001945-7cb3-464e-b433-65a1f3aa4996', null, 'imaging', 'MRI', 'MRI Chest', '{}'::text[], '{}'::text[], false, true, 86),
  ('8a038c23-2df7-4e92-8a01-d0c0eaf73a8e', null, 'imaging', 'MRI', 'MRI Abdomen', '{}'::text[], '{}'::text[], false, true, 87),
  ('7fd49113-19f7-4fa1-9193-c1dcc2ed0b3c', null, 'imaging', 'MRI', 'MRI Pelvis', '{}'::text[], '{}'::text[], false, true, 88),
  ('6c22e8db-3459-46e4-bc39-e19cc673e17e', null, 'imaging', 'MRI', 'MRI Abdomen & Pelvis', '{}'::text[], '{}'::text[], false, true, 89),
  ('36644bf2-5c23-4200-8d2e-4497149723d9', null, 'imaging', 'MRI', 'MRI Shoulder', '{}'::text[], '{}'::text[], false, true, 90),
  ('23612e04-45d8-4038-87ca-5c732425b6bb', null, 'imaging', 'MRI', 'MRI Elbow', '{}'::text[], '{}'::text[], false, true, 91),
  ('c14978f0-b53f-4da1-9096-ebb59bddda5e', null, 'imaging', 'MRI', 'MRI Wrist / Hand', '{}'::text[], '{}'::text[], false, true, 92),
  ('5406b726-80d2-4550-a903-30e42a1ee210', null, 'imaging', 'MRI', 'MRI Hip', '{}'::text[], '{}'::text[], false, true, 93),
  ('b2c60c6d-9d04-4099-985e-3fff8e795ee4', null, 'imaging', 'MRI', 'MRI Knee', '{}'::text[], '{}'::text[], false, true, 94),
  ('43ebd0f4-b3ec-4fb0-8421-04994a69324d', null, 'imaging', 'MRI', 'MRI Both Knees', '{}'::text[], '{}'::text[], false, true, 95),
  ('98da4cc3-5446-41ea-9c43-7b827922d626', null, 'imaging', 'MRI', 'MRI Ankle / Foot', '{}'::text[], '{}'::text[], false, true, 96),
  ('7c8bcd92-db7d-4ab2-843c-8c807d7e2f9a', null, 'imaging', 'MRI', 'MRI Upper / Lower Limb', '{}'::text[], '{}'::text[], false, true, 97),
  ('3b9a0d6e-f509-412a-bfe0-9c98e0485225', null, 'imaging', 'MRI', 'MRA (Angiogram)', '{}'::text[], '{}'::text[], false, true, 98),
  ('41f9bf43-e865-4e45-9fc8-8b72b82bc9bb', null, 'imaging', 'MRI', 'MRV (Venogram)', '{}'::text[], '{}'::text[], false, true, 99),
  ('74970360-5b91-4a08-9f60-34d6c4cd2770', null, 'imaging', 'MRI', 'MRCP', '{}'::text[], '{}'::text[], false, true, 100),
  ('f59dd70f-7286-4b17-a9ea-1598ae8f4937', null, 'imaging', 'MRI', 'MRU (Urogram)', '{}'::text[], '{}'::text[], false, true, 101),
  ('a176ae8b-c93e-45fe-a04f-21fafac73930', null, 'imaging', 'MRI', 'MRI Perfusion (Brain)', '{}'::text[], '{}'::text[], false, true, 102),
  ('e2bd484f-723d-4299-ad19-f6e9d80ec8a1', null, 'imaging', 'MRI', 'MRI Breast', '{}'::text[], '{}'::text[], false, true, 103),
  ('9314c3d8-9667-4bc1-9ba2-23df5b833f49', null, 'imaging', 'MRI', 'MRI Cancer Staging', '{}'::text[], '{}'::text[], false, true, 104),
  ('f25fcb21-7efc-43e1-8fc4-6b9d0c331782', null, 'imaging', 'MRI', 'MRI Whole Body', '{}'::text[], '{}'::text[], false, true, 105),
  ('1648ffa0-00f5-4fe8-a34f-0ed9dc157a8b', null, 'imaging', 'MRI', 'MRI with Contrast / Others (specify)', '{}'::text[], '{}'::text[], false, true, 106),
  ('8a26a4de-90d7-4032-9343-d80df116fe3d', null, 'imaging', 'Mammography', 'Mammography (Digital)', '{}'::text[], '{}'::text[], false, true, 107),
  ('3259d3ad-190d-41a9-9dff-4471a0112033', null, 'imaging', 'Mammography', 'Breast Biopsy (Image-Guided)', '{}'::text[], '{}'::text[], false, true, 108),
  ('e575ef1c-09d7-4a32-8ed7-c19faa1a22a4', null, 'imaging', 'Mammography', 'Galactography', '{}'::text[], '{}'::text[], false, true, 109),
  ('f2007e24-f347-4e99-aa2f-ab47c0a29b65', null, 'imaging', 'Mammography', 'Breast MRI', '{}'::text[], '{}'::text[], false, true, 110),
  ('071dc05d-b958-4f10-828c-25cbe4c4e9fd', null, 'imaging', 'Special/Contrast', 'Barium Swallow', '{}'::text[], '{}'::text[], false, true, 111),
  ('4e8a27d6-a5f6-4239-903e-a724d2b06253', null, 'imaging', 'Special/Contrast', 'Barium Meal', '{}'::text[], '{}'::text[], false, true, 112),
  ('25cf396c-198b-428b-be23-ded2e855765b', null, 'imaging', 'Special/Contrast', 'Barium Meal & Follow-Through', '{}'::text[], '{}'::text[], false, true, 113),
  ('8255e0a4-5756-4fab-9ce1-a6656c99e536', null, 'imaging', 'Special/Contrast', 'Barium Enema', '{}'::text[], '{}'::text[], false, true, 114),
  ('6228d3d6-b0cc-445f-a099-cb690519994e', null, 'imaging', 'Special/Contrast', 'Double Contrast Barium Enema', '{}'::text[], '{}'::text[], false, true, 115),
  ('ca1d9ca5-008a-4679-87cc-e6fa50f7f365', null, 'imaging', 'Special/Contrast', 'Hysterosalpingography (HSG)', array['HSG']::text[], '{}'::text[], false, true, 116),
  ('d7ff12d0-885c-4f5b-b989-4309faef9f17', null, 'imaging', 'Special/Contrast', 'Intravenous Urography (IVU)', array['IVU']::text[], '{}'::text[], false, true, 117),
  ('0ef6280b-073c-41fc-97ba-9214d5f45c80', null, 'imaging', 'Special/Contrast', 'Retrograde Urethrogram (RUG)', array['RUG']::text[], '{}'::text[], false, true, 118),
  ('fb2f3ec0-0049-483c-be6f-fb7bb88411c1', null, 'imaging', 'Special/Contrast', 'Micturating Cystourethrogram (MCUG)', array['MCUG']::text[], '{}'::text[], false, true, 119),
  ('03ad791f-7926-40a3-bbe5-525e2d42f24f', null, 'imaging', 'Special/Contrast', 'Ascending Urethrocystography (RUCG + MCUG)', '{}'::text[], '{}'::text[], false, true, 120),
  ('e0253ad0-ebce-4fac-9ebd-d34cfa761b14', null, 'imaging', 'Special/Contrast', 'Fistulogram', '{}'::text[], '{}'::text[], false, true, 121),
  ('2f605824-2e30-4c3a-82f4-f9246b157db1', null, 'imaging', 'Special/Contrast', 'Sialogram', '{}'::text[], '{}'::text[], false, true, 122),
  ('c6ce07f6-5360-4ba4-8bbb-5806a29f02d6', null, 'imaging', 'Special/Contrast', 'Venogram', '{}'::text[], '{}'::text[], false, true, 123),
  ('83fa7dee-6eab-4a3b-9509-b3d553ae6023', null, 'imaging', 'Special/Contrast', 'Fluoroscopic Studies (specify)', '{}'::text[], '{}'::text[], false, true, 124),
  ('a2de236f-5cfb-4812-bd81-a40f8691c1ac', null, 'other', 'Cardiology', 'ECG (Resting)', array['electrocardiogram', 'ECG at rest']::text[], '{}'::text[], false, true, 125),
  ('fa5656b8-18fc-400d-9ecb-362704d5cbeb', null, 'other', 'Cardiology', 'ECG (Pre & Post Exercise)', '{}'::text[], '{}'::text[], false, true, 126),
  ('495bf907-1c69-422f-8523-791a0c26a1bc', null, 'other', 'Cardiology', 'ECG with Cardiologist Report', '{}'::text[], '{}'::text[], false, true, 127),
  ('2e6bb76d-984f-4a06-94d6-cfc2e23a0641', null, 'other', 'Cardiology', 'Stress ECG (Exercise Tolerance Test)', '{}'::text[], '{}'::text[], false, true, 128),
  ('521bc948-9f89-4ad0-86d4-8d542a55b1b6', null, 'other', 'Cardiology', 'Echocardiography (Adult)', '{}'::text[], '{}'::text[], false, true, 129),
  ('7f1354ed-a9e8-480c-962a-642ca47467f5', null, 'other', 'Cardiology', 'Echocardiography (Child & Foetal)', array['paediatric echo']::text[], '{}'::text[], false, true, 130),
  ('53acf1e4-358d-43b7-98f1-ea342df983d2', null, 'other', 'Cardiology', '2D Echocardiogram', '{}'::text[], '{}'::text[], false, true, 131),
  ('45ed88ef-b643-458c-a4e5-4b04327376db', null, 'other', 'Cardiology', 'Doppler Echocardiogram', '{}'::text[], '{}'::text[], false, true, 132),
  ('9c8c92db-f924-4987-af31-d0021129e5ce', null, 'other', 'Cardiology', 'Stress Echo', '{}'::text[], '{}'::text[], false, true, 133),
  ('edf1360a-cc16-49c2-9943-914299cb1da1', null, 'other', 'Cardiology', 'Dobutamine / Saline Infusion Echo', '{}'::text[], '{}'::text[], false, true, 134),
  ('202c20be-053b-4b5c-8e02-dc9f997596e4', null, 'other', 'Cardiology', 'Trans-Oesophageal Echo', '{}'::text[], '{}'::text[], false, true, 135),
  ('5dbe1aa0-287d-4b50-adfe-471772e597ae', null, 'other', 'Cardiology', 'Cardiac Risk Profile', '{}'::text[], '{}'::text[], false, true, 136),
  ('5b997f2c-2135-4606-96f8-6ad489371cc2', null, 'other', 'Cardiology', 'Annual Cardiac Assessment', '{}'::text[], '{}'::text[], false, true, 137),
  ('53a036f4-a2c9-4e40-afb2-a41ea7b09240', null, 'other', 'Cardiology', 'Group / Sport Cardiac Profile', '{}'::text[], '{}'::text[], false, true, 138),
  ('53db652e-b021-4919-92ac-ec9790aaf578', null, 'other', 'Neurology & Function Tests', 'EEG (Electroencephalogram)', '{}'::text[], '{}'::text[], false, true, 139),
  ('3f3269d0-df86-4357-ac28-29a9091c2569', null, 'other', 'Neurology & Function Tests', 'Spirometry', '{}'::text[], '{}'::text[], false, true, 140),
  ('53b18de2-6149-4d4d-a708-bfec64f12fad', null, 'other', 'Neurology & Function Tests', 'Audiometry', '{}'::text[], '{}'::text[], false, true, 141),
  ('8eedaae7-2029-43f8-bced-3aedac9a3656', null, 'other', 'Neurology & Function Tests', 'Vision Screening', '{}'::text[], '{}'::text[], false, true, 142),
  ('020ac951-7963-43bf-b11d-f81d31f7519d', null, 'other', 'Endoscopy', 'Upper GI Endoscopy', '{}'::text[], '{}'::text[], false, true, 143),
  ('5ccf748d-f886-48a3-8577-bde32aaf7cda', null, 'other', 'Endoscopy', 'Colonoscopy', '{}'::text[], '{}'::text[], false, true, 144),
  ('010c2651-9ba1-4b33-ba81-0ecb230e9fb2', null, 'other', 'Endoscopy', 'Out-patient Haemorrhoid Treatment', '{}'::text[], '{}'::text[], false, true, 145),
  ('c6769cfa-f592-48e5-be75-a7e68342c0f9', null, 'other', 'Cancer Screening', 'Prostate Cancer Screening', '{}'::text[], '{}'::text[], false, true, 146),
  ('0b4dc2e4-9aeb-43c6-b00e-79d97823d2ee', null, 'other', 'Cancer Screening', 'Cervical Cancer Screening', '{}'::text[], '{}'::text[], false, true, 147),
  ('5e0fb894-9ca9-4c85-a535-3debfadc0f56', null, 'other', 'Cancer Screening', 'Breast Cancer Screening', '{}'::text[], '{}'::text[], false, true, 148),
  ('d7267fe8-5993-412f-a04b-f4967e21e501', null, 'other', 'Cancer Screening', 'Colon Cancer Screening', '{}'::text[], '{}'::text[], false, true, 149),
  ('f5d4d51f-a801-41c8-9af2-cc0e107e6858', null, 'other', 'Cancer Screening', 'Cancer Screening Consultation', '{}'::text[], '{}'::text[], false, true, 150),
  ('28a7f193-0437-4789-92d6-ce2c457899db', null, 'other', 'Cancer Screening', 'Oncology Imaging for Staging of Cancer', '{}'::text[], '{}'::text[], false, true, 151),
  ('c4ae7ed3-c61b-4641-b517-01168358193e', null, 'other', 'Health Check Packages', 'Routine Medical Check-up', '{}'::text[], '{}'::text[], false, true, 152),
  ('51f78ddf-ed2a-4a2f-9b8e-c74a828c7d86', null, 'other', 'Health Check Packages', 'Pre-Employment Medical Examination', '{}'::text[], '{}'::text[], false, true, 153),
  ('13aa8d22-719c-4238-a3ce-3012d61742fd', null, 'other', 'Health Check Packages', 'Pilgrims Medical Examination', '{}'::text[], '{}'::text[], false, true, 154),
  ('3d7c0b47-4546-45b4-b446-e41145b788cd', null, 'other', 'Health Check Packages', 'Pre-School Admission Examination', '{}'::text[], '{}'::text[], false, true, 155),
  ('ca03ac6d-396b-4d9c-b282-83e019a47fb1', null, 'other', 'Physiotherapy Referral', 'Physiotherapy - Stroke (CVA) Rehabilitation', '{}'::text[], '{}'::text[], false, true, 156),
  ('192fda98-bfc8-4ab8-b032-86ccc614e77c', null, 'other', 'Physiotherapy Referral', 'Physiotherapy - Orthopaedics (Osteoarthritis)', '{}'::text[], '{}'::text[], false, true, 157),
  ('b938798e-829d-473b-a7d1-3f21bffd44c6', null, 'other', 'Physiotherapy Referral', 'Physiotherapy - Geriatrics (Elderly)', '{}'::text[], '{}'::text[], false, true, 158),
  ('ba549f26-1d4b-49af-a813-cfbcdd9f9d3e', null, 'other', 'Physiotherapy Referral', 'Physiotherapy - Paediatrics', '{}'::text[], '{}'::text[], false, true, 159),
  ('65e7b708-9c14-48a3-be8f-799fd0742a29', null, 'other', 'Physiotherapy Referral', 'Physiotherapy - Pain Management', '{}'::text[], '{}'::text[], false, true, 160),
  ('f877a3a8-3560-4f02-bf7e-b05c2ef821ef', null, 'other', 'Physiotherapy Referral', 'Physiotherapy - Post-Operative', '{}'::text[], '{}'::text[], false, true, 161),
  ('4f09c9b5-b042-4189-bc24-19cc5c46cb00', null, 'other', 'Physiotherapy Referral', 'Physiotherapy - Back Care Education', '{}'::text[], '{}'::text[], false, true, 162),
  ('6440df91-6de5-4555-b41d-22cab1ed0510', null, 'other', 'Physiotherapy Referral', 'Physiotherapy - Fall Prevention', '{}'::text[], '{}'::text[], false, true, 163),
  ('45f24833-89f4-4cf3-a390-0d1165ca8eb2', null, 'other', 'Physiotherapy Referral', 'Physiotherapy - Weight Management', '{}'::text[], '{}'::text[], false, true, 164),
  ('9645492f-3c71-4a59-863d-fda99c3442de', null, 'other', 'Physiotherapy Referral', 'Physiotherapy - Fitness Assessment', '{}'::text[], '{}'::text[], false, true, 165),
  ('d4165c05-0e92-4025-a2ec-2ca62ed3cc56', null, 'other', 'Physiotherapy Referral', 'Physiotherapy - Pregnancy-Related', '{}'::text[], '{}'::text[], false, true, 166),
  ('6afbf734-beb7-4afc-b005-843431975564', null, 'other', 'Physiotherapy Referral', 'Physiotherapy - Home Assessment', '{}'::text[], '{}'::text[], false, true, 167)
on conflict (id) do nothing;
