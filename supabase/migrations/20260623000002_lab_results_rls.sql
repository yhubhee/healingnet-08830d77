-- Allow doctors to create lab result orders for their hospital patients
CREATE POLICY "doctors_can_create_lab_orders" ON public.lab_results
FOR INSERT
WITH CHECK (
  -- Doctor must be creating the order (ordered_by = their id)
  ordered_by = (SELECT id FROM public.doctors WHERE user_id = auth.uid())
  AND
  -- Doctor must be assigned to this hospital
  hospital_id IN (
    SELECT hospital_id FROM public.hospital_doctors
    WHERE doctor_id = (SELECT id FROM public.doctors WHERE user_id = auth.uid())
    AND status = 'active'
  )
);

-- Allow doctors to view lab results they ordered
CREATE POLICY "doctors_can_view_ordered_labs" ON public.lab_results
FOR SELECT
USING (
  ordered_by = (SELECT id FROM public.doctors WHERE user_id = auth.uid())
);

-- Allow patients to view their own lab results
CREATE POLICY "patients_can_view_own_labs" ON public.lab_results
FOR SELECT
USING (
  patient_id = (SELECT id FROM public.patients WHERE user_id = auth.uid())
);

