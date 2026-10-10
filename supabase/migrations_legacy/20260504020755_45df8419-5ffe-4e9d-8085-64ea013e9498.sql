
-- Doctor portal helper functions
CREATE OR REPLACE FUNCTION public.get_user_doctor_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.doctors WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.is_hospital_admin(_user_id uuid, _hospital_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hospital_staff
    WHERE user_id = _user_id AND hospital_id = _hospital_id AND role = 'admin' AND is_active = TRUE
  )
$$;

-- Update handle_new_user to support doctor role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.raw_user_meta_data->>'role') = 'patient' THEN
    INSERT INTO public.patients (user_id, first_name, last_name, email, phone)
    VALUES (NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name','Patient'),
      COALESCE(NEW.raw_user_meta_data->>'last_name',''),
      NEW.email,
      NEW.raw_user_meta_data->>'phone');
  ELSIF (NEW.raw_user_meta_data->>'role') = 'doctor' THEN
    INSERT INTO public.doctors (user_id, first_name, last_name, email, phone, specialty)
    VALUES (NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name','Doctor'),
      COALESCE(NEW.raw_user_meta_data->>'last_name',''),
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'specialty');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Doctor RLS additions
CREATE POLICY "Doctor view assigned appts" ON public.patient_appointments
  FOR SELECT TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()));

CREATE POLICY "Doctor update assigned appts" ON public.patient_appointments
  FOR UPDATE TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()));

CREATE POLICY "Doctor view own emr" ON public.emr_entries
  FOR SELECT TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()));

CREATE POLICY "Doctor insert emr" ON public.emr_entries
  FOR INSERT TO authenticated
  WITH CHECK (doctor_id = public.get_user_doctor_id(auth.uid()));

CREATE POLICY "Doctor view own prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()));

CREATE POLICY "Doctor insert prescriptions" ON public.prescriptions
  FOR INSERT TO authenticated
  WITH CHECK (doctor_id = public.get_user_doctor_id(auth.uid()));

CREATE POLICY "Doctor view assigned consultations" ON public.consultation_requests
  FOR SELECT TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()));

CREATE POLICY "Doctor update assigned consultations" ON public.consultation_requests
  FOR UPDATE TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()));

CREATE POLICY "Doctor view own lab orders" ON public.lab_results
  FOR SELECT TO authenticated
  USING (ordered_by = public.get_user_doctor_id(auth.uid()));

CREATE POLICY "Doctor view own checkins" ON public.patient_checkins
  FOR SELECT TO authenticated
  USING (assigned_doctor_id = public.get_user_doctor_id(auth.uid()));

-- Doctor self-update + marketplace insert
CREATE POLICY "Doctor update self" ON public.doctors
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Doctor manage marketplace" ON public.doctor_marketplace
  FOR ALL TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()))
  WITH CHECK (doctor_id = public.get_user_doctor_id(auth.uid()));

-- Hospital admin policies
CREATE POLICY "Admin update hospital" ON public.hospitals
  FOR UPDATE TO authenticated
  USING (public.is_hospital_admin(auth.uid(), id));

CREATE POLICY "Admin insert staff" ON public.hospital_staff
  FOR INSERT TO authenticated
  WITH CHECK (public.is_hospital_admin(auth.uid(), hospital_id));

CREATE POLICY "Admin update staff" ON public.hospital_staff
  FOR UPDATE TO authenticated
  USING (public.is_hospital_admin(auth.uid(), hospital_id));

CREATE POLICY "Admin delete staff" ON public.hospital_staff
  FOR DELETE TO authenticated
  USING (public.is_hospital_admin(auth.uid(), hospital_id));

-- Notification preferences
CREATE TABLE IF NOT EXISTS public.hospital_notification_prefs (
  hospital_id uuid PRIMARY KEY,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hospital_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view notif prefs" ON public.hospital_notification_prefs
  FOR SELECT TO authenticated
  USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Admin upsert notif prefs" ON public.hospital_notification_prefs
  FOR ALL TO authenticated
  USING (public.is_hospital_admin(auth.uid(), hospital_id))
  WITH CHECK (public.is_hospital_admin(auth.uid(), hospital_id));
