GRANT UPDATE ON public.prescriptions TO authenticated;
CREATE POLICY "Staff can update hospital prescriptions" ON public.prescriptions FOR UPDATE TO authenticated
USING (get_user_hospital_id(auth.uid()) IS NOT NULL AND hospital_id = get_user_hospital_id(auth.uid()))
WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));