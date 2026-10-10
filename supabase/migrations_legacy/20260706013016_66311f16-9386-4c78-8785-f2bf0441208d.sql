
-- =========================================================
-- 1) Fix SECURITY DEFINER view
-- =========================================================
ALTER VIEW public.my_doctor_profile SET (security_invoker = true);

-- =========================================================
-- 2) Scope the doctor-credentials storage admin policy
-- =========================================================
DROP POLICY IF EXISTS "Hospital admins view all credentials" ON storage.objects;

CREATE POLICY "Hospital admins view own hospital credentials"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'doctor-credentials'
  AND EXISTS (
    SELECT 1
    FROM public.hospital_staff hs
    JOIN public.doctors d
      ON d.user_id = NULLIF((storage.foldername(name))[1], '')::uuid
    JOIN public.hospital_doctors hd
      ON hd.doctor_id = d.id
     AND hd.hospital_id = hs.hospital_id
    WHERE hs.user_id = auth.uid()
      AND hs.role = 'admin'
      AND hs.is_active = true
      AND COALESCE(hd.is_active, true) = true
      AND COALESCE(hd.status, 'active') <> 'rejected'
  )
);

-- =========================================================
-- 3) Move SECURITY DEFINER helpers into `private` schema.
--    Keep public functions as SECURITY INVOKER wrappers so
--    RLS policies and client RPC calls keep working, but
--    the exposed API no longer holds SECURITY DEFINER
--    functions.
-- =========================================================
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- ---- private.get_doctor_hospital_ids ----
CREATE OR REPLACE FUNCTION private.get_doctor_hospital_ids(_doctor_id uuid)
RETURNS TABLE(hospital_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT hd.hospital_id
  FROM public.hospital_doctors hd
  WHERE hd.doctor_id = _doctor_id
    AND COALESCE(hd.is_active, true) = true
    AND COALESCE(hd.status, 'active') <> 'rejected'
  ORDER BY hd.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.get_doctor_hospital_ids(_doctor_id uuid)
RETURNS TABLE(hospital_id uuid)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT * FROM private.get_doctor_hospital_ids(_doctor_id) $$;

-- ---- private.is_doctor_at_hospital ----
CREATE OR REPLACE FUNCTION private.is_doctor_at_hospital(_doctor_id uuid, _hospital_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hospital_doctors hd
    WHERE hd.doctor_id = _doctor_id
      AND hd.hospital_id = _hospital_id
      AND COALESCE(hd.is_active, true) = true
      AND COALESCE(hd.status, 'active') <> 'rejected'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_doctor_at_hospital(_doctor_id uuid, _hospital_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.is_doctor_at_hospital(_doctor_id, _hospital_id) $$;

-- ---- private.get_doctor_hospital_id ----
CREATE OR REPLACE FUNCTION private.get_doctor_hospital_id(_doctor_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT hd.hospital_id
  FROM public.hospital_doctors hd
  WHERE hd.doctor_id = _doctor_id
    AND COALESCE(hd.is_active, true) = true
    AND COALESCE(hd.status, 'active') <> 'rejected'
  ORDER BY hd.created_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_doctor_hospital_id(_doctor_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.get_doctor_hospital_id(_doctor_id) $$;

-- ---- private.is_hospital_admin ----
CREATE OR REPLACE FUNCTION private.is_hospital_admin(_user_id uuid, _hospital_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hospital_staff
    WHERE user_id = _user_id AND hospital_id = _hospital_id
      AND role = 'admin' AND is_active = TRUE
  )
$$;

CREATE OR REPLACE FUNCTION public.is_hospital_admin(_user_id uuid, _hospital_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.is_hospital_admin(_user_id, _hospital_id) $$;

-- ---- private.can_doctor_access_patient ----
CREATE OR REPLACE FUNCTION private.can_doctor_access_patient(_doctor_id uuid, _patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _doctor_id IS NOT NULL AND _patient_id IS NOT NULL
     AND (
      EXISTS (SELECT 1 FROM public.patient_appointments pa
              WHERE pa.patient_id = _patient_id
                AND (pa.doctor_id = _doctor_id
                     OR private.is_doctor_at_hospital(_doctor_id, pa.hospital_id)))
      OR EXISTS (SELECT 1 FROM public.prescriptions pr
                 WHERE pr.patient_id = _patient_id
                   AND (pr.doctor_id = _doctor_id
                        OR private.is_doctor_at_hospital(_doctor_id, pr.hospital_id)))
      OR EXISTS (SELECT 1 FROM public.lab_results lr
                 WHERE lr.patient_id = _patient_id
                   AND (lr.ordered_by = _doctor_id
                        OR private.is_doctor_at_hospital(_doctor_id, lr.hospital_id)))
      OR EXISTS (SELECT 1 FROM public.patient_checkins pc
                 WHERE pc.patient_id = _patient_id
                   AND (pc.assigned_doctor_id = _doctor_id
                        OR private.is_doctor_at_hospital(_doctor_id, pc.hospital_id)))
     )
$$;

CREATE OR REPLACE FUNCTION public.can_doctor_access_patient(_doctor_id uuid, _patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.can_doctor_access_patient(_doctor_id, _patient_id) $$;

-- ---- private.get_hospital_plan ----
CREATE OR REPLACE FUNCTION private.get_hospital_plan(_hospital_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT plan FROM public.hospital_subscriptions
  WHERE hospital_id = _hospital_id AND status = 'active'
  ORDER BY started_at DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_hospital_plan(_hospital_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.get_hospital_plan(_hospital_id) $$;

-- ---- private.is_hospital_staff ----
CREATE OR REPLACE FUNCTION private.is_hospital_staff(_user_id uuid, _hospital_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hospital_staff
    WHERE user_id = _user_id AND hospital_id = _hospital_id AND is_active = TRUE
  )
$$;

CREATE OR REPLACE FUNCTION public.is_hospital_staff(_user_id uuid, _hospital_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.is_hospital_staff(_user_id, _hospital_id) $$;

-- ---- private.get_user_hospital_id ----
CREATE OR REPLACE FUNCTION private.get_user_hospital_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT hospital_id FROM public.hospital_staff
     WHERE user_id = _user_id AND is_active = TRUE LIMIT 1),
    (SELECT hd.hospital_id FROM public.hospital_doctors hd
     WHERE hd.doctor_id = (SELECT id FROM public.doctors WHERE user_id = _user_id LIMIT 1)
       AND hd.is_active = TRUE LIMIT 1)
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_hospital_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.get_user_hospital_id(_user_id) $$;

-- ---- private.get_user_doctor_id ----
CREATE OR REPLACE FUNCTION private.get_user_doctor_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.doctors WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_doctor_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$ SELECT private.get_user_doctor_id(_user_id) $$;

-- ---- private.create_hospital_with_admin ----
CREATE OR REPLACE FUNCTION private.create_hospital_with_admin(
  _name text, _address text, _phone text, _email text,
  _first_name text, _last_name text, _plan text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _hid uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

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

CREATE OR REPLACE FUNCTION public.create_hospital_with_admin(
  _name text, _address text, _phone text, _email text,
  _first_name text, _last_name text, _plan text
) RETURNS uuid LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$ SELECT private.create_hospital_with_admin(_name,_address,_phone,_email,_first_name,_last_name,_plan) $$;

-- =========================================================
-- Lock down execute privileges
-- =========================================================
-- Private helpers: only authenticated + service_role, no PUBLIC/anon
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA private FROM PUBLIC;
GRANT EXECUTE ON FUNCTION
  private.get_doctor_hospital_ids(uuid),
  private.is_doctor_at_hospital(uuid, uuid),
  private.get_doctor_hospital_id(uuid),
  private.is_hospital_admin(uuid, uuid),
  private.can_doctor_access_patient(uuid, uuid),
  private.get_hospital_plan(uuid),
  private.is_hospital_staff(uuid, uuid),
  private.get_user_hospital_id(uuid),
  private.get_user_doctor_id(uuid),
  private.create_hospital_with_admin(text, text, text, text, text, text, text)
TO authenticated, service_role;

-- Public wrappers are SECURITY INVOKER; remove PUBLIC/anon grants
REVOKE EXECUTE ON FUNCTION
  public.get_doctor_hospital_ids(uuid),
  public.is_doctor_at_hospital(uuid, uuid),
  public.get_doctor_hospital_id(uuid),
  public.is_hospital_admin(uuid, uuid),
  public.can_doctor_access_patient(uuid, uuid),
  public.get_hospital_plan(uuid),
  public.is_hospital_staff(uuid, uuid),
  public.get_user_hospital_id(uuid),
  public.get_user_doctor_id(uuid),
  public.create_hospital_with_admin(text, text, text, text, text, text, text)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  public.get_doctor_hospital_ids(uuid),
  public.is_doctor_at_hospital(uuid, uuid),
  public.get_doctor_hospital_id(uuid),
  public.is_hospital_admin(uuid, uuid),
  public.can_doctor_access_patient(uuid, uuid),
  public.get_hospital_plan(uuid),
  public.is_hospital_staff(uuid, uuid),
  public.get_user_hospital_id(uuid),
  public.get_user_doctor_id(uuid),
  public.create_hospital_with_admin(text, text, text, text, text, text, text)
TO authenticated, service_role;
