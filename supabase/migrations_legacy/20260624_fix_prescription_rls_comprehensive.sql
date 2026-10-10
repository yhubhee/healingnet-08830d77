-- Comprehensive fix for prescription visibility issues
-- This replaces all existing prescription policies with clear, explicit rules

-- 1. Drop all existing prescription policies to avoid conflicts
DROP POLICY IF EXISTS "View prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Staff insert prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Staff update prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Doctor view own prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "Doctor insert prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "patients_can_view_own_prescriptions" ON public.prescriptions;

-- 2. Fresh policies for prescriptions

-- Patients can view their own prescriptions
CREATE POLICY "patients_view_own_prescriptions" ON public.prescriptions
FOR SELECT TO authenticated
USING (
    patient_id = (SELECT id FROM public.patients WHERE user_id = auth.uid() LIMIT 1)
);

-- Doctors can view prescriptions they issued
CREATE POLICY "doctors_view_own_prescriptions" ON public.prescriptions
FOR SELECT TO authenticated
USING (
    doctor_id = (SELECT id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1)
);

-- Staff can view all prescriptions at their hospital
CREATE POLICY "staff_view_hospital_prescriptions" ON public.prescriptions
FOR SELECT TO authenticated
USING (
    hospital_id = public.get_user_hospital_id(auth.uid())
    AND public.get_user_hospital_id(auth.uid()) IS NOT NULL
);

-- Doctors can insert prescriptions
CREATE POLICY "doctors_insert_prescriptions" ON public.prescriptions
FOR INSERT TO authenticated
WITH CHECK (
    doctor_id = (SELECT id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1)
);

-- Staff can insert prescriptions for their hospital
CREATE POLICY "staff_insert_prescriptions" ON public.prescriptions
FOR INSERT TO authenticated
WITH CHECK (
    hospital_id = public.get_user_hospital_id(auth.uid())
    AND public.get_user_hospital_id(auth.uid()) IS NOT NULL
);

-- Doctors can update their own prescriptions
CREATE POLICY "doctors_update_prescriptions" ON public.prescriptions
FOR UPDATE TO authenticated
USING (
    doctor_id = (SELECT id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1)
)
WITH CHECK (
    doctor_id = (SELECT id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1)
);

-- Staff can update prescriptions at their hospital
CREATE POLICY "staff_update_prescriptions" ON public.prescriptions
FOR UPDATE TO authenticated
USING (
    hospital_id = public.get_user_hospital_id(auth.uid())
    AND public.get_user_hospital_id(auth.uid()) IS NOT NULL
)
WITH CHECK (
    hospital_id = public.get_user_hospital_id(auth.uid())
    AND public.get_user_hospital_id(auth.uid()) IS NOT NULL
);
