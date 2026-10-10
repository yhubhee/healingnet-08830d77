-- Hospital staff must be able to update test rows when entering results
CREATE POLICY "Staff can update lab tests"
ON public.lab_result_tests
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.lab_results lr WHERE lr.id = lab_result_tests.lab_result_id AND lr.hospital_id = public.get_user_hospital_id(auth.uid())))
WITH CHECK (EXISTS (SELECT 1 FROM public.lab_results lr WHERE lr.id = lab_result_tests.lab_result_id AND lr.hospital_id = public.get_user_hospital_id(auth.uid())));

-- Ordering doctor can remove a test item from their own order
CREATE POLICY "Doctors can delete own order test rows"
ON public.lab_result_tests
FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.lab_results lr WHERE lr.id = lab_result_tests.lab_result_id AND lr.ordered_by = public.get_user_doctor_id(auth.uid())));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_result_tests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_result_parameters TO authenticated;
GRANT ALL ON public.lab_result_tests TO service_role;
GRANT ALL ON public.lab_result_parameters TO service_role;