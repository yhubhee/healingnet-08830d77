-- Fix RLS issues for doctors: lab orders and prescriptions visibility

-- 1. Fix get_user_hospital_id to safely return a single hospital_id using COALESCE
-- This prevents potential issues with UNION ALL returning multiple rows
CREATE OR REPLACE FUNCTION public.get_user_hospital_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (SELECT hospital_id FROM public.hospital_staff
         WHERE user_id = _user_id AND is_active = TRUE
         LIMIT 1),
        (SELECT hd.hospital_id FROM public.hospital_doctors hd
         WHERE hd.doctor_id = (SELECT id FROM public.doctors WHERE user_id = _user_id LIMIT 1)
         AND hd.is_active = TRUE
         LIMIT 1)
    )
$$;

-- 2. Add explicit doctor policy for inserting lab result tests
DROP POLICY IF EXISTS "doctors_can_insert_lab_tests" ON public.lab_result_tests;
CREATE POLICY "doctors_can_insert_lab_tests" ON public.lab_result_tests
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.lab_results lr
        WHERE lr.id = lab_result_id
        AND lr.ordered_by = (SELECT id FROM public.doctors WHERE user_id = auth.uid() LIMIT 1)
    )
);

-- 3. Add explicit patient policy for viewing prescriptions
DROP POLICY IF EXISTS "patients_can_view_own_prescriptions" ON public.prescriptions;
CREATE POLICY "patients_can_view_own_prescriptions" ON public.prescriptions
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.patients p
        WHERE p.id = patient_id AND p.user_id = auth.uid()
    )
);

-- Note: Keep the existing "View prescriptions" policy for backward compatibility with staff
