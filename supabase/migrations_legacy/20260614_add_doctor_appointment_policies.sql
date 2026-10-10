-- Add doctor RLS policy for patient_appointments
-- Doctors should be able to see their own appointments
CREATE POLICY IF NOT EXISTS "Doctor view own appointments" ON public.patient_appointments
  FOR SELECT TO authenticated USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  );

-- Doctors should be able to update their own appointments
CREATE POLICY IF NOT EXISTS "Doctor update own appointments" ON public.patient_appointments
  FOR UPDATE TO authenticated USING (
    doctor_id IN (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  );
