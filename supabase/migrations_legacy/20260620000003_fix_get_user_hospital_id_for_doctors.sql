-- Improve get_user_hospital_id to include doctors via hospital_doctors
CREATE OR REPLACE FUNCTION public.get_user_hospital_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    -- First check if user is hospital staff
    SELECT hospital_id FROM public.hospital_staff
    WHERE user_id = _user_id AND is_active = TRUE
    LIMIT 1

    UNION ALL

    -- Also check if user is a doctor with hospital affiliation
    SELECT hospital_id FROM public.hospital_doctors hd
    WHERE hd.doctor_id = (
        SELECT id FROM public.doctors WHERE user_id = _user_id LIMIT 1
    ) AND hd.is_active = TRUE
    LIMIT 1
$$;
