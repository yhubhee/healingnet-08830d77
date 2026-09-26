-- Consultation workspace, Phase 1 (additive, idempotent)
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS public.consultations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  doctor_id uuid NOT NULL REFERENCES public.doctors(id),
  appointment_id uuid REFERENCES public.patient_appointments(id),
  checkin_id uuid REFERENCES public.patient_checkins(id),
  mode text NOT NULL DEFAULT 'in_person' CHECK (mode IN ('in_person','telemedicine')),
  started_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz,
  provisional_diagnosis text,
  final_diagnosis text,
  advice_plan text,
  follow_up_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS consultations_open_checkin_uq ON public.consultations(checkin_id) WHERE checkin_id IS NOT NULL AND submitted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS consultations_open_appt_uq ON public.consultations(appointment_id) WHERE appointment_id IS NOT NULL AND submitted_at IS NULL;
CREATE INDEX IF NOT EXISTS consultations_patient_idx ON public.consultations(patient_id);
DROP TRIGGER IF EXISTS trg_consultations_updated ON public.consultations;
CREATE TRIGGER trg_consultations_updated BEFORE UPDATE ON public.consultations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.consultation_history (
  consultation_id uuid PRIMARY KEY REFERENCES public.consultations(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  chief_complaints jsonb NOT NULL DEFAULT '[]'::jsonb,
  history_of_presenting_complaint text, past_medical_history text, past_surgical_history text,
  drug_history text, allergies text, family_history text, social_history text,
  lmp date, edd date, obstetric_notes text, review_of_systems text,
  recorded_by uuid, recorded_by_role text, updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.consultation_examinations (
  consultation_id uuid PRIMARY KEY REFERENCES public.consultations(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  bp_systolic int, bp_diastolic int, pulse_rate int, respiratory_rate int,
  temperature_c numeric(4,1), spo2 int, weight_kg numeric(5,1), height_cm numeric(5,1), rbs_mmol_l numeric(5,1),
  general_examination text, systemic_examination text, other_findings text,
  recorded_by uuid, recorded_by_role text, updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.diagnostic_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid REFERENCES public.hospitals(id),
  kind text NOT NULL CHECK (kind IN ('imaging','other')),
  section text NOT NULL,
  name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  allowed_views text[] NOT NULL DEFAULT '{}',
  has_laterality boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS diagnostic_catalog_uq ON public.diagnostic_catalog(coalesce(hospital_id,'00000000-0000-0000-0000-000000000000'::uuid), lower(name), section);

CREATE TABLE IF NOT EXISTS public.diagnostic_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  consultation_id uuid REFERENCES public.consultations(id),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  ordered_by uuid REFERENCES public.doctors(id),
  catalog_item_id uuid REFERENCES public.diagnostic_catalog(id),
  item_name text NOT NULL,
  kind text NOT NULL DEFAULT 'imaging' CHECK (kind IN ('imaging','other','lab')),
  section text,
  views text[] NOT NULL DEFAULT '{}',
  laterality text CHECK (laterality IN ('left','right','bilateral')),
  other_view text,
  priority text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat')),
  fasting boolean NOT NULL DEFAULT false,
  clinical_info text,
  bill_to text CHECK (bill_to IN ('patient','hmo','company','hospital')),
  destination text NOT NULL DEFAULT 'in_house' CHECK (destination IN ('in_house','external')),
  external_facility text,
  ordered_at timestamptz NOT NULL DEFAULT now(),
  performed_at timestamptz, reported_at timestamptz, cancelled_at timestamptz,
  report_text text, report_file_path text, reported_by uuid
);
CREATE INDEX IF NOT EXISTS diagnostic_requests_consult_idx ON public.diagnostic_requests(consultation_id);

CREATE TABLE IF NOT EXISTS public.consultation_treatment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  consultation_id uuid NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  line_no int NOT NULL DEFAULT 1,
  kind text NOT NULL DEFAULT 'drug' CHECK (kind IN ('drug','procedure','other')),
  inventory_item_id uuid REFERENCES public.pharmacy_inventory(id),
  drug_name text NOT NULL,
  strength text, dose text, route text, frequency text,
  duration_value int, duration_unit text, quantity int, instructions text,
  give_in_clinic boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cti_consult_idx ON public.consultation_treatment_items(consultation_id);

CREATE TABLE IF NOT EXISTS public.consultation_addenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  consultation_id uuid NOT NULL REFERENCES public.consultations(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Additive columns on existing tables
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS consultation_id uuid REFERENCES public.consultations(id);
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS clinical_info text;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS priority text;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS fasting boolean;
ALTER TABLE public.lab_results ADD COLUMN IF NOT EXISTS bill_to text;
ALTER TABLE public.prescriptions ADD COLUMN IF NOT EXISTS consultation_id uuid REFERENCES public.consultations(id);

-- Helpers (private schema, security definer, no recursion)
CREATE OR REPLACE FUNCTION private.consultation_access(_cid uuid, _uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- returns 'owner' | 'staff' | 'doctor_read' | 'patient' | null
  SELECT CASE
    WHEN c.doctor_id = public.get_user_doctor_id(_uid) THEN 'owner'
    WHEN public.is_hospital_staff(_uid, c.hospital_id) THEN 'staff'
    WHEN public.get_user_doctor_id(_uid) IS NOT NULL
         AND public.is_doctor_at_hospital(public.get_user_doctor_id(_uid), c.hospital_id)
         AND public.can_doctor_access_patient(public.get_user_doctor_id(_uid), c.patient_id) THEN 'doctor_read'
    WHEN c.submitted_at IS NOT NULL AND EXISTS (SELECT 1 FROM public.patients p WHERE p.id = c.patient_id AND p.user_id = _uid) THEN 'patient'
  END FROM public.consultations c WHERE c.id = _cid $$;

CREATE OR REPLACE FUNCTION private.consultation_is_open(_cid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.consultations WHERE id = _cid AND submitted_at IS NULL) $$;

GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION private.consultation_access(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.consultation_is_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.consultation_access(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.consultation_is_open(uuid) TO authenticated;

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.consultations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultation_history, public.consultation_examinations, public.consultation_treatment_items TO authenticated;
GRANT SELECT, INSERT ON public.consultation_addenda TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.diagnostic_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.diagnostic_catalog TO authenticated;
GRANT ALL ON public.consultations, public.consultation_history, public.consultation_examinations, public.consultation_treatment_items, public.consultation_addenda, public.diagnostic_requests, public.diagnostic_catalog TO service_role;

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_examinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_treatment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_addenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_catalog ENABLE ROW LEVEL SECURITY;

-- consultations
DROP POLICY IF EXISTS "consult select" ON public.consultations;
CREATE POLICY "consult select" ON public.consultations FOR SELECT TO authenticated
  USING (private.consultation_access(id, auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS "consult insert" ON public.consultations;
CREATE POLICY "consult insert" ON public.consultations FOR INSERT TO authenticated
  WITH CHECK (doctor_id = public.get_user_doctor_id(auth.uid()) AND public.is_doctor_at_hospital(doctor_id, hospital_id) AND submitted_at IS NULL);
DROP POLICY IF EXISTS "consult update" ON public.consultations;
CREATE POLICY "consult update" ON public.consultations FOR UPDATE TO authenticated
  USING (doctor_id = public.get_user_doctor_id(auth.uid()) AND submitted_at IS NULL)
  WITH CHECK (doctor_id = public.get_user_doctor_id(auth.uid()) AND submitted_at IS NULL);

-- history / examination: owner + hospital staff while open
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['consultation_history','consultation_examinations'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "sel" ON public.%I', t);
    EXECUTE format('CREATE POLICY "sel" ON public.%I FOR SELECT TO authenticated USING (private.consultation_access(consultation_id, auth.uid()) IS NOT NULL)', t);
    EXECUTE format('DROP POLICY IF EXISTS "ins" ON public.%I', t);
    EXECUTE format('CREATE POLICY "ins" ON public.%I FOR INSERT TO authenticated WITH CHECK (private.consultation_access(consultation_id, auth.uid()) IN (''owner'',''staff'') AND private.consultation_is_open(consultation_id) AND hospital_id = (SELECT hospital_id FROM public.consultations WHERE id = consultation_id))', t);
    EXECUTE format('DROP POLICY IF EXISTS "upd" ON public.%I', t);
    EXECUTE format('CREATE POLICY "upd" ON public.%I FOR UPDATE TO authenticated USING (private.consultation_access(consultation_id, auth.uid()) IN (''owner'',''staff'') AND private.consultation_is_open(consultation_id)) WITH CHECK (private.consultation_is_open(consultation_id))', t);
  END LOOP; END $$;

-- treatment items: owner only while open
DROP POLICY IF EXISTS "sel" ON public.consultation_treatment_items;
CREATE POLICY "sel" ON public.consultation_treatment_items FOR SELECT TO authenticated USING (private.consultation_access(consultation_id, auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS "ins" ON public.consultation_treatment_items;
CREATE POLICY "ins" ON public.consultation_treatment_items FOR INSERT TO authenticated WITH CHECK (private.consultation_access(consultation_id, auth.uid()) = 'owner' AND private.consultation_is_open(consultation_id) AND hospital_id = (SELECT hospital_id FROM public.consultations WHERE id = consultation_id));
DROP POLICY IF EXISTS "upd" ON public.consultation_treatment_items;
CREATE POLICY "upd" ON public.consultation_treatment_items FOR UPDATE TO authenticated USING (private.consultation_access(consultation_id, auth.uid()) = 'owner' AND private.consultation_is_open(consultation_id)) WITH CHECK (private.consultation_is_open(consultation_id));
DROP POLICY IF EXISTS "del" ON public.consultation_treatment_items;
CREATE POLICY "del" ON public.consultation_treatment_items FOR DELETE TO authenticated USING (private.consultation_access(consultation_id, auth.uid()) = 'owner' AND private.consultation_is_open(consultation_id));

-- addenda: append-only
DROP POLICY IF EXISTS "sel" ON public.consultation_addenda;
CREATE POLICY "sel" ON public.consultation_addenda FOR SELECT TO authenticated USING (private.consultation_access(consultation_id, auth.uid()) IS NOT NULL);
DROP POLICY IF EXISTS "ins" ON public.consultation_addenda;
CREATE POLICY "ins" ON public.consultation_addenda FOR INSERT TO authenticated WITH CHECK (author_id = auth.uid() AND private.consultation_access(consultation_id, auth.uid()) IN ('owner','staff') AND NOT private.consultation_is_open(consultation_id) AND hospital_id = (SELECT hospital_id FROM public.consultations WHERE id = consultation_id));

-- diagnostic requests
DROP POLICY IF EXISTS "sel" ON public.diagnostic_requests;
CREATE POLICY "sel" ON public.diagnostic_requests FOR SELECT TO authenticated USING (
  public.is_hospital_staff(auth.uid(), hospital_id)
  OR public.is_doctor_at_hospital(public.get_user_doctor_id(auth.uid()), hospital_id)
  OR EXISTS (SELECT 1 FROM public.patients p WHERE p.id = patient_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "ins" ON public.diagnostic_requests;
CREATE POLICY "ins" ON public.diagnostic_requests FOR INSERT TO authenticated WITH CHECK (
  ordered_by = public.get_user_doctor_id(auth.uid()) AND public.is_doctor_at_hospital(ordered_by, hospital_id)
  AND (consultation_id IS NULL OR hospital_id = (SELECT hospital_id FROM public.consultations WHERE id = consultation_id)));
DROP POLICY IF EXISTS "upd" ON public.diagnostic_requests;
CREATE POLICY "upd" ON public.diagnostic_requests FOR UPDATE TO authenticated
  USING (public.is_hospital_staff(auth.uid(), hospital_id) OR ordered_by = public.get_user_doctor_id(auth.uid()))
  WITH CHECK (public.is_hospital_staff(auth.uid(), hospital_id) OR ordered_by = public.get_user_doctor_id(auth.uid()));

-- diagnostic catalog: global rows readable by all signed-in users; hospital rows by that hospital
DROP POLICY IF EXISTS "sel" ON public.diagnostic_catalog;
CREATE POLICY "sel" ON public.diagnostic_catalog FOR SELECT TO authenticated USING (
  hospital_id IS NULL OR public.is_hospital_staff(auth.uid(), hospital_id) OR public.is_doctor_at_hospital(public.get_user_doctor_id(auth.uid()), hospital_id));
DROP POLICY IF EXISTS "ins" ON public.diagnostic_catalog;
CREATE POLICY "ins" ON public.diagnostic_catalog FOR INSERT TO authenticated WITH CHECK (hospital_id IS NOT NULL AND public.is_hospital_admin(auth.uid(), hospital_id));
DROP POLICY IF EXISTS "upd" ON public.diagnostic_catalog;
CREATE POLICY "upd" ON public.diagnostic_catalog FOR UPDATE TO authenticated USING (hospital_id IS NOT NULL AND public.is_hospital_admin(auth.uid(), hospital_id)) WITH CHECK (hospital_id IS NOT NULL AND public.is_hospital_admin(auth.uid(), hospital_id));

-- RPC: start (idempotent)
CREATE OR REPLACE FUNCTION public.start_consultation(p_patient_id uuid, p_checkin_id uuid DEFAULT NULL, p_appointment_id uuid DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d uuid; h uuid; cid uuid; m text := 'in_person';
BEGIN
  d := public.get_user_doctor_id(auth.uid());
  IF d IS NULL THEN RAISE EXCEPTION 'Only doctors can start a consultation'; END IF;
  IF p_checkin_id IS NOT NULL THEN
    SELECT id INTO cid FROM consultations WHERE checkin_id = p_checkin_id AND submitted_at IS NULL;
    SELECT hospital_id INTO h FROM patient_checkins WHERE id = p_checkin_id;
  ELSIF p_appointment_id IS NOT NULL THEN
    SELECT id INTO cid FROM consultations WHERE appointment_id = p_appointment_id AND submitted_at IS NULL;
    SELECT hospital_id, CASE WHEN is_telemedicine THEN 'telemedicine' ELSE 'in_person' END INTO h, m FROM patient_appointments WHERE id = p_appointment_id;
  ELSE
    h := public.get_doctor_hospital_id(d);
  END IF;
  IF cid IS NOT NULL THEN RETURN cid; END IF;
  IF h IS NULL OR NOT public.is_doctor_at_hospital(d, h) THEN RAISE EXCEPTION 'You are not attached to this hospital'; END IF;
  IF coalesce(public.get_hospital_plan(h),'none') = 'none' THEN RAISE EXCEPTION 'Hospital plan does not include consultations'; END IF;
  INSERT INTO consultations(hospital_id, patient_id, doctor_id, checkin_id, appointment_id, mode)
    VALUES (h, p_patient_id, d, p_checkin_id, p_appointment_id, m) RETURNING id INTO cid;
  RETURN cid;
EXCEPTION WHEN unique_violation THEN
  SELECT id INTO cid FROM consultations WHERE submitted_at IS NULL AND (checkin_id = p_checkin_id OR appointment_id = p_appointment_id) LIMIT 1;
  RETURN cid;
END $$;

-- RPC: submit (single transaction)
CREATE OR REPLACE FUNCTION public.submit_consultation(p_consultation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c consultations%ROWTYPE; n_rx int := 0; n_lab int; n_dx int;
BEGIN
  SELECT * INTO c FROM consultations WHERE id = p_consultation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Consultation not found'; END IF;
  IF c.doctor_id IS DISTINCT FROM public.get_user_doctor_id(auth.uid()) THEN RAISE EXCEPTION 'Not your consultation'; END IF;
  IF c.submitted_at IS NOT NULL THEN RAISE EXCEPTION 'Consultation already submitted'; END IF;
  IF coalesce(trim(c.provisional_diagnosis),'') = '' THEN RAISE EXCEPTION 'Provisional diagnosis is required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM consultation_history WHERE consultation_id = c.id AND jsonb_array_length(chief_complaints) > 0) THEN
    RAISE EXCEPTION 'At least one chief complaint is required'; END IF;

  INSERT INTO prescriptions(patient_id, hospital_id, doctor_id, drug_name, dosage, frequency, duration, instructions, status, consultation_id)
  SELECT c.patient_id, c.hospital_id, c.doctor_id,
         trim(coalesce(t.route || ' ','') || t.drug_name || coalesce(' ' || t.strength,'')),
         t.dose, t.frequency,
         CASE WHEN t.duration_value IS NOT NULL THEN t.duration_value::text || ' ' || coalesce(t.duration_unit,'days') END,
         concat_ws(' | ', t.instructions, CASE WHEN t.quantity IS NOT NULL THEN 'Qty: ' || t.quantity END, CASE WHEN t.give_in_clinic THEN 'Give in clinic' END),
         'active', c.id
  FROM consultation_treatment_items t WHERE t.consultation_id = c.id AND t.kind = 'drug' ORDER BY t.line_no;
  GET DIAGNOSTICS n_rx = ROW_COUNT;

  UPDATE consultations SET submitted_at = now() WHERE id = c.id;
  IF c.checkin_id IS NOT NULL THEN
    UPDATE patient_checkins SET status = 'completed', consultation_end = now() WHERE id = c.checkin_id;
  END IF;
  SELECT count(*) INTO n_lab FROM lab_results WHERE consultation_id = c.id;
  SELECT count(*) INTO n_dx FROM diagnostic_requests WHERE consultation_id = c.id AND cancelled_at IS NULL;
  RETURN jsonb_build_object('consultation_id', c.id, 'prescriptions', n_rx, 'lab_orders', n_lab, 'diagnostic_requests', n_dx, 'follow_up_date', c.follow_up_date);
END $$;

REVOKE ALL ON FUNCTION public.start_consultation(uuid,uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_consultation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_consultation(uuid,uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_consultation(uuid) TO authenticated;

-- Realtime (guarded)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='diagnostic_requests') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.diagnostic_requests; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='lab_result_tests') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.lab_result_tests; END IF;
  END IF;
END $$;