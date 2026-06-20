-- Allow doctors to create lab orders for their patients
CREATE POLICY "Doctor create lab orders" ON public.lab_results
  FOR INSERT TO authenticated
  WITH CHECK (ordered_by = public.get_user_doctor_id(auth.uid()));

-- Allow doctors to update their own lab orders
CREATE POLICY "Doctor update own lab orders" ON public.lab_results
  FOR UPDATE TO authenticated
  USING (ordered_by = public.get_user_doctor_id(auth.uid()))
  WITH CHECK (ordered_by = public.get_user_doctor_id(auth.uid()));
