-- Verify the doctor's appointments are actually being created
-- This helps diagnose why appointments show count but not list

-- First, let's ensure the doctor_id is correctly set in appointments
-- Add a constraint to verify data integrity
ALTER TABLE public.patient_appointments
  ADD CONSTRAINT fk_doctor_appointments
  FOREIGN KEY (doctor_id) REFERENCES public.doctors(id) ON DELETE SET NULL;

-- Create a diagnostic view for troubleshooting
CREATE OR REPLACE VIEW public.doctor_appointments_diagnostic AS
SELECT
  pa.id,
  pa.doctor_id,
  pa.patient_id,
  pa.status,
  pa.is_telemedicine,
  d.first_name as doctor_name,
  p.first_name as patient_name,
  pa.created_at
FROM public.patient_appointments pa
LEFT JOIN public.doctors d ON pa.doctor_id = d.id
LEFT JOIN public.patients p ON pa.patient_id = p.id
WHERE pa.doctor_id IS NOT NULL
ORDER BY pa.created_at DESC;

GRANT SELECT ON public.doctor_appointments_diagnostic TO authenticated;
