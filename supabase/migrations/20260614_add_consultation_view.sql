-- Create a materialized view for hospital staff to see consultation activity
-- This helps track telemedicine sessions and their status
CREATE OR REPLACE VIEW public.active_consultations AS
SELECT
  pa.id,
  pa.patient_id,
  pa.doctor_id,
  pa.hospital_id,
  pa.is_telemedicine,
  pa.status,
  pa.requested_date,
  pa.requested_time,
  pa.call_started_at,
  pa.call_ended_at,
  pa.consultation_notes,
  p.first_name as patient_first_name,
  p.last_name as patient_last_name,
  d.first_name as doctor_first_name,
  d.last_name as doctor_last_name,
  d.specialty,
  h.name as hospital_name,
  EXTRACT(EPOCH FROM (COALESCE(pa.call_ended_at, now()) - pa.call_started_at)) / 60 as duration_minutes
FROM public.patient_appointments pa
LEFT JOIN public.patients p ON pa.patient_id = p.id
LEFT JOIN public.doctors d ON pa.doctor_id = d.id
LEFT JOIN public.hospitals h ON pa.hospital_id = h.id
WHERE pa.is_telemedicine = true AND pa.status IN ('accepted', 'completed')
ORDER BY pa.call_started_at DESC NULLS LAST;

-- Grant access to hospital staff
GRANT SELECT ON public.active_consultations TO authenticated;
