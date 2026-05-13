
-- 1) RPC to create hospital + admin staff + subscription atomically
CREATE OR REPLACE FUNCTION public.create_hospital_with_admin(
  _name text,
  _address text,
  _phone text,
  _email text,
  _first_name text,
  _last_name text,
  _plan text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _hid uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.hospitals (name, address, phone, email)
  VALUES (_name, _address, _phone, _email)
  RETURNING id INTO _hid;

  INSERT INTO public.hospital_staff (user_id, hospital_id, first_name, last_name, email, role, is_active)
  VALUES (_uid, _hid, _first_name, _last_name, _email, 'admin', true);

  INSERT INTO public.hospital_subscriptions (hospital_id, plan, status, billing_cycle)
  VALUES (_hid, COALESCE(_plan, 'emr'), 'active', 'monthly');

  RETURN _hid;
END;
$$;

-- 2) Update handle_new_user to auto-approve doctor verification (testing mode)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.raw_user_meta_data->>'role') = 'patient' THEN
    INSERT INTO public.patients (user_id, first_name, last_name, email, phone)
    VALUES (NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name','Patient'),
      COALESCE(NEW.raw_user_meta_data->>'last_name',''),
      NEW.email,
      NEW.raw_user_meta_data->>'phone');
  ELSIF (NEW.raw_user_meta_data->>'role') = 'doctor' THEN
    INSERT INTO public.doctors (user_id, first_name, last_name, email, phone, specialty, verification_status, verification_reviewed_at)
    VALUES (NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'first_name','Doctor'),
      COALESCE(NEW.raw_user_meta_data->>'last_name',''),
      NEW.email,
      NEW.raw_user_meta_data->>'phone',
      NEW.raw_user_meta_data->>'specialty',
      'approved',
      now());
  END IF;
  RETURN NEW;
END;
$$;

-- 3) Auto-approve any existing unverified doctor accounts (testing)
UPDATE public.doctors
SET verification_status = 'approved', verification_reviewed_at = now()
WHERE verification_status <> 'approved';
