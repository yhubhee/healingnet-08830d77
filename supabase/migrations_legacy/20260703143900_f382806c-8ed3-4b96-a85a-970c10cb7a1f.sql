-- Restore doctor portal access after security hardening while keeping RLS enabled.

-- Ensure authenticated users can call the existing safe resolver functions.
GRANT EXECUTE ON FUNCTION public.get_user_doctor_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_hospital_id(uuid) TO authenticated;

-- Doctors need to update their profile/verification fields under RLS, but normal reads stay column-limited.
GRANT SELECT (
  id, user_id, first_name, last_name, email, phone, specialty, years_experience,
  rating, profile_image_url, bio, is_available, created_at, updated_at,
  verification_status, verification_reviewed_at, verification_submitted_at,
  current_practice
) ON public.doctors TO authenticated;

GRANT UPDATE (
  first_name, last_name, email, phone, specialty, years_experience,
  profile_image_url, bio, is_available, updated_at,
  verification_status, license_number, license_council, license_expiry,
  verification_submitted_at, verification_rejection_reason,
  current_practice, credential_documents, reference_contact
) ON public.doctors TO authenticated;

GRANT INSERT (
  user_id, first_name, last_name, email, phone, specialty, years_experience,
  profile_image_url, bio, is_available, verification_status
) ON public.doctors TO authenticated;

-- Keep a safe self-profile view for a doctor's own full credentials.
CREATE OR REPLACE VIEW public.my_doctor_profile
WITH (security_invoker = false) AS
  SELECT *
  FROM public.doctors
  WHERE user_id = auth.uid();

GRANT SELECT ON public.my_doctor_profile TO authenticated;

-- Helper: does a doctor actively belong to a hospital?
CREATE OR REPLACE FUNCTION public.is_doctor_at_hospital(_doctor_id uuid, _hospital_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.hospital_doctors hd
    WHERE hd.doctor_id = _doctor_id
      AND hd.hospital_id = _hospital_id
      AND COALESCE(hd.is_active, true) = true
      AND COALESCE(hd.status, 'active') <> 'rejected'
  )
$$;

