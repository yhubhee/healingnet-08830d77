
-- Fix overly permissive RLS on patients table
DROP POLICY IF EXISTS "Staff can insert patients" ON public.patients;
DROP POLICY IF EXISTS "Staff can update patients" ON public.patients;

-- Only hospital staff can insert/update patients
CREATE POLICY "Staff can insert patients" ON public.patients
FOR INSERT TO authenticated
WITH CHECK (public.get_user_hospital_id(auth.uid()) IS NOT NULL);

CREATE POLICY "Staff can update patients" ON public.patients
FOR UPDATE TO authenticated
USING (public.get_user_hospital_id(auth.uid()) IS NOT NULL);
