-- Allow authenticated users to insert their own doctor profile
CREATE POLICY "Doctors can create own profile" ON public.doctors
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- Allow doctors to update their own profile
CREATE POLICY "Doctors can update own profile" ON public.doctors
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
