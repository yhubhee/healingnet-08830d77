-- Add status column to patients
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'outpatient';

-- Prevent double-booking of same doctor/date/time for active appointments
CREATE UNIQUE INDEX IF NOT EXISTS patient_appointments_doctor_slot_unique
ON public.patient_appointments (doctor_id, requested_date, requested_time)
WHERE status IN ('pending','accepted','confirmed') AND requested_time IS NOT NULL;

-- Allow patients (authenticated users) to read doctor availability for booking
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='doctor_availability' AND policyname='Public can view available slots') THEN
    CREATE POLICY "Public can view available slots" ON public.doctor_availability
      FOR SELECT TO authenticated, anon USING (is_available = true);
  END IF;
END $$;

GRANT SELECT ON public.doctor_availability TO anon;

-- Allow patients to view busy slots (just times) for any doctor
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='patient_appointments' AND policyname='Public can view booked slots') THEN
    CREATE POLICY "Public can view booked slots" ON public.patient_appointments
      FOR SELECT TO authenticated USING (true);
  END IF;
END $$;