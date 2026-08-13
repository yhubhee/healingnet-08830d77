CREATE OR REPLACE FUNCTION public.notify_user_billing()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.emit_user_notification(public.patient_user_id(NEW.patient_id),'patient','billing','New bill',
      'A bill of ₦' || NEW.total::text || ' was added to your account.', NEW.id,'billing','/patient');
  ELSIF NEW.payment_status IS DISTINCT FROM OLD.payment_status AND NEW.payment_status = 'paid' THEN
    PERFORM public.emit_user_notification(public.patient_user_id(NEW.patient_id),'patient','billing','Payment confirmed',
      'Your payment of ₦' || NEW.total::text || ' was received.', NEW.id,'billing','/patient');
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_user_checkin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'called' THEN
    PERFORM public.emit_user_notification(public.patient_user_id(NEW.patient_id),'patient','call_in','It''s your turn',
      'Please proceed to the consulting room.', NEW.id,'checkin','/patient');
  END IF;
  RETURN NEW;
END; $function$;

UPDATE public.user_notifications SET action_url = '/patient' WHERE action_url = '/patient/dashboard';