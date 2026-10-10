-- =============================================================================
-- Local development seed (fake data only).
--
-- `supabase db reset` runs this after the migrations. `supabase db push` never
-- runs it, so nothing here reaches the hosted project.
--
-- Three sign-in accounts, all with the password: healingnet-dev-only
--   admin@hospital.example.com   hospital admin, HealingNet Test Hospital
--   doctor@hospital.example.com  approved doctor, active at the test hospital
--   patient@example.com          patient, registered at the test hospital
-- =============================================================================

-- Creating the auth users fires public.handle_new_user(), which provisions the
-- hospital (30-day EMR trial), the doctor (unverified) and the patient from the
-- metadata below.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
   'admin@hospital.example.com', extensions.crypt('healingnet-dev-only', extensions.gen_salt('bf')), now(),
   '{"provider": "email", "providers": ["email"]}',
   '{"role": "hospital", "first_name": "Ada", "last_name": "Admin", "hospital_name": "HealingNet Test Hospital",
     "hospital_address": "1 Test Road, Ikeja", "hospital_phone": "+2340000000001"}',
   now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
   'doctor@hospital.example.com', extensions.crypt('healingnet-dev-only', extensions.gen_salt('bf')), now(),
   '{"provider": "email", "providers": ["email"]}',
   '{"role": "doctor", "first_name": "Tunde", "last_name": "Testdoctor", "specialty": "General Practice"}',
   now(), now(), '', '', '', '', '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated',
   'patient@example.com', extensions.crypt('healingnet-dev-only', extensions.gen_salt('bf')), now(),
   '{"provider": "email", "providers": ["email"]}',
   '{"role": "patient", "first_name": "Ngozi", "last_name": "Testpatient", "phone": "+2340000000003"}',
   now(), now(), '', '', '', '', '', '', '', '');

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
  from auth.users u
 where u.id in ('11111111-1111-4111-8111-111111111111',
                '22222222-2222-4222-8222-222222222222',
                '33333333-3333-4333-8333-333333333333');

-- Approve the test hospital and give it a paid telemedicine plan so every
-- feature can be tested.
update public.hospitals h
   set verification_status = 'approved',
       verified_at = now(),
       active_plan = 'telemedicine',
       subscription_status = 'active',
       plan_expires_at = now() + interval '1 year',
       trial_ends_at = null,
       city = 'Lagos',
       state = 'Lagos'
  from public.hospital_staff hs
 where hs.hospital_id = h.id
   and hs.user_id = '11111111-1111-4111-8111-111111111111';

update public.hospital_subscriptions s
   set plan = 'telemedicine',
       status = 'active',
       expires_at = now() + interval '1 year'
  from public.hospital_staff hs
 where hs.hospital_id = s.hospital_id
   and hs.user_id = '11111111-1111-4111-8111-111111111111';

-- Approve the test doctor and attach them to the hospital.
update public.doctors
   set verification_status = 'approved',
       verification_submitted_at = now(),
       verification_reviewed_at = now(),
       license_number = 'TEST-MDCN-0001',
       license_council = 'Test council',
       years_experience = 5
 where user_id = '22222222-2222-4222-8222-222222222222';

insert into public.hospital_doctors (hospital_id, doctor_id, status, is_active, department)
select hs.hospital_id, d.id, 'active', true, 'General Medicine'
  from public.hospital_staff hs, public.doctors d
 where hs.user_id = '11111111-1111-4111-8111-111111111111'
   and d.user_id = '22222222-2222-4222-8222-222222222222';

-- Register the test patient at the hospital.
update public.patients
   set date_of_birth = '1990-01-01', gender = 'female', blood_group = 'O+', genotype = 'AA', city = 'Lagos', state = 'Lagos'
 where user_id = '33333333-3333-4333-8333-333333333333';

insert into public.hospital_patients (hospital_id, patient_id)
select hs.hospital_id, p.id
  from public.hospital_staff hs, public.patients p
 where hs.user_id = '11111111-1111-4111-8111-111111111111'
   and p.user_id = '33333333-3333-4333-8333-333333333333';
