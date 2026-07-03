
-- ============ doctors: enable RLS + column privileges + self view ============
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view doctors" ON public.doctors;
DROP POLICY IF EXISTS "Authenticated can view doctors" ON public.doctors;

CREATE POLICY "Anyone can view doctor directory"
  ON public.doctors FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE SELECT ON public.doctors FROM anon, authenticated;

GRANT SELECT (
  id, user_id, first_name, last_name, specialty, profile_image_url,
  bio, rating, years_experience, is_available, verification_status,
  verification_reviewed_at, verification_submitted_at, current_practice,
  email, phone, created_at, updated_at
) ON public.doctors TO authenticated;

GRANT SELECT (
  id, first_name, last_name, specialty, profile_image_url,
  bio, rating, years_experience, is_available, verification_status
) ON public.doctors TO anon;

GRANT ALL ON public.doctors TO service_role;

-- Definer-owned view so a doctor can read own full row (incl. license & credentials)
CREATE OR REPLACE VIEW public.my_doctor_profile
WITH (security_invoker = false) AS
  SELECT * FROM public.doctors WHERE user_id = auth.uid();

GRANT SELECT ON public.my_doctor_profile TO authenticated;

-- ============ doctor_settings ============
DROP POLICY IF EXISTS "Authenticated can view doctor settings" ON public.doctor_settings;

-- ============ doctor_availability ============
DROP POLICY IF EXISTS "Public can view available slots" ON public.doctor_availability;
DROP POLICY IF EXISTS "Authenticated can view availability" ON public.doctor_availability;

CREATE POLICY "Authenticated can view available slots"
  ON public.doctor_availability FOR SELECT
  TO authenticated
  USING (is_available = true);

-- ============ hospital_doctors ============
DROP POLICY IF EXISTS "Public can view hospital-doctor links" ON public.hospital_doctors;

CREATE POLICY "Doctors view own hospital links"
  ON public.hospital_doctors FOR SELECT
  TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()));

-- ============ patient_appointments ============
DROP POLICY IF EXISTS "Public can view booked slots" ON public.patient_appointments;

-- ============ patients ============
DROP POLICY IF EXISTS "Staff can view patients" ON public.patients;

CREATE POLICY "Staff can view patients"
  ON public.patients FOR SELECT
  TO authenticated
  USING (public.get_user_hospital_id(auth.uid()) IS NOT NULL);

-- ============ contact_messages ============
DROP POLICY IF EXISTS "Hospital admins can view contact messages" ON public.contact_messages;

DROP POLICY IF EXISTS "Anyone can submit a contact message" ON public.contact_messages;
CREATE POLICY "Anyone can submit a contact message"
  ON public.contact_messages FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(name) BETWEEN 1 AND 200
    AND char_length(email) BETWEEN 3 AND 320
    AND char_length(message) BETWEEN 1 AND 5000
  );

-- ============ SECURITY DEFINER functions: revoke anon EXECUTE ============
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_hospital_admin(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_hospital_staff(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_hospital_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_doctor_id(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_hospital_plan(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_hospital_with_admin(text, text, text, text, text, text, text) FROM PUBLIC, anon;
