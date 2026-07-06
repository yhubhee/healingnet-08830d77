-- Restore Data API privileges that are required before RLS policies can be evaluated.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.doctors TO authenticated;
GRANT ALL ON public.doctors TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients TO authenticated;
GRANT ALL ON public.patients TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_appointments TO authenticated;
GRANT ALL ON public.patient_appointments TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_results TO authenticated;
GRANT ALL ON public.lab_results TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_result_tests TO authenticated;
GRANT ALL ON public.lab_result_tests TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;
GRANT ALL ON public.prescriptions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_doctors TO authenticated;
GRANT ALL ON public.hospital_doctors TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hospital_staff TO authenticated;
GRANT ALL ON public.hospital_staff TO service_role;

GRANT SELECT ON public.my_doctor_profile TO authenticated;
GRANT SELECT ON public.my_doctor_profile TO service_role;

-- Replace brittle policies with explicit, auth-only policies for the broken doctor/patient paths.
DROP POLICY IF EXISTS "Doctors can view own profile" ON public.doctors;
CREATE POLICY "Doctors can view own profile"
ON public.doctors
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Doctor update self" ON public.doctors;
CREATE POLICY "Doctor update self"
ON public.doctors
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Doctors can view linked patients" ON public.patients;
CREATE POLICY "Doctors can view linked patients"
ON public.patients
FOR SELECT
TO authenticated
USING (public.can_doctor_access_patient(public.get_user_doctor_id(auth.uid()), id));

DROP POLICY IF EXISTS "Patient view self" ON public.patients;
CREATE POLICY "Patient view self"
ON public.patients
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Doctors can view linked appointments" ON public.patient_appointments;
CREATE POLICY "Doctors can view linked appointments"
ON public.patient_appointments
FOR SELECT
TO authenticated
USING (
  doctor_id = public.get_user_doctor_id(auth.uid())
  OR public.is_doctor_at_hospital(public.get_user_doctor_id(auth.uid()), hospital_id)
);

DROP POLICY IF EXISTS "Patient view own appts" ON public.patient_appointments;
CREATE POLICY "Patient view own appts"
ON public.patient_appointments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = patient_appointments.patient_id
      AND p.user_id = auth.uid()
  )
  OR hospital_id = public.get_user_hospital_id(auth.uid())
);

DROP POLICY IF EXISTS "Doctors can view linked lab orders" ON public.lab_results;
CREATE POLICY "Doctors can view linked lab orders"
ON public.lab_results
FOR SELECT
TO authenticated
USING (
  ordered_by = public.get_user_doctor_id(auth.uid())
  OR public.is_doctor_at_hospital(public.get_user_doctor_id(auth.uid()), hospital_id)
);

DROP POLICY IF EXISTS "patients_can_view_own_labs" ON public.lab_results;
CREATE POLICY "Patients can view own lab results"
ON public.lab_results
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = lab_results.patient_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Doctors can view linked lab test rows" ON public.lab_result_tests;
CREATE POLICY "Doctors can view linked lab test rows"
ON public.lab_result_tests
FOR SELECT
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

DROP POLICY IF EXISTS "Patients can view own lab test rows" ON public.lab_result_tests;
CREATE POLICY "Patients can view own lab test rows"
ON public.lab_result_tests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lab_results lr
    JOIN public.patients p ON p.id = lr.patient_id
    WHERE lr.id = lab_result_tests.lab_result_id
      AND p.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Doctors can view linked prescriptions" ON public.prescriptions;
CREATE POLICY "Doctors can view linked prescriptions"
ON public.prescriptions
FOR SELECT
TO authenticated
USING (
  doctor_id = public.get_user_doctor_id(auth.uid())
  OR public.is_doctor_at_hospital(public.get_user_doctor_id(auth.uid()), hospital_id)
);

DROP POLICY IF EXISTS "patients_view_own_prescriptions" ON public.prescriptions;
CREATE POLICY "Patients can view own prescriptions"
ON public.prescriptions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.patients p
    WHERE p.id = prescriptions.patient_id
      AND p.user_id = auth.uid()
  )
);

-- Keep hospital staff/admin hospital-scoped access intact for linked hospital data.
DROP POLICY IF EXISTS "Staff can view patients" ON public.patients;
CREATE POLICY "Staff can view patients"
ON public.patients
FOR SELECT
TO authenticated
USING (public.get_user_hospital_id(auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Staff can view lab results" ON public.lab_results;
CREATE POLICY "Staff can view lab results"
ON public.lab_results
FOR SELECT
TO authenticated
USING (hospital_id = public.get_user_hospital_id(auth.uid()));

DROP POLICY IF EXISTS "Staff can view lab tests" ON public.lab_result_tests;
CREATE POLICY "Staff can view lab tests"
ON public.lab_result_tests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.lab_results lr
    WHERE lr.id = lab_result_tests.lab_result_id
      AND lr.hospital_id = public.get_user_hospital_id(auth.uid())
  )
);

DROP POLICY IF EXISTS "staff_view_hospital_prescriptions" ON public.prescriptions;
CREATE POLICY "Staff can view hospital prescriptions"
ON public.prescriptions
FOR SELECT
TO authenticated
USING (
  hospital_id = public.get_user_hospital_id(auth.uid())
  AND public.get_user_hospital_id(auth.uid()) IS NOT NULL
);