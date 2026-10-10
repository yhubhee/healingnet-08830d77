REVOKE EXECUTE ON FUNCTION public.is_doctor_at_hospital(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_doctor_hospital_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_doctor_hospital_ids(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_doctor_access_patient(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_doctor_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_hospital_id(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_doctor_at_hospital(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_doctor_hospital_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_doctor_hospital_ids(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_doctor_access_patient(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_doctor_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_hospital_id(uuid) TO authenticated, service_role;