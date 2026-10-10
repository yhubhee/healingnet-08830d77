
-- ==========================================
-- HOSPITALS
-- ==========================================
CREATE TABLE public.hospitals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    license_number TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- HOSPITAL STAFF (linked to auth.users)
-- ==========================================
CREATE TABLE public.hospital_staff (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'receptionist' CHECK (role IN ('admin', 'receptionist', 'nurse', 'lab_tech', 'pharmacist', 'manager', 'medical_officer')),
    department TEXT,
    profile_image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, hospital_id)
);

-- ==========================================
-- DOCTORS
-- ==========================================
CREATE TABLE public.doctors (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    specialty TEXT,
    years_experience INT DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    profile_image_url TEXT,
    bio TEXT,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- HOSPITAL DOCTORS (assignments)
-- ==========================================
CREATE TABLE public.hospital_doctors (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    employment_type TEXT NOT NULL DEFAULT 'full_time' CHECK (employment_type IN ('full_time', 'visiting_consultant', 'locum')),
    department TEXT,
    contract_start DATE,
    contract_end DATE,
    salary DECIMAL(12,2),
    commission_rate DECIMAL(5,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(hospital_id, doctor_id)
);

-- ==========================================
-- PATIENTS
-- ==========================================
CREATE TABLE public.patients (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    blood_group TEXT,
    genotype TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    insurance_provider TEXT,
    insurance_policy_number TEXT,
    profile_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- PATIENT CHECK-INS (Queue)
-- ==========================================
CREATE TABLE public.patient_checkins (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    checkin_type TEXT NOT NULL DEFAULT 'walk_in' CHECK (checkin_type IN ('pre_booked', 'walk_in')),
    queue_number INT,
    status TEXT NOT NULL DEFAULT 'checked_in' CHECK (status IN ('checked_in', 'waiting', 'in_consultation', 'completed', 'no_show', 'cancelled')),
    checkin_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    called_time TIMESTAMP WITH TIME ZONE,
    consultation_start TIMESTAMP WITH TIME ZONE,
    consultation_end TIMESTAMP WITH TIME ZONE,
    assigned_doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
    department TEXT,
    priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal', 'priority', 'emergency')),
    vitals JSONB,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- HOSPITAL BILLING
-- ==========================================
CREATE TABLE public.hospital_billing (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    checkin_id UUID REFERENCES public.patient_checkins(id) ON DELETE SET NULL,
    billing_type TEXT NOT NULL CHECK (billing_type IN ('consultation', 'procedure', 'lab', 'pharmacy', 'surgery', 'maternity', 'imaging')),
    description TEXT,
    amount DECIMAL(12,2) NOT NULL,
    discount DECIMAL(12,2) DEFAULT 0,
    tax DECIMAL(12,2) DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded', 'waived')),
    payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'transfer', 'insurance', 'hmo')),
    insurance_provider TEXT,
    insurance_policy_number TEXT,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- EMR ENTRIES
-- ==========================================
CREATE TABLE public.emr_entries (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
    checkin_id UUID REFERENCES public.patient_checkins(id) ON DELETE SET NULL,
    entry_type TEXT NOT NULL CHECK (entry_type IN ('consultation_note', 'vitals', 'diagnosis', 'procedure', 'lab_order', 'lab_result', 'imaging', 'referral', 'discharge_summary', 'surgery_note', 'antenatal', 'delivery', 'postnatal')),
    title TEXT NOT NULL,
    content TEXT,
    structured_data JSONB,
    attachments JSONB,
    is_confidential BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- CONSULTATION REQUESTS
-- ==========================================
CREATE TABLE public.consultation_requests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    requesting_hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    specialty_needed TEXT,
    urgency TEXT DEFAULT 'moderate' CHECK (urgency IN ('low', 'moderate', 'high', 'urgent')),
    request_type TEXT DEFAULT 'virtual' CHECK (request_type IN ('virtual', 'in_person', 'either')),
    reason TEXT NOT NULL,
    patient_summary TEXT,
    preferred_date DATE,
    preferred_time TIME,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'completed', 'cancelled')),
    doctor_notes TEXT,
    meeting_link TEXT,
    fee_agreed DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- MATERNITY RECORDS
-- ==========================================
CREATE TABLE public.maternity_records (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
    lmp_date DATE,
    edd DATE,
    gestational_age_weeks INT,
    gravida INT DEFAULT 1,
    para INT DEFAULT 0,
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('low', 'moderate', 'high')),
    blood_group TEXT,
    genotype TEXT,
    status TEXT DEFAULT 'anc_registered' CHECK (status IN ('anc_registered', 'active_anc', 'labour', 'delivered', 'postnatal', 'discharged')),
    delivery_date TIMESTAMP WITH TIME ZONE,
    delivery_type TEXT CHECK (delivery_type IN ('normal', 'caesarean', 'assisted', 'vacuum')),
    baby_weight DECIMAL(4,2),
    baby_gender TEXT CHECK (baby_gender IN ('male', 'female')),
    apgar_score TEXT,
    complications TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- SURGERY RECORDS
-- ==========================================
CREATE TABLE public.surgery_records (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    surgeon_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE,
    anaesthetist_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
    procedure_name TEXT NOT NULL,
    procedure_type TEXT DEFAULT 'elective' CHECK (procedure_type IN ('elective', 'emergency', 'day_case')),
    theatre_number TEXT,
    anaesthesia_type TEXT DEFAULT 'general' CHECK (anaesthesia_type IN ('general', 'local', 'spinal', 'epidural', 'sedation')),
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    duration_minutes INT,
    status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'prep', 'in_progress', 'recovery', 'completed', 'cancelled', 'postponed')),
    pre_op_diagnosis TEXT,
    post_op_diagnosis TEXT,
    operative_findings TEXT,
    complications TEXT,
    blood_loss_ml INT,
    post_op_instructions TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- HOSPITAL REFERRALS
-- ==========================================
CREATE TABLE public.hospital_referrals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    referring_doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
    referred_to_doctor_id UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
    referred_to_hospital TEXT,
    referral_type TEXT NOT NULL CHECK (referral_type IN ('internal', 'external_outgoing', 'external_incoming')),
    specialty TEXT,
    reason TEXT NOT NULL,
    clinical_summary TEXT,
    urgency TEXT DEFAULT 'routine' CHECK (urgency IN ('routine', 'urgent', 'emergency')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'declined')),
    appointment_date DATE,
    feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- INSURANCE CLAIMS
