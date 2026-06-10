CREATE TABLE public.patient_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE SET NULL,
  letter_type text NOT NULL CHECK (letter_type IN ('fit_to_work','pregnancy_maternity','sick_leave','excuse_of_duty','vaccination_record')),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  issued_at date NOT NULL DEFAULT CURRENT_DATE,
  valid_until date,
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','pending','expired')),
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_letters TO authenticated;
GRANT ALL ON public.patient_letters TO service_role;

ALTER TABLE public.patient_letters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own letters" ON public.patient_letters
  FOR SELECT TO authenticated
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Issuing doctor manages letters" ON public.patient_letters
  FOR ALL TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()))
  WITH CHECK (doctor_id = public.get_user_doctor_id(auth.uid()));

CREATE POLICY "Hospital staff manage letters" ON public.patient_letters
  FOR ALL TO authenticated
  USING (hospital_id IS NOT NULL AND public.is_hospital_staff(auth.uid(), hospital_id))
  WITH CHECK (hospital_id IS NOT NULL AND public.is_hospital_staff(auth.uid(), hospital_id));

CREATE TRIGGER update_patient_letters_updated_at
  BEFORE UPDATE ON public.patient_letters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_patient_letters_patient ON public.patient_letters(patient_id, issued_at DESC);
CREATE INDEX idx_patient_letters_doctor ON public.patient_letters(doctor_id);