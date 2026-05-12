
-- Doctor availability per hospital (hospital_id NULL = global)
CREATE TABLE public.doctor_availability (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id UUID NOT NULL,
  hospital_id UUID,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  is_available BOOLEAN NOT NULL DEFAULT true,
  accepts_virtual BOOLEAN NOT NULL DEFAULT false,
  accepts_in_person BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX doctor_availability_unique
  ON public.doctor_availability (doctor_id, COALESCE(hospital_id, '00000000-0000-0000-0000-000000000000'::uuid), day_of_week);

ALTER TABLE public.doctor_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor manages own availability"
  ON public.doctor_availability FOR ALL TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()))
  WITH CHECK (doctor_id = public.get_user_doctor_id(auth.uid()));

CREATE POLICY "Authenticated can view availability"
  ON public.doctor_availability FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER update_doctor_availability_updated_at
  BEFORE UPDATE ON public.doctor_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Doctor settings (one row per doctor)
CREATE TABLE public.doctor_settings (
  doctor_id UUID NOT NULL PRIMARY KEY,
  availability_mode TEXT NOT NULL DEFAULT 'global' CHECK (availability_mode IN ('global','per_hospital')),
  is_currently_available BOOLEAN NOT NULL DEFAULT true,
  accepts_virtual_global BOOLEAN NOT NULL DEFAULT false,
  virtual_consultation_fee NUMERIC DEFAULT 0,
  notification_prefs JSONB NOT NULL DEFAULT '{"email":true,"sms":false,"in_app":true}'::jsonb,
  language TEXT DEFAULT 'en',
  timezone TEXT DEFAULT 'Africa/Lagos',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.doctor_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Doctor manages own settings"
  ON public.doctor_settings FOR ALL TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()))
  WITH CHECK (doctor_id = public.get_user_doctor_id(auth.uid()));

CREATE POLICY "Authenticated can view doctor settings"
  ON public.doctor_settings FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER update_doctor_settings_updated_at
  BEFORE UPDATE ON public.doctor_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Triage sessions
CREATE TABLE public.triage_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL,
  symptoms JSONB NOT NULL DEFAULT '[]'::jsonb,
  duration TEXT,
  severity_self INTEGER CHECK (severity_self BETWEEN 1 AND 10),
  severity_score INTEGER CHECK (severity_score BETWEEN 1 AND 10),
  recommended_specialty TEXT,
  urgency TEXT CHECK (urgency IN ('routine','soon','urgent','emergency')),
  recommended_hospitals JSONB DEFAULT '[]'::jsonb,
  chosen_hospital_id UUID,
  chosen_doctor_id UUID,
  status TEXT NOT NULL DEFAULT 'completed',
  lat NUMERIC,
  lng NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.triage_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient manages own triage"
  ON public.triage_sessions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));

CREATE POLICY "Hospital staff view triage for their hospital"
  ON public.triage_sessions FOR SELECT TO authenticated
  USING (chosen_hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE TRIGGER update_triage_sessions_updated_at
  BEFORE UPDATE ON public.triage_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Hospital coordinates
ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS lat NUMERIC,
  ADD COLUMN IF NOT EXISTS lng NUMERIC;