-- ==========================================
CREATE TABLE public.insurance_claims (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    billing_id UUID REFERENCES public.hospital_billing(id) ON DELETE SET NULL,
    insurance_provider TEXT NOT NULL,
    policy_number TEXT,
    claim_amount DECIMAL(12,2) NOT NULL,
    approved_amount DECIMAL(12,2),
    service_description TEXT,
    claim_date DATE NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'appealed', 'paid')),
    rejection_reason TEXT,
    paid_date DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- PHARMACY INVENTORY
-- ==========================================
CREATE TABLE public.pharmacy_inventory (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    drug_name TEXT NOT NULL,
    generic_name TEXT,
    category TEXT,
    dosage_form TEXT DEFAULT 'tablet' CHECK (dosage_form IN ('tablet', 'capsule', 'syrup', 'injection', 'cream', 'inhaler', 'drops', 'iv_fluid', 'other')),
    strength TEXT,
    quantity_in_stock INT DEFAULT 0,
    reorder_level INT DEFAULT 50,
    unit_price DECIMAL(10,2),
    supplier TEXT,
    batch_number TEXT,
    expiry_date DATE,
    location TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- PHARMACY DISPENSING
-- ==========================================
CREATE TABLE public.pharmacy_dispensing (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    drug_id UUID REFERENCES public.pharmacy_inventory(id) ON DELETE SET NULL,
    drug_name TEXT NOT NULL,
    dosage TEXT,
    quantity_dispensed INT,
    dispensed_by UUID REFERENCES public.hospital_staff(id) ON DELETE SET NULL,
    payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'insurance', 'waived')),
    dispensed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- DOCTOR MARKETPLACE
