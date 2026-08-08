CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid REFERENCES public.hospitals(id),
  patient_id uuid REFERENCES public.patients(id),
  purpose text NOT NULL CHECK (purpose IN ('billing','pharmacy','consultation')),
  reference_id uuid,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'NGN',
  email text,
  paystack_reference text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','success','failed','abandoned')),
  channel text,
  authorization_url text,
  paid_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view their own payments"
ON public.payments FOR SELECT TO authenticated
USING (patient_id IS NOT NULL AND public.patient_user_id(patient_id) = auth.uid());

CREATE POLICY "Hospital staff view hospital payments"
ON public.payments FOR SELECT TO authenticated
USING (hospital_id IS NOT NULL AND public.is_hospital_staff(auth.uid(), hospital_id));

CREATE POLICY "Hospital staff create hospital payments"
ON public.payments FOR INSERT TO authenticated
WITH CHECK (hospital_id IS NOT NULL AND public.is_hospital_staff(auth.uid(), hospital_id));

CREATE POLICY "Hospital staff update hospital payments"
ON public.payments FOR UPDATE TO authenticated
USING (hospital_id IS NOT NULL AND public.is_hospital_staff(auth.uid(), hospital_id))
WITH CHECK (hospital_id IS NOT NULL AND public.is_hospital_staff(auth.uid(), hospital_id));

CREATE INDEX idx_payments_hospital ON public.payments(hospital_id);
CREATE INDEX idx_payments_patient ON public.payments(patient_id);
CREATE INDEX idx_payments_ref ON public.payments(reference_id);

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();