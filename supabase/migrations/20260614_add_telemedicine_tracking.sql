-- Add missing telemedicine tracking to patient_appointments
ALTER TABLE public.patient_appointments
  ADD COLUMN IF NOT EXISTS call_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS call_ended_at timestamptz,
  ADD COLUMN IF NOT EXISTS consultation_notes text;

-- Create index for real-time queries
CREATE INDEX IF NOT EXISTS idx_patient_appointments_is_telemedicine
ON public.patient_appointments(is_telemedicine, status)
WHERE is_telemedicine = true;
