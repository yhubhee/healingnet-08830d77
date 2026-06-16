-- Create a helper function to get the user's doctor ID (similar to get_user_hospital_id)
CREATE OR REPLACE FUNCTION public.get_user_doctor_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id FROM public.doctors WHERE user_id = _user_id LIMIT 1
$$;

-- Drop the problematic policies
DROP POLICY IF EXISTS "Doctor view own appointments" ON public.patient_appointments;
DROP POLICY IF EXISTS "Doctor update own appointments" ON public.patient_appointments;

-- Create simpler, more reliable doctor policies using the helper function
CREATE POLICY "Doctor view own appointments" ON public.patient_appointments
  FOR SELECT TO authenticated USING (
    doctor_id = get_user_doctor_id(auth.uid())
  );

CREATE POLICY "Doctor update own appointments" ON public.patient_appointments
  FOR UPDATE TO authenticated USING (
    doctor_id = get_user_doctor_id(auth.uid())
  ) WITH CHECK (
    doctor_id = get_user_doctor_id(auth.uid())
  );
