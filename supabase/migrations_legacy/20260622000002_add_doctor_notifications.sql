-- Create function to notify hospital admins when doctor is added
CREATE OR REPLACE FUNCTION public.notify_doctor_added()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.hospital_notifications (
    hospital_id,
    type,
    title,
    message,
    reference_id,
    reference_type
  ) VALUES (
    NEW.hospital_id,
    'system',
    'Doctor Added',
    'Dr. ' || (SELECT first_name || ' ' || last_name FROM public.doctors WHERE id = NEW.doctor_id) ||
    ' has been added as ' || NEW.employment_type || ' at your hospital.',
    NEW.id,
    'hospital_doctors'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create function to notify hospital admins when doctor is removed
CREATE OR REPLACE FUNCTION public.notify_doctor_removed()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.hospital_notifications (
    hospital_id,
    type,
    title,
    message,
    reference_id,
    reference_type
  ) VALUES (
    OLD.hospital_id,
    'system',
    'Doctor Removed',
    'Dr. ' || (SELECT first_name || ' ' || last_name FROM public.doctors WHERE id = OLD.doctor_id) ||
    ' has been removed from your hospital.',
    OLD.id,
    'hospital_doctors'
  );
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create function to notify hospital admins when doctor info is updated
CREATE OR REPLACE FUNCTION public.notify_doctor_updated()
RETURNS TRIGGER AS $$
DECLARE
  changes TEXT := '';
BEGIN
  IF NEW.employment_type != OLD.employment_type THEN
    changes := changes || 'Employment Type: ' || OLD.employment_type || ' → ' || NEW.employment_type || '; ';
  END IF;
  IF NEW.department != OLD.department THEN
    changes := changes || 'Department: ' || COALESCE(OLD.department, 'N/A') || ' → ' || COALESCE(NEW.department, 'N/A') || '; ';
  END IF;
  IF NEW.salary != OLD.salary THEN
    changes := changes || 'Salary: ₦' || COALESCE(OLD.salary::TEXT, 'N/A') || ' → ₦' || COALESCE(NEW.salary::TEXT, 'N/A') || '; ';
  END IF;
  IF NEW.commission_rate != OLD.commission_rate THEN
    changes := changes || 'Commission: ' || COALESCE(OLD.commission_rate::TEXT, 'N/A') || '% → ' || COALESCE(NEW.commission_rate::TEXT, 'N/A') || '%';
  END IF;

  IF changes != '' THEN
    INSERT INTO public.hospital_notifications (
      hospital_id,
      type,
      title,
      message,
      reference_id,
      reference_type
    ) VALUES (
      NEW.hospital_id,
      'system',
      'Doctor Info Updated',
      'Dr. ' || (SELECT first_name || ' ' || last_name FROM public.doctors WHERE id = NEW.doctor_id) ||
      ' information updated: ' || changes,
      NEW.id,
      'hospital_doctors'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS doctor_added_notification ON public.hospital_doctors;
DROP TRIGGER IF EXISTS doctor_removed_notification ON public.hospital_doctors;
DROP TRIGGER IF EXISTS doctor_updated_notification ON public.hospital_doctors;

-- Create triggers
CREATE TRIGGER doctor_added_notification
AFTER INSERT ON public.hospital_doctors
FOR EACH ROW EXECUTE FUNCTION public.notify_doctor_added();

CREATE TRIGGER doctor_removed_notification
AFTER DELETE ON public.hospital_doctors
FOR EACH ROW EXECUTE FUNCTION public.notify_doctor_removed();

CREATE TRIGGER doctor_updated_notification
AFTER UPDATE ON public.hospital_doctors
FOR EACH ROW WHEN (NEW.is_active = OLD.is_active) -- Only notify on field changes, not soft deletes
EXECUTE FUNCTION public.notify_doctor_updated();
