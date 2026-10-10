
DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN ('notify_checkin','notify_lab_status','notify_letter','notify_appointment','notify_prescription','notify_billing','notify_consultation_request','notify_claim','notify_low_stock','emit_hospital_notification','patient_display_name')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END $$;
