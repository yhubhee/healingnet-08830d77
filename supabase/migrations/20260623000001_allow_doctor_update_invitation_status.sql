-- Allow doctors to update their own invitation status
CREATE POLICY "doctors_can_update_own_status" ON public.hospital_doctors
FOR UPDATE
USING (
  doctor_id = (SELECT id FROM public.doctors WHERE user_id = auth.uid())
)
WITH CHECK (
  doctor_id = (SELECT id FROM public.doctors WHERE user_id = auth.uid())
);
