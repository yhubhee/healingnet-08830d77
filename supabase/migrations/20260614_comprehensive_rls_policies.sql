-- Comprehensive patient_appointments RLS policies
-- This ensures doctors, patients, and hospital staff can access their appointments

-- Verify existing patient policies work correctly
DO $$ BEGIN
  -- Patient can view and manage their own appointments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Patient view own appts' AND tablename='patient_appointments') THEN
    CREATE POLICY "Patient view own appts" ON public.patient_appointments
      FOR SELECT TO authenticated USING (
        EXISTS(SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
      );
  END IF;
END $$;

-- Ensure doctor policies exist and work
-- Doctors can view and update their own appointments
DO $$ BEGIN
  -- Check if function exists, if not create it
  IF NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_user_doctor_id' AND routine_schema = 'public') THEN
    CREATE FUNCTION public.get_user_doctor_id(_user_id uuid)
    RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
      SELECT id FROM public.doctors WHERE user_id = _user_id LIMIT 1
    $$;
  END IF;
END $$;

-- Doctor policies (with error handling)
DROP POLICY IF EXISTS "Doctor view own appointments" ON public.patient_appointments;
DROP POLICY IF EXISTS "Doctor update own appointments" ON public.patient_appointments;

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

-- Hospital staff can view and update appointments for their hospital
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname='Hospital staff view appts' AND tablename='patient_appointments') THEN
    CREATE POLICY "Hospital staff view appts" ON public.patient_appointments
      FOR SELECT TO authenticated USING (
        hospital_id = get_user_hospital_id(auth.uid()) AND hospital_id IS NOT NULL
      );
  END IF;
END $$;

-- Add index for faster doctor appointment queries
CREATE INDEX IF NOT EXISTS idx_patient_appointments_doctor_id
ON public.patient_appointments(doctor_id)
WHERE doctor_id IS NOT NULL;

-- Add index for faster patient queries
CREATE INDEX IF NOT EXISTS idx_patient_appointments_patient_id
ON public.patient_appointments(patient_id);
