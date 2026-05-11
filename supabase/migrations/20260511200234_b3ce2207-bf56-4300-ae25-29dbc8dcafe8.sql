
ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS license_number text,
  ADD COLUMN IF NOT EXISTS license_council text,
  ADD COLUMN IF NOT EXISTS license_expiry date,
  ADD COLUMN IF NOT EXISTS verification_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_rejection_reason text,
  ADD COLUMN IF NOT EXISTS current_practice jsonb,
  ADD COLUMN IF NOT EXISTS credential_documents jsonb,
  ADD COLUMN IF NOT EXISTS reference_contact jsonb;

UPDATE public.doctors SET verification_status = 'approved' WHERE verification_status = 'unverified' AND created_at < now();

CREATE INDEX IF NOT EXISTS idx_doctors_verification_status ON public.doctors(verification_status);

INSERT INTO storage.buckets (id, name, public)
VALUES ('doctor-credentials', 'doctor-credentials', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Doctors upload own credentials"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'doctor-credentials' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Doctors view own credentials"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'doctor-credentials' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Doctors update own credentials"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'doctor-credentials' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Hospital admins view all credentials"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'doctor-credentials' AND EXISTS (
    SELECT 1 FROM public.hospital_staff
    WHERE user_id = auth.uid() AND role = 'admin' AND is_active = true
  ));
