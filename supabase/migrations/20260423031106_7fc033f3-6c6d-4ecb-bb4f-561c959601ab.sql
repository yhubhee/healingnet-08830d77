
-- Subscriptions
CREATE TABLE public.hospital_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL,
  plan text NOT NULL DEFAULT 'emr' CHECK (plan IN ('emr','telemedicine')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','trialing','past_due','canceled')),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hospital_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view subscription" ON public.hospital_subscriptions
  FOR SELECT TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff insert subscription" ON public.hospital_subscriptions
  FOR INSERT TO authenticated WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff update subscription" ON public.hospital_subscriptions
  FOR UPDATE TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_hospital_plan(_hospital_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT plan FROM public.hospital_subscriptions
  WHERE hospital_id = _hospital_id AND status = 'active'
  ORDER BY started_at DESC LIMIT 1
$$;

-- Appointments
CREATE TABLE public.patient_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  hospital_id uuid NOT NULL,
  doctor_id uuid,
  requested_date date NOT NULL,
  requested_time time,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','completed','cancelled')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient view own appts" ON public.patient_appointments
  FOR SELECT TO authenticated USING (
    EXISTS(SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
    OR hospital_id = get_user_hospital_id(auth.uid())
  );
CREATE POLICY "Patient insert own appts" ON public.patient_appointments
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS(SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
    OR hospital_id = get_user_hospital_id(auth.uid())
  );
CREATE POLICY "Staff update appts" ON public.patient_appointments
  FOR UPDATE TO authenticated USING (
    hospital_id = get_user_hospital_id(auth.uid())
    OR EXISTS(SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
  );

-- Prescriptions
CREATE TABLE public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL,
  hospital_id uuid NOT NULL,
  doctor_id uuid,
  drug_name text NOT NULL,
  dosage text,
  frequency text,
  duration text,
  instructions text,
  refills_allowed int DEFAULT 0,
  refills_used int DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated USING (
    hospital_id = get_user_hospital_id(auth.uid())
    OR EXISTS(SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid())
  );
CREATE POLICY "Staff insert prescriptions" ON public.prescriptions
  FOR INSERT TO authenticated WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff update prescriptions" ON public.prescriptions
  FOR UPDATE TO authenticated USING (hospital_id = get_user_hospital_id(auth.uid()));

-- Messages
CREATE TABLE public.patient_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  subject text,
  body text NOT NULL,
  is_read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.patient_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View own messages" ON public.patient_messages
  FOR SELECT TO authenticated USING (auth.uid() IN (from_user_id, to_user_id));
CREATE POLICY "Send messages" ON public.patient_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Update own received messages" ON public.patient_messages
  FOR UPDATE TO authenticated USING (auth.uid() = to_user_id);

-- Triggers for updated_at
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.hospital_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_appts_updated BEFORE UPDATE ON public.patient_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rx_updated BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto create patient row when signing up as patient
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF (NEW.raw_user_meta_data->>'role') = 'patient' THEN
    INSERT INTO public.patients (user_id, first_name, last_name, email, phone)
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name','Patient'),
      COALESCE(NEW.raw_user_meta_data->>'last_name',''),
      NEW.email,
      NEW.raw_user_meta_data->>'phone'
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Allow patients to read their own row (existing policy only allows staff)
CREATE POLICY "Patient view self" ON public.patients
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Patient update self" ON public.patients
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
