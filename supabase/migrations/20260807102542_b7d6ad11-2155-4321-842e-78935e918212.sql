
CREATE TABLE public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  audience text NOT NULL DEFAULT 'patient',
  type text NOT NULL,
  title text NOT NULL,
  message text,
  reference_id uuid,
  reference_type text,
  action_url text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_notifications_user ON public.user_notifications (user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.user_notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users update own notifications" ON public.user_notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own notifications" ON public.user_notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.notification_preferences (
  user_id uuid PRIMARY KEY,
  email_enabled boolean NOT NULL DEFAULT true,
  email_appointments boolean NOT NULL DEFAULT true,
  email_lab_results boolean NOT NULL DEFAULT true,
  email_prescriptions boolean NOT NULL DEFAULT true,
  email_letters boolean NOT NULL DEFAULT true,
  email_billing boolean NOT NULL DEFAULT true,
  language text DEFAULT 'en',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own prefs" ON public.notification_preferences
  FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TRIGGER trg_prefs_updated BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- emitter + lookups
CREATE OR REPLACE FUNCTION public.emit_user_notification(
  _user_id uuid, _audience text, _type text, _title text, _message text,
  _reference_id uuid DEFAULT NULL, _reference_type text DEFAULT NULL, _action_url text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_notifications (user_id, audience, type, title, message, reference_id, reference_type, action_url)
  VALUES (_user_id, _audience, _type, _title, _message, _reference_id, _reference_type, _action_url);
END; $$;

CREATE OR REPLACE FUNCTION public.patient_user_id(_patient_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.patients WHERE id = _patient_id $$;

CREATE OR REPLACE FUNCTION public.doctor_user_id(_doctor_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT user_id FROM public.doctors WHERE id = _doctor_id $$;

-- appointments
CREATE OR REPLACE FUNCTION public.notify_user_appointment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p uuid; d uuid; whenTxt text;
BEGIN
  p := public.patient_user_id(NEW.patient_id);
  d := public.doctor_user_id(NEW.doctor_id);
  whenTxt := NEW.requested_date::text || coalesce(' at ' || to_char(NEW.requested_time,'HH24:MI'),'');
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_user_notification(p,'patient','appointment','Appointment requested',
      'Your appointment request for ' || whenTxt || ' was submitted.', NEW.id,'appointment','/patient/appointments');
    PERFORM public.emit_user_notification(d,'doctor','appointment','New appointment request',
      public.patient_display_name(NEW.patient_id) || ' requested ' || whenTxt, NEW.id,'appointment','/doctor/appointments');
  ELSIF NEW.requested_date IS DISTINCT FROM OLD.requested_date OR NEW.requested_time IS DISTINCT FROM OLD.requested_time THEN
    PERFORM public.emit_user_notification(p,'patient','appointment','Appointment rescheduled',
      'Your appointment moved to ' || whenTxt, NEW.id,'appointment','/patient/appointments');
    PERFORM public.emit_user_notification(d,'doctor','appointment','Appointment rescheduled',
      public.patient_display_name(NEW.patient_id) || ' moved to ' || whenTxt, NEW.id,'appointment','/doctor/appointments');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    PERFORM public.emit_user_notification(p,'patient','appointment','Appointment ' || NEW.status,
      'Your appointment on ' || whenTxt || ' is now ' || NEW.status, NEW.id,'appointment','/patient/appointments');
    PERFORM public.emit_user_notification(d,'doctor','appointment','Appointment ' || NEW.status,
      public.patient_display_name(NEW.patient_id) || '''s appointment is now ' || NEW.status, NEW.id,'appointment','/doctor/appointments');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_user_appointment ON public.patient_appointments;
CREATE TRIGGER trg_notify_user_appointment AFTER INSERT OR UPDATE ON public.patient_appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_user_appointment();

-- lab results
CREATE OR REPLACE FUNCTION public.notify_user_lab() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed' THEN
    PERFORM public.emit_user_notification(public.patient_user_id(NEW.patient_id),'patient','lab','Your lab results are ready',
      'Your lab results have been published. Tap to view.', NEW.id,'lab_result','/patient/lab-results');
    PERFORM public.emit_user_notification(public.doctor_user_id(NEW.ordered_by),'doctor','lab','Lab results ready',
      'Results are ready for ' || public.patient_display_name(NEW.patient_id), NEW.id,'lab_result','/doctor/lab-orders');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_user_lab ON public.lab_results;
CREATE TRIGGER trg_notify_user_lab AFTER UPDATE ON public.lab_results
FOR EACH ROW EXECUTE FUNCTION public.notify_user_lab();

-- letters
CREATE OR REPLACE FUNCTION public.notify_user_letter() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'requested' THEN
    PERFORM public.emit_user_notification(public.doctor_user_id(NEW.doctor_id),'doctor','letter','Letter requested',
      public.patient_display_name(NEW.patient_id) || ' requested: ' || NEW.title, NEW.id,'letter','/doctor/patients');
  ELSIF (TG_OP = 'INSERT' AND NEW.status <> 'requested')
     OR (TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'issued') THEN
    PERFORM public.emit_user_notification(public.patient_user_id(NEW.patient_id),'patient','letter','New document available',
      NEW.title || ' is ready in your Letters & Reports.', NEW.id,'letter','/patient/letters');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_user_letter ON public.patient_letters;
CREATE TRIGGER trg_notify_user_letter AFTER INSERT OR UPDATE ON public.patient_letters
FOR EACH ROW EXECUTE FUNCTION public.notify_user_letter();

-- prescriptions
CREATE OR REPLACE FUNCTION public.notify_user_prescription() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.emit_user_notification(public.patient_user_id(NEW.patient_id),'patient','prescription','New prescription',
    NEW.drug_name || coalesce(' — ' || NEW.dosage,'') || ' was prescribed for you.', NEW.id,'prescription','/patient/prescriptions');
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_user_prescription ON public.prescriptions;
CREATE TRIGGER trg_notify_user_prescription AFTER INSERT ON public.prescriptions
FOR EACH ROW EXECUTE FUNCTION public.notify_user_prescription();

-- billing
CREATE OR REPLACE FUNCTION public.notify_user_billing() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_user_notification(public.patient_user_id(NEW.patient_id),'patient','billing','New bill',
      'A bill of ₦' || NEW.total::text || ' was added to your account.', NEW.id,'billing','/patient/dashboard');
  ELSIF NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NEW.payment_status = 'paid' THEN
    PERFORM public.emit_user_notification(public.patient_user_id(NEW.patient_id),'patient','billing','Payment confirmed',
      'Your payment of ₦' || NEW.total::text || ' was received.', NEW.id,'billing','/patient/dashboard');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_user_billing ON public.hospital_billing;
CREATE TRIGGER trg_notify_user_billing AFTER INSERT OR UPDATE ON public.hospital_billing
FOR EACH ROW EXECUTE FUNCTION public.notify_user_billing();

-- check-in called
CREATE OR REPLACE FUNCTION public.notify_user_checkin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'called' THEN
    PERFORM public.emit_user_notification(public.patient_user_id(NEW.patient_id),'patient','call_in','It''s your turn',
      'Please proceed to the consulting room.', NEW.id,'checkin','/patient/dashboard');
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_notify_user_checkin ON public.patient_checkins;
CREATE TRIGGER trg_notify_user_checkin AFTER UPDATE ON public.patient_checkins
FOR EACH ROW EXECUTE FUNCTION public.notify_user_checkin();

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('emit_user_notification','patient_user_id','doctor_user_id',
      'notify_user_appointment','notify_user_lab','notify_user_letter','notify_user_prescription',
      'notify_user_billing','notify_user_checkin')
  LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig); END LOOP;
END $$;
