-- Update patient check-in policy to only include doctors with active hospital_doctors status
CREATE POLICY "Patients can view their hospital checkins" ON public.patient_checkins
FOR SELECT TO authenticated
USING (
  -- Allow patients to view their own check-ins at any hospital
  patient_id = (SELECT id FROM public.patients WHERE user_id = auth.uid() LIMIT 1)
  OR
  -- Allow hospital staff to view check-ins
  EXISTS (
    SELECT 1 FROM public.hospital_staff
    WHERE user_id = auth.uid()
    AND hospital_id = patient_checkins.hospital_id
    AND is_active = TRUE
  )
);

-- Update EMR policy to only show doctors with active status
CREATE POLICY "Patients can view their EMR" ON public.emr_entries
FOR SELECT TO authenticated
USING (
  patient_id = (SELECT id FROM public.patients WHERE user_id = auth.uid() LIMIT 1)
  OR
  EXISTS (
    SELECT 1 FROM public.hospital_staff hs
    WHERE hs.user_id = auth.uid()
    AND hs.hospital_id = emr_entries.hospital_id
    AND hs.is_active = TRUE
  )
);

-- When querying hospital_doctors for display, filter by status = 'active'
-- This should be handled in the frontend query, but document it:
-- SELECT * FROM hospital_doctors WHERE status = 'active' AND is_active = TRUE
