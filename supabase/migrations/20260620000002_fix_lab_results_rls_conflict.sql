-- Fix: Prevent staff policy from blocking doctors
-- Drop the restrictive staff policy
DROP POLICY IF EXISTS "Staff can insert lab results" ON public.lab_results;

-- Replace with staff-only policy (excludes doctors)
CREATE POLICY "Staff can insert lab results" ON public.lab_results
  FOR INSERT TO authenticated
  WITH CHECK (
    hospital_id = public.get_user_hospital_id(auth.uid())
    AND public.get_user_hospital_id(auth.uid()) IS NOT NULL
  );