-- ==========================================
CREATE TABLE public.doctor_marketplace (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    doctor_id UUID NOT NULL REFERENCES public.doctors(id) ON DELETE CASCADE UNIQUE,
    home_hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
    is_available_for_external BOOLEAN DEFAULT TRUE,
    external_consultation_fee DECIMAL(10,2) DEFAULT 0,
    external_virtual_fee DECIMAL(10,2) DEFAULT 0,
    specialties_offered JSONB,
    max_external_hours_per_week INT DEFAULT 10,
    bio_for_marketplace TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- HOSPITAL NOTIFICATIONS
-- ==========================================
CREATE TABLE public.hospital_notifications (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'system' CHECK (type IN ('checkin', 'appointment', 'billing', 'lab', 'pharmacy', 'consultation', 'emergency', 'referral', 'system', 'emr')),
    title TEXT NOT NULL,
    message TEXT,
    reference_id UUID,
    reference_type TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- LAB RESULTS
-- ==========================================
CREATE TABLE public.lab_results (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
    ordered_by UUID REFERENCES public.doctors(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'ordered', 'processing', 'in_progress', 'completed', 'final')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.lab_result_tests (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    lab_result_id UUID NOT NULL REFERENCES public.lab_results(id) ON DELETE CASCADE,
    test_name TEXT NOT NULL,
    category_name TEXT,
    sample_type TEXT,
    result_value TEXT,
    reference_range TEXT,
    unit TEXT,
    is_abnormal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- ==========================================
-- ENABLE RLS ON ALL TABLES
-- ==========================================
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emr_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maternity_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surgery_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pharmacy_dispensing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctor_marketplace ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospital_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_result_tests ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- SECURITY DEFINER FUNCTIONS
-- ==========================================
CREATE OR REPLACE FUNCTION public.is_hospital_staff(_user_id UUID, _hospital_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.hospital_staff
        WHERE user_id = _user_id AND hospital_id = _hospital_id AND is_active = TRUE
    )
$$;

CREATE OR REPLACE FUNCTION public.get_user_hospital_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT hospital_id FROM public.hospital_staff
    WHERE user_id = _user_id AND is_active = TRUE
    LIMIT 1
$$;

-- ==========================================
-- RLS POLICIES
-- ==========================================
CREATE POLICY "Staff can view their hospital" ON public.hospitals
FOR SELECT USING (public.is_hospital_staff(auth.uid(), id));

CREATE POLICY "Staff can view colleagues" ON public.hospital_staff
FOR SELECT USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Authenticated can view doctors" ON public.doctors
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can view hospital doctors" ON public.hospital_doctors
FOR SELECT USING (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can insert hospital doctors" ON public.hospital_doctors
FOR INSERT WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can update hospital doctors" ON public.hospital_doctors
FOR UPDATE USING (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can delete hospital doctors" ON public.hospital_doctors
FOR DELETE USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can view patients" ON public.patients
FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can insert patients" ON public.patients
FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update patients" ON public.patients
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Staff can view checkins" ON public.patient_checkins
FOR SELECT USING (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can insert checkins" ON public.patient_checkins
FOR INSERT WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can update checkins" ON public.patient_checkins
FOR UPDATE USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can view billing" ON public.hospital_billing
FOR SELECT USING (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can insert billing" ON public.hospital_billing
FOR INSERT WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can update billing" ON public.hospital_billing
FOR UPDATE USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can view emr" ON public.emr_entries
FOR SELECT USING (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can insert emr" ON public.emr_entries
FOR INSERT WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can update emr" ON public.emr_entries
FOR UPDATE USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can view consultations" ON public.consultation_requests
FOR SELECT USING (requesting_hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can insert consultations" ON public.consultation_requests
FOR INSERT WITH CHECK (requesting_hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can update consultations" ON public.consultation_requests
FOR UPDATE USING (requesting_hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can view maternity" ON public.maternity_records
FOR SELECT USING (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can insert maternity" ON public.maternity_records
FOR INSERT WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can update maternity" ON public.maternity_records
FOR UPDATE USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can view surgery" ON public.surgery_records
FOR SELECT USING (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can insert surgery" ON public.surgery_records
FOR INSERT WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can update surgery" ON public.surgery_records
FOR UPDATE USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can view referrals" ON public.hospital_referrals
FOR SELECT USING (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can insert referrals" ON public.hospital_referrals
FOR INSERT WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can update referrals" ON public.hospital_referrals
FOR UPDATE USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can view claims" ON public.insurance_claims
FOR SELECT USING (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can insert claims" ON public.insurance_claims
FOR INSERT WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can update claims" ON public.insurance_claims
FOR UPDATE USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can view pharmacy" ON public.pharmacy_inventory
FOR SELECT USING (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can insert pharmacy" ON public.pharmacy_inventory
FOR INSERT WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can update pharmacy" ON public.pharmacy_inventory
FOR UPDATE USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can view dispensing" ON public.pharmacy_dispensing
FOR SELECT USING (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can insert dispensing" ON public.pharmacy_dispensing
FOR INSERT WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Authenticated can view marketplace" ON public.doctor_marketplace
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Staff can view notifications" ON public.hospital_notifications
FOR SELECT USING (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can update notifications" ON public.hospital_notifications
FOR UPDATE USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can view lab results" ON public.lab_results
FOR SELECT USING (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can insert lab results" ON public.lab_results
FOR INSERT WITH CHECK (hospital_id = public.get_user_hospital_id(auth.uid()));
CREATE POLICY "Staff can update lab results" ON public.lab_results
FOR UPDATE USING (hospital_id = public.get_user_hospital_id(auth.uid()));

CREATE POLICY "Staff can view lab tests" ON public.lab_result_tests
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.lab_results lr
        WHERE lr.id = lab_result_id
        AND lr.hospital_id = public.get_user_hospital_id(auth.uid())
    )
);
CREATE POLICY "Staff can insert lab tests" ON public.lab_result_tests
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.lab_results lr
        WHERE lr.id = lab_result_id
        AND lr.hospital_id = public.get_user_hospital_id(auth.uid())
    )
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX idx_hospital_staff_hospital ON public.hospital_staff(hospital_id);
CREATE INDEX idx_hospital_staff_user ON public.hospital_staff(user_id);
CREATE INDEX idx_hospital_doctors_hospital ON public.hospital_doctors(hospital_id);
CREATE INDEX idx_hospital_doctors_doctor ON public.hospital_doctors(doctor_id);
CREATE INDEX idx_patients_user ON public.patients(user_id);
CREATE INDEX idx_checkins_hospital ON public.patient_checkins(hospital_id);
CREATE INDEX idx_checkins_status ON public.patient_checkins(status);
CREATE INDEX idx_billing_hospital ON public.hospital_billing(hospital_id);
CREATE INDEX idx_billing_patient ON public.hospital_billing(patient_id);
CREATE INDEX idx_emr_patient ON public.emr_entries(patient_id);
CREATE INDEX idx_emr_hospital ON public.emr_entries(hospital_id);
CREATE INDEX idx_maternity_patient ON public.maternity_records(patient_id);
CREATE INDEX idx_surgery_patient ON public.surgery_records(patient_id);
CREATE INDEX idx_surgery_date ON public.surgery_records(scheduled_date);
CREATE INDEX idx_referrals_hospital ON public.hospital_referrals(hospital_id);
CREATE INDEX idx_claims_hospital ON public.insurance_claims(hospital_id);
CREATE INDEX idx_pharmacy_hospital ON public.pharmacy_inventory(hospital_id);
CREATE INDEX idx_dispensing_hospital ON public.pharmacy_dispensing(hospital_id);
CREATE INDEX idx_notifications_hospital ON public.hospital_notifications(hospital_id);
CREATE INDEX idx_notifications_read ON public.hospital_notifications(hospital_id, is_read);
CREATE INDEX idx_lab_results_hospital ON public.lab_results(hospital_id);
CREATE INDEX idx_lab_tests_result ON public.lab_result_tests(lab_result_id);
CREATE INDEX idx_marketplace_doctor ON public.doctor_marketplace(doctor_id);
CREATE INDEX idx_consultation_hospital ON public.consultation_requests(requesting_hospital_id);

-- ==========================================
-- Updated_at trigger
-- ==========================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_hospitals_updated_at BEFORE UPDATE ON public.hospitals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_hospital_staff_updated_at BEFORE UPDATE ON public.hospital_staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_hospital_doctors_updated_at BEFORE UPDATE ON public.hospital_doctors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_checkins_updated_at BEFORE UPDATE ON public.patient_checkins FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_billing_updated_at BEFORE UPDATE ON public.hospital_billing FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_emr_updated_at BEFORE UPDATE ON public.emr_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_consultation_updated_at BEFORE UPDATE ON public.consultation_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_maternity_updated_at BEFORE UPDATE ON public.maternity_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_surgery_updated_at BEFORE UPDATE ON public.surgery_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON public.hospital_referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON public.insurance_claims FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_pharmacy_updated_at BEFORE UPDATE ON public.pharmacy_inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_marketplace_updated_at BEFORE UPDATE ON public.doctor_marketplace FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lab_results_updated_at BEFORE UPDATE ON public.lab_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
