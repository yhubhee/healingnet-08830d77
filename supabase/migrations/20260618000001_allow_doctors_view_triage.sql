-- Add RLS policy to allow doctors to view triage sessions for patients they have appointments/consultations with
ALTER TABLE public.triage_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctors view triage for their patients"
  ON public.triage_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patient_appointments pa
      JOIN public.doctors d ON d.id = pa.doctor_id
      WHERE pa.patient_id = triage_sessions.patient_id
      AND d.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.consultation_requests cr
      JOIN public.doctors d ON d.id = cr.doctor_id
      WHERE cr.patient_id = triage_sessions.patient_id
      AND d.user_id = auth.uid()
    )
  );