-- Helper: first active hospital for a selected doctor, used for telemedicine booking.
CREATE OR REPLACE FUNCTION public.get_doctor_hospital_id(_doctor_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hd.hospital_id
  FROM public.hospital_doctors hd
  WHERE hd.doctor_id = _doctor_id
    AND COALESCE(hd.is_active, true) = true
    AND COALESCE(hd.status, 'active') <> 'rejected'
  ORDER BY hd.created_at DESC
  LIMIT 1
$$;

-- Helper: active hospitals for a selected doctor, used by patient booking UI.
CREATE OR REPLACE FUNCTION public.get_doctor_hospital_ids(_doctor_id uuid)
RETURNS TABLE(hospital_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hd.hospital_id
  FROM public.hospital_doctors hd
  WHERE hd.doctor_id = _doctor_id
    AND COALESCE(hd.is_active, true) = true
    AND COALESCE(hd.status, 'active') <> 'rejected'
  ORDER BY hd.created_at DESC
$$;

-- Helper: is a patient linked to this doctor through appointment, prescription, lab order,
-- check-in assignment, or a shared hospital context in those records?
CREATE OR REPLACE FUNCTION public.can_doctor_access_patient(_doctor_id uuid, _patient_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _doctor_id IS NOT NULL
     AND _patient_id IS NOT NULL
     AND (
      EXISTS (
        SELECT 1 FROM public.patient_appointments pa
        WHERE pa.patient_id = _patient_id
          AND (
            pa.doctor_id = _doctor_id
            OR public.is_doctor_at_hospital(_doctor_id, pa.hospital_id)
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.prescriptions pr
        WHERE pr.patient_id = _patient_id
          AND (
            pr.doctor_id = _doctor_id
            OR public.is_doctor_at_hospital(_doctor_id, pr.hospital_id)
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.lab_results lr
        WHERE lr.patient_id = _patient_id
          AND (
            lr.ordered_by = _doctor_id
            OR public.is_doctor_at_hospital(_doctor_id, lr.hospital_id)
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.patient_checkins pc
        WHERE pc.patient_id = _patient_id
          AND (
            pc.assigned_doctor_id = _doctor_id
            OR public.is_doctor_at_hospital(_doctor_id, pc.hospital_id)
          )
      )
    )
$$;

GRANT EXECUTE ON FUNCTION public.is_doctor_at_hospital(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_doctor_hospital_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_doctor_hospital_ids(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_doctor_access_patient(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_doctor_at_hospital(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_doctor_hospital_id(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_doctor_hospital_ids(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_doctor_access_patient(uuid, uuid) TO service_role;

-- doctors
DROP POLICY IF EXISTS "Doctors can view own profile" ON public.doctors;
CREATE POLICY "Doctors can view own profile"
  ON public.doctors FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- hospital_doctors
DROP POLICY IF EXISTS "Doctors view own hospital links" ON public.hospital_doctors;
CREATE POLICY "Doctors view own hospital links"
  ON public.hospital_doctors FOR SELECT
  TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()));

-- patients
DROP POLICY IF EXISTS "Doctors can view linked patients" ON public.patients;
CREATE POLICY "Doctors can view linked patients"
  ON public.patients FOR SELECT
  TO authenticated
  USING (public.can_doctor_access_patient(public.get_user_doctor_id(auth.uid()), id));

-- patient_appointments
DROP POLICY IF EXISTS "Doctor view assigned appts" ON public.patient_appointments;
CREATE POLICY "Doctors can view linked appointments"
  ON public.patient_appointments FOR SELECT
  TO authenticated
  USING (
    doctor_id = public.get_user_doctor_id(auth.uid())
    OR public.is_doctor_at_hospital(public.get_user_doctor_id(auth.uid()), hospital_id)
  );

DROP POLICY IF EXISTS "Doctor update assigned appts" ON public.patient_appointments;
CREATE POLICY "Doctors can update assigned appointments"
  ON public.patient_appointments FOR UPDATE
  TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()))
  WITH CHECK (doctor_id = public.get_user_doctor_id(auth.uid()));

DROP POLICY IF EXISTS "Patient insert own appts" ON public.patient_appointments;
CREATE POLICY "Patients can book valid appointments"
  ON public.patient_appointments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.patients p
      WHERE p.id = patient_appointments.patient_id
        AND p.user_id = auth.uid()
    )
    AND hospital_id IS NOT NULL
    AND (
      doctor_id IS NULL
      OR public.is_doctor_at_hospital(doctor_id, hospital_id)
    )
  );

DROP POLICY IF EXISTS "Staff can create hospital appointments" ON public.patient_appointments;
CREATE POLICY "Staff can create hospital appointments"
  ON public.patient_appointments FOR INSERT
  TO authenticated
  WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));

-- lab_results
DROP POLICY IF EXISTS "Doctor view own lab orders" ON public.lab_results;
DROP POLICY IF EXISTS "doctors_can_view_ordered_labs" ON public.lab_results;
CREATE POLICY "Doctors can view linked lab orders"
  ON public.lab_results FOR SELECT
  TO authenticated
  USING (
    ordered_by = public.get_user_doctor_id(auth.uid())
    OR public.is_doctor_at_hospital(public.get_user_doctor_id(auth.uid()), hospital_id)
  );

DROP POLICY IF EXISTS "doctors_can_create_lab_orders" ON public.lab_results;
CREATE POLICY "Doctors can create lab orders for their hospitals"
  ON public.lab_results FOR INSERT
  TO authenticated
  WITH CHECK (
    ordered_by = public.get_user_doctor_id(auth.uid())
    AND public.is_doctor_at_hospital(public.get_user_doctor_id(auth.uid()), hospital_id)
  );

-- lab_result_tests
DROP POLICY IF EXISTS "Doctors can view linked lab test rows" ON public.lab_result_tests;
CREATE POLICY "Doctors can view linked lab test rows"
  ON public.lab_result_tests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.lab_results lr
      WHERE lr.id = lab_result_tests.lab_result_id
        AND (
          lr.ordered_by = public.get_user_doctor_id(auth.uid())
          OR public.is_doctor_at_hospital(public.get_user_doctor_id(auth.uid()), lr.hospital_id)
        )
    )
  );

-- prescriptions
DROP POLICY IF EXISTS "doctors_view_own_prescriptions" ON public.prescriptions;
CREATE POLICY "Doctors can view linked prescriptions"
  ON public.prescriptions FOR SELECT
  TO authenticated
  USING (
    doctor_id = public.get_user_doctor_id(auth.uid())
    OR public.is_doctor_at_hospital(public.get_user_doctor_id(auth.uid()), hospital_id)
  );

DROP POLICY IF EXISTS "doctors_insert_prescriptions" ON public.prescriptions;
CREATE POLICY "Doctors can create prescriptions for their hospitals"
  ON public.prescriptions FOR INSERT
  TO authenticated
  WITH CHECK (
    doctor_id = public.get_user_doctor_id(auth.uid())
    AND public.is_doctor_at_hospital(public.get_user_doctor_id(auth.uid()), hospital_id)
  );

DROP POLICY IF EXISTS "Doctors can update own prescriptions" ON public.prescriptions;
CREATE POLICY "Doctors can update own prescriptions"
  ON public.prescriptions FOR UPDATE
  TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()))
  WITH CHECK (doctor_id = public.get_user_doctor_id(auth.uid()));