-- Ensure patient RLS policies work correctly
-- Create a function to get the patient ID for a user (similar to doctor and hospital functions)
CREATE OR REPLACE FUNCTION public.get_user_patient_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM public.patients WHERE user_id = _user_id LIMIT 1
$$;

-- Simplify patient RLS policies
DROP POLICY IF EXISTS "Patient view own appts" ON public.patient_appointments;
DROP POLICY IF EXISTS "Patient insert own appts" ON public.patient_appointments;

-- Patient can view their own appointments
CREATE POLICY "Patient view own appts" ON public.patient_appointments
  FOR SELECT TO authenticated USING (
    patient_id = get_user_patient_id(auth.uid())
  );

-- Patient can insert their own appointments (for triage booking)
CREATE POLICY "Patient insert own appts" ON public.patient_appointments
  FOR INSERT TO authenticated WITH CHECK (
    patient_id = get_user_patient_id(auth.uid())
  );

-- Create index for faster patient queries
CREATE INDEX IF NOT EXISTS idx_patient_appointments_patient_id
ON public.patient_appointments(patient_id);
