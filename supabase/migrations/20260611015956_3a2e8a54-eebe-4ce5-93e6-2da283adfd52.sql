-- Public hospital directory (patients need to discover hospitals during triage)
CREATE POLICY "Public can view active hospitals"
ON public.hospitals FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Public doctor directory (for specialty matching)
CREATE POLICY "Public can view doctors"
ON public.doctors FOR SELECT
TO anon, authenticated
USING (true);

-- Public hospital-doctor links (so triage can map specialty -> hospital)
CREATE POLICY "Public can view hospital-doctor links"
ON public.hospital_doctors FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- Patients can request letters (pending only)
CREATE POLICY "Patients can request letters"
ON public.patient_letters FOR INSERT
TO authenticated
WITH CHECK (
  status = 'pending'
  AND patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
);

-- Make sure anon can SELECT (grants) for the public-readable tables
GRANT SELECT ON public.hospitals TO anon;
GRANT SELECT ON public.doctors TO anon;
GRANT SELECT ON public.hospital_doctors TO anon;