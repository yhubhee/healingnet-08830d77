
-- generic emitter (security definer so app-side inserts are not required)
CREATE OR REPLACE FUNCTION public.emit_hospital_notification(
  _hospital_id uuid, _type text, _title text, _message text,
  _reference_id uuid DEFAULT NULL, _reference_type text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _hospital_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.hospital_notifications (hospital_id, type, title, message, reference_id, reference_type, is_read)
  VALUES (_hospital_id, _type, _title, _message, _reference_id, _reference_type, false);
END; $$;

REVOKE EXECUTE ON FUNCTION public.emit_hospital_notification(uuid,text,text,text,uuid,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.patient_display_name(_patient_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(first_name,'') || ' ' || coalesce(last_name,'') FROM public.patients WHERE id = _patient_id
$$;
REVOKE EXECUTE ON FUNCTION public.patient_display_name(uuid) FROM PUBLIC, anon, authenticated;

-- 1. check-ins
CREATE OR REPLACE FUNCTION public.notify_checkin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_hospital_notification(NEW.hospital_id, 'checkin', 'New patient check-in',
      public.patient_display_name(NEW.patient_id) || ' checked in' ||
      coalesce(' (queue #' || NEW.queue_number || ')',''), NEW.id, 'checkin');
    IF NEW.urgency = 'emergency' THEN
      PERFORM public.emit_hospital_notification(NEW.hospital_id, 'emergency', 'Emergency case',
        public.patient_display_name(NEW.patient_id) || ' arrived as an emergency', NEW.id, 'checkin');
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'called' THEN
    PERFORM public.emit_hospital_notification(NEW.hospital_id, 'call_in', 'Patient called in',
      public.patient_display_name(NEW.patient_id) || ' has been called in', NEW.id, 'checkin');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_checkin ON public.patient_checkins;
CREATE TRIGGER trg_notify_checkin AFTER INSERT OR UPDATE ON public.patient_checkins
FOR EACH ROW EXECUTE FUNCTION public.notify_checkin();

-- 2. lab results ready
CREATE OR REPLACE FUNCTION public.notify_lab_status() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_hospital_notification(NEW.hospital_id, 'lab', 'New lab order',
      'Lab order created for ' || public.patient_display_name(NEW.patient_id), NEW.id, 'lab_result');
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed' THEN
    PERFORM public.emit_hospital_notification(NEW.hospital_id, 'lab', 'Lab results ready',
      'Results are ready for ' || public.patient_display_name(NEW.patient_id), NEW.id, 'lab_result');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_lab_status ON public.lab_results;
CREATE TRIGGER trg_notify_lab_status AFTER INSERT OR UPDATE ON public.lab_results
FOR EACH ROW EXECUTE FUNCTION public.notify_lab_status();

-- 3. letters issued / requested
CREATE OR REPLACE FUNCTION public.notify_letter() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'requested' THEN
      PERFORM public.emit_hospital_notification(NEW.hospital_id, 'consultation', 'Letter requested',
        public.patient_display_name(NEW.patient_id) || ' requested: ' || NEW.title, NEW.id, 'letter');
    ELSE
      PERFORM public.emit_hospital_notification(NEW.hospital_id, 'consultation', 'Document issued',
        NEW.title || ' issued for ' || public.patient_display_name(NEW.patient_id), NEW.id, 'letter');
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'issued' THEN
    PERFORM public.emit_hospital_notification(NEW.hospital_id, 'consultation', 'Document issued',
      NEW.title || ' issued for ' || public.patient_display_name(NEW.patient_id), NEW.id, 'letter');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_letter ON public.patient_letters;
CREATE TRIGGER trg_notify_letter AFTER INSERT OR UPDATE ON public.patient_letters
FOR EACH ROW EXECUTE FUNCTION public.notify_letter();

-- 4. appointments booked / rescheduled / cancelled
CREATE OR REPLACE FUNCTION public.notify_appointment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_hospital_notification(NEW.hospital_id, 'consultation', 'New appointment request',
      public.patient_display_name(NEW.patient_id) || ' requested ' || NEW.requested_date::text ||
      coalesce(' at ' || NEW.requested_time::text,''), NEW.id, 'appointment');
  ELSE
    IF NEW.requested_date IS DISTINCT FROM OLD.requested_date
       OR NEW.requested_time IS DISTINCT FROM OLD.requested_time THEN
      PERFORM public.emit_hospital_notification(NEW.hospital_id, 'consultation', 'Appointment rescheduled',
        public.patient_display_name(NEW.patient_id) || ' moved to ' || NEW.requested_date::text ||
        coalesce(' at ' || NEW.requested_time::text,''), NEW.id, 'appointment');
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      PERFORM public.emit_hospital_notification(NEW.hospital_id, 'consultation',
        'Appointment ' || NEW.status,
        public.patient_display_name(NEW.patient_id) || '''s appointment is now ' || NEW.status, NEW.id, 'appointment');
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_appointment ON public.patient_appointments;
CREATE TRIGGER trg_notify_appointment AFTER INSERT OR UPDATE ON public.patient_appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_appointment();

-- 5. prescriptions
CREATE OR REPLACE FUNCTION public.notify_prescription() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.emit_hospital_notification(NEW.hospital_id, 'pharmacy', 'New prescription',
    NEW.drug_name || ' prescribed for ' || public.patient_display_name(NEW.patient_id), NEW.id, 'prescription');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_prescription ON public.prescriptions;
CREATE TRIGGER trg_notify_prescription AFTER INSERT ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION public.notify_prescription();

-- 6. billing
CREATE OR REPLACE FUNCTION public.notify_billing() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_hospital_notification(NEW.hospital_id, 'billing', 'New bill created',
      '₦' || NEW.total::text || ' billed to ' || public.patient_display_name(NEW.patient_id), NEW.id, 'billing');
  ELSIF NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NEW.payment_status = 'paid' THEN
    PERFORM public.emit_hospital_notification(NEW.hospital_id, 'billing', 'Payment received',
      '₦' || NEW.total::text || ' paid by ' || public.patient_display_name(NEW.patient_id), NEW.id, 'billing');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_billing ON public.hospital_billing;
CREATE TRIGGER trg_notify_billing AFTER INSERT OR UPDATE ON public.hospital_billing
FOR EACH ROW EXECUTE FUNCTION public.notify_billing();

-- 7. consultation requests
CREATE OR REPLACE FUNCTION public.notify_consultation_request() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_hospital_notification(NEW.requesting_hospital_id, 'consultation', 'Consultation requested',
      'Specialist consult requested for ' || public.patient_display_name(NEW.patient_id), NEW.id, 'consultation');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.emit_hospital_notification(NEW.requesting_hospital_id, 'consultation',
      'Consultation ' || NEW.status,
      'Consult for ' || public.patient_display_name(NEW.patient_id) || ' is now ' || NEW.status, NEW.id, 'consultation');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_consultation_request ON public.consultation_requests;
CREATE TRIGGER trg_notify_consultation_request AFTER INSERT OR UPDATE ON public.consultation_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_consultation_request();

-- 8. insurance claims
CREATE OR REPLACE FUNCTION public.notify_claim() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_hospital_notification(NEW.hospital_id, 'billing', 'Insurance claim filed',
      NEW.insurance_provider || ' claim of ₦' || NEW.claim_amount::text || ' filed', NEW.id, 'claim');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.emit_hospital_notification(NEW.hospital_id, 'billing', 'Claim ' || NEW.status,
      NEW.insurance_provider || ' claim is now ' || NEW.status, NEW.id, 'claim');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_claim ON public.insurance_claims;
CREATE TRIGGER trg_notify_claim AFTER INSERT OR UPDATE ON public.insurance_claims
FOR EACH ROW EXECUTE FUNCTION public.notify_claim();

-- 9. low pharmacy stock
CREATE OR REPLACE FUNCTION public.notify_low_stock() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reorder_level IS NOT NULL AND NEW.quantity_in_stock IS NOT NULL
     AND NEW.quantity_in_stock <= NEW.reorder_level
     AND (TG_OP = 'INSERT' OR OLD.quantity_in_stock > OLD.reorder_level
          OR OLD.quantity_in_stock IS DISTINCT FROM NEW.quantity_in_stock AND OLD.quantity_in_stock > NEW.quantity_in_stock AND OLD.quantity_in_stock > coalesce(OLD.reorder_level,0)) THEN
    PERFORM public.emit_hospital_notification(NEW.hospital_id, 'pharmacy', 'Low stock alert',
      NEW.drug_name || ' is down to ' || NEW.quantity_in_stock::text || ' units', NEW.id, 'inventory');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_low_stock ON public.pharmacy_inventory;
CREATE TRIGGER trg_notify_low_stock AFTER INSERT OR UPDATE OF quantity_in_stock, reorder_level ON public.pharmacy_inventory
FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();
