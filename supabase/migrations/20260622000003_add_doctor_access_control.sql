-- Add RLS policies for doctors to access their hospital's patients and check-ins
-- This ensures doctors can only see data for hospitals they're currently assigned to

CREATE POLICY "Doctors can view their hospital patients" ON public.patients
FOR SELECT TO authenticated
USING (
  -- Doctor can view patients if they're assigned to any hospital
  EXISTS (
    SELECT 1 FROM public.hospital_doctors hd
    WHERE hd.doctor_id = (SELECT id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1)
    AND hd.is_active = TRUE
  )
);

CREATE POLICY "Doctors can view their hospital checkins" ON public.patient_checkins
FOR SELECT TO authenticated
USING (
  -- Doctor can view check-ins for hospitals they're assigned to
  EXISTS (
    SELECT 1 FROM public.hospital_doctors hd
    WHERE hd.hospital_id = patient_checkins.hospital_id
    AND hd.doctor_id = (SELECT id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1)
    AND hd.is_active = TRUE
  )
);

CREATE POLICY "Doctors can view their hospital EMR" ON public.emr_entries
FOR SELECT TO authenticated
USING (
  -- Doctor can view EMR for hospitals they're assigned to
  EXISTS (
    SELECT 1 FROM public.hospital_doctors hd
    WHERE hd.hospital_id = emr_entries.hospital_id
    AND hd.doctor_id = (SELECT id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1)
    AND hd.is_active = TRUE
  )
);

CREATE POLICY "Doctors can view their hospital maternity records" ON public.maternity_records
FOR SELECT TO authenticated
USING (
  -- Doctor can view maternity records for hospitals they're assigned to
  EXISTS (
    SELECT 1 FROM public.hospital_doctors hd
    WHERE hd.hospital_id = maternity_records.hospital_id
    AND hd.doctor_id = (SELECT id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1)
    AND hd.is_active = TRUE
  )
);

CREATE POLICY "Doctors can view their hospital surgery records" ON public.surgery_records
FOR SELECT TO authenticated
USING (
  -- Doctor can view surgery records for hospitals they're assigned to
  EXISTS (
    SELECT 1 FROM public.hospital_doctors hd
    WHERE hd.hospital_id = surgery_records.hospital_id
    AND hd.doctor_id = (SELECT id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1)
    AND hd.is_active = TRUE
  )
);

CREATE POLICY "Doctors can view their hospital referrals" ON public.hospital_referrals
FOR SELECT TO authenticated
USING (
  -- Doctor can view referrals for hospitals they're assigned to
  EXISTS (
    SELECT 1 FROM public.hospital_doctors hd
    WHERE hd.hospital_id = hospital_referrals.hospital_id
    AND hd.doctor_id = (SELECT id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1)
    AND hd.is_active = TRUE
  )
);

-- When a doctor is removed from hospital_doctors, the above policies will prevent access
-- because the EXISTS check will return FALSE (no active hospital_doctors record)
