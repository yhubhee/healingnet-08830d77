
-- Hospital Wards
CREATE TABLE public.hospital_wards (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    ward_name TEXT NOT NULL,
    ward_type TEXT NOT NULL DEFAULT 'general',
    total_beds INTEGER NOT NULL DEFAULT 0,
    floor TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Hospital Beds
CREATE TABLE public.hospital_beds (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    ward_id UUID NOT NULL REFERENCES public.hospital_wards(id) ON DELETE CASCADE,
    bed_number TEXT NOT NULL,
    bed_type TEXT NOT NULL DEFAULT 'standard',
    status TEXT NOT NULL DEFAULT 'available',
    daily_rate NUMERIC DEFAULT 0,
    patient_id UUID REFERENCES public.patients(id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    discharged_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS for wards
ALTER TABLE public.hospital_wards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view wards" ON public.hospital_wards
FOR SELECT TO authenticated
USING (hospital_id = get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can insert wards" ON public.hospital_wards
FOR INSERT TO authenticated
WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can update wards" ON public.hospital_wards
FOR UPDATE TO authenticated
USING (hospital_id = get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can delete wards" ON public.hospital_wards
FOR DELETE TO authenticated
USING (hospital_id = get_user_hospital_id(auth.uid()));

-- RLS for beds
ALTER TABLE public.hospital_beds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view beds" ON public.hospital_beds
FOR SELECT TO authenticated
USING (hospital_id = get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can insert beds" ON public.hospital_beds
FOR INSERT TO authenticated
WITH CHECK (hospital_id = get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can update beds" ON public.hospital_beds
FOR UPDATE TO authenticated
USING (hospital_id = get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can delete beds" ON public.hospital_beds
FOR DELETE TO authenticated
USING (hospital_id = get_user_hospital_id(auth.uid()));

-- Updated_at triggers
CREATE TRIGGER update_hospital_wards_updated_at
    BEFORE UPDATE ON public.hospital_wards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_hospital_beds_updated_at
    BEFORE UPDATE ON public.hospital_beds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.hospital_beds;
