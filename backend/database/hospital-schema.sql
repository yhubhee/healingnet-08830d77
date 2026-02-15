-- HealingNet Hospital Module Schema (MySQL)
-- Run after schema.sql (which contains patients, doctors, appointments, etc.)
-- This schema extends the core with hospital-specific tables

USE healingnet;

-- ==========================================
-- HOSPITAL STAFF (Admin users for hospitals)
-- ==========================================
CREATE TABLE IF NOT EXISTS hospital_staff (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role ENUM('admin', 'receptionist', 'nurse', 'lab_tech', 'pharmacist', 'manager', 'medical_officer') DEFAULT 'receptionist',
    department VARCHAR(100),
    profile_image VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ==========================================
-- HOSPITAL DOCTORS (Doctor assignments with type)
-- ==========================================
CREATE TABLE IF NOT EXISTS hospital_doctors (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    doctor_id INT NOT NULL,
    employment_type ENUM('full_time', 'visiting_consultant', 'locum') NOT NULL DEFAULT 'full_time',
    department VARCHAR(100),
    contract_start DATE,
    contract_end DATE,
    salary DECIMAL(12, 2),
    commission_rate DECIMAL(5, 2) DEFAULT 0.00,
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    UNIQUE KEY unique_hospital_doctor (hospital_id, doctor_id)
);

-- ==========================================
-- DOCTOR MARKETPLACE (Doctors available for external booking)
-- ==========================================
CREATE TABLE IF NOT EXISTS doctor_marketplace (
    id INT AUTO_INCREMENT PRIMARY KEY,
    doctor_id INT NOT NULL,
    home_hospital_id INT,
    is_available_for_external BOOLEAN DEFAULT TRUE,
    external_consultation_fee DECIMAL(10, 2) DEFAULT 0.00,
    external_virtual_fee DECIMAL(10, 2) DEFAULT 0.00,
    specialties_offered JSON,
    max_external_hours_per_week INT DEFAULT 10,
    current_external_hours DECIMAL(5, 2) DEFAULT 0.00,
    bio_for_marketplace TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE
);

-- ==========================================
-- CONSULTATION REQUESTS (Hospital-to-Doctor requests)
-- ==========================================
CREATE TABLE IF NOT EXISTS consultation_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    requesting_hospital_id INT NOT NULL,
    doctor_id INT NOT NULL,
    patient_id INT NOT NULL,
    specialty_needed VARCHAR(100),
    urgency ENUM('low', 'moderate', 'high', 'urgent') DEFAULT 'moderate',
    request_type ENUM('virtual', 'in_person', 'either') DEFAULT 'virtual',
    reason TEXT NOT NULL,
    patient_summary TEXT,
    preferred_date DATE,
    preferred_time TIME,
    status ENUM('pending', 'accepted', 'rejected', 'completed', 'cancelled') DEFAULT 'pending',
    doctor_notes TEXT,
    meeting_link VARCHAR(500),
    fee_agreed DECIMAL(10, 2),
    revenue_split_hospital DECIMAL(5, 2) DEFAULT 30.00,
    revenue_split_doctor DECIMAL(5, 2) DEFAULT 70.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE
);

-- ==========================================
-- PATIENT CHECK-INS (Queue management)
-- ==========================================
CREATE TABLE IF NOT EXISTS patient_checkins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    patient_id INT NOT NULL,
    appointment_id INT,
    checkin_type ENUM('pre_booked', 'walk_in') NOT NULL DEFAULT 'pre_booked',
    queue_number INT,
    status ENUM('checked_in', 'waiting', 'in_consultation', 'completed', 'no_show', 'cancelled') DEFAULT 'checked_in',
    checkin_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    called_time TIMESTAMP NULL,
    consultation_start TIMESTAMP NULL,
    consultation_end TIMESTAMP NULL,
    assigned_doctor_id INT,
    department VARCHAR(100),
    priority ENUM('normal', 'priority', 'emergency') DEFAULT 'normal',
    vitals JSON,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_doctor_id) REFERENCES doctors(doctor_id) ON DELETE SET NULL
);

-- ==========================================
-- HOSPITAL BILLING & REVENUE
-- ==========================================
CREATE TABLE IF NOT EXISTS hospital_billing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    patient_id INT NOT NULL,
    appointment_id INT,
    consultation_request_id INT,
    checkin_id INT,
    billing_type ENUM('consultation', 'procedure', 'lab', 'pharmacy', 'external_consultation', 'teleconsultation', 'surgery', 'maternity', 'imaging') NOT NULL,
    description VARCHAR(255),
    amount DECIMAL(12, 2) NOT NULL,
    discount DECIMAL(12, 2) DEFAULT 0.00,
    tax DECIMAL(12, 2) DEFAULT 0.00,
    total DECIMAL(12, 2) NOT NULL,
    payment_status ENUM('pending', 'partial', 'paid', 'refunded', 'waived') DEFAULT 'pending',
    payment_method ENUM('cash', 'card', 'transfer', 'insurance', 'hmo') DEFAULT 'cash',
    insurance_provider VARCHAR(200),
    insurance_policy_number VARCHAR(100),
    insurance_claim_status ENUM('not_submitted', 'submitted', 'approved', 'rejected', 'appealed') DEFAULT 'not_submitted',
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id) ON DELETE SET NULL,
    FOREIGN KEY (consultation_request_id) REFERENCES consultation_requests(id) ON DELETE SET NULL,
    FOREIGN KEY (checkin_id) REFERENCES patient_checkins(id) ON DELETE SET NULL
);

-- ==========================================
-- EMR ENTRIES (Extended medical records for hospital use)
-- ==========================================
CREATE TABLE IF NOT EXISTS emr_entries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    patient_id INT NOT NULL,
    doctor_id INT,
    checkin_id INT,
    entry_type ENUM('consultation_note', 'vitals', 'diagnosis', 'procedure', 'lab_order', 'lab_result', 'imaging', 'referral', 'discharge_summary', 'surgery_note', 'antenatal', 'delivery', 'postnatal') NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    structured_data JSON,
    attachments JSON,
    is_confidential BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE SET NULL,
    FOREIGN KEY (checkin_id) REFERENCES patient_checkins(id) ON DELETE SET NULL
);

-- ==========================================
-- MATERNITY RECORDS
-- ==========================================
CREATE TABLE IF NOT EXISTS maternity_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    patient_id INT NOT NULL,
    doctor_id INT,
    lmp_date DATE,
    edd DATE,
    gestational_age_weeks INT,
    gravida INT DEFAULT 1,
    para INT DEFAULT 0,
    risk_level ENUM('low', 'moderate', 'high') DEFAULT 'low',
    blood_group VARCHAR(5),
    genotype VARCHAR(10),
    hiv_status ENUM('positive', 'negative', 'unknown') DEFAULT 'unknown',
    hepatitis_b ENUM('positive', 'negative', 'unknown') DEFAULT 'unknown',
    status ENUM('anc_registered', 'active_anc', 'labour', 'delivered', 'postnatal', 'discharged') DEFAULT 'anc_registered',
    delivery_date DATETIME NULL,
    delivery_type ENUM('normal', 'caesarean', 'assisted', 'vacuum') NULL,
    baby_weight DECIMAL(4,2) NULL,
    baby_gender ENUM('male', 'female') NULL,
    apgar_score VARCHAR(10) NULL,
    complications TEXT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE SET NULL
);

-- ==========================================
-- SURGERY RECORDS
-- ==========================================
CREATE TABLE IF NOT EXISTS surgery_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    patient_id INT NOT NULL,
    surgeon_id INT NOT NULL,
    anaesthetist_id INT NULL,
    procedure_name VARCHAR(255) NOT NULL,
    procedure_type ENUM('elective', 'emergency', 'day_case') DEFAULT 'elective',
    theatre_number VARCHAR(20),
    anaesthesia_type ENUM('general', 'local', 'spinal', 'epidural', 'sedation') DEFAULT 'general',
    scheduled_date DATE NOT NULL,
    scheduled_time TIME NOT NULL,
    actual_start DATETIME NULL,
    actual_end DATETIME NULL,
    duration_minutes INT NULL,
    status ENUM('scheduled', 'prep', 'in_progress', 'recovery', 'completed', 'cancelled', 'postponed') DEFAULT 'scheduled',
    pre_op_diagnosis TEXT,
    post_op_diagnosis TEXT,
    operative_findings TEXT,
    complications TEXT NULL,
    blood_loss_ml INT NULL,
    post_op_instructions TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (surgeon_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    FOREIGN KEY (anaesthetist_id) REFERENCES doctors(doctor_id) ON DELETE SET NULL
);

-- ==========================================
-- REFERRALS
-- ==========================================
CREATE TABLE IF NOT EXISTS hospital_referrals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    patient_id INT NOT NULL,
    referring_doctor_id INT,
    referred_to_doctor_id INT NULL,
    referred_to_hospital VARCHAR(255) NULL,
    referral_type ENUM('internal', 'external_outgoing', 'external_incoming') NOT NULL,
    specialty VARCHAR(100),
    reason TEXT NOT NULL,
    clinical_summary TEXT,
    urgency ENUM('routine', 'urgent', 'emergency') DEFAULT 'routine',
    status ENUM('pending', 'accepted', 'in_progress', 'completed', 'declined') DEFAULT 'pending',
    appointment_date DATE NULL,
    feedback TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (referring_doctor_id) REFERENCES doctors(doctor_id) ON DELETE SET NULL,
    FOREIGN KEY (referred_to_doctor_id) REFERENCES doctors(doctor_id) ON DELETE SET NULL
);

-- ==========================================
-- INSURANCE CLAIMS (Hospital-side tracking)
-- ==========================================
CREATE TABLE IF NOT EXISTS insurance_claims (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    patient_id INT NOT NULL,
    billing_id INT,
    insurance_provider VARCHAR(200) NOT NULL,
    policy_number VARCHAR(100),
    claim_amount DECIMAL(12,2) NOT NULL,
    approved_amount DECIMAL(12,2) NULL,
    service_description VARCHAR(255),
    claim_date DATE NOT NULL,
    status ENUM('draft', 'submitted', 'under_review', 'approved', 'rejected', 'appealed', 'paid') DEFAULT 'draft',
    rejection_reason TEXT NULL,
    paid_date DATE NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (billing_id) REFERENCES hospital_billing(id) ON DELETE SET NULL
);

-- ==========================================
-- PHARMACY INVENTORY
-- ==========================================
CREATE TABLE IF NOT EXISTS pharmacy_inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    drug_name VARCHAR(200) NOT NULL,
    generic_name VARCHAR(200),
    category VARCHAR(100),
    dosage_form ENUM('tablet', 'capsule', 'syrup', 'injection', 'cream', 'inhaler', 'drops', 'iv_fluid', 'other') DEFAULT 'tablet',
    strength VARCHAR(100),
    quantity_in_stock INT DEFAULT 0,
    reorder_level INT DEFAULT 50,
    unit_price DECIMAL(10,2),
    supplier VARCHAR(200),
    batch_number VARCHAR(100),
    expiry_date DATE,
    location VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ==========================================
-- PHARMACY DISPENSING
-- ==========================================
CREATE TABLE IF NOT EXISTS pharmacy_dispensing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    patient_id INT NOT NULL,
    prescription_id INT,
    drug_id INT,
    drug_name VARCHAR(200) NOT NULL,
    dosage VARCHAR(100),
    quantity_dispensed INT,
    dispensed_by INT,
    payment_status ENUM('pending', 'paid', 'insurance', 'waived') DEFAULT 'pending',
    dispensed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id) ON DELETE SET NULL,
    FOREIGN KEY (drug_id) REFERENCES pharmacy_inventory(id) ON DELETE SET NULL
);

-- ==========================================
-- HOSPITAL NOTIFICATION PREFERENCES
-- ==========================================
CREATE TABLE IF NOT EXISTS hospital_notification_preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    pref_key VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_hospital_pref (hospital_id, pref_key)
);

-- ==========================================
-- INDEXES
-- ==========================================
CREATE INDEX idx_hospital_staff_hospital ON hospital_staff(hospital_id);
CREATE INDEX idx_hospital_doctors_hospital ON hospital_doctors(hospital_id);
CREATE INDEX idx_hospital_doctors_doctor ON hospital_doctors(doctor_id);
CREATE INDEX idx_marketplace_doctor ON doctor_marketplace(doctor_id);
CREATE INDEX idx_consultation_requests_hospital ON consultation_requests(requesting_hospital_id);
CREATE INDEX idx_consultation_requests_doctor ON consultation_requests(doctor_id);
CREATE INDEX idx_checkins_hospital ON patient_checkins(hospital_id);
CREATE INDEX idx_checkins_date ON patient_checkins(checkin_time);
CREATE INDEX idx_checkins_status ON patient_checkins(status);
CREATE INDEX idx_billing_hospital ON hospital_billing(hospital_id);
CREATE INDEX idx_billing_patient ON hospital_billing(patient_id);
CREATE INDEX idx_emr_patient ON emr_entries(patient_id);
CREATE INDEX idx_emr_hospital ON emr_entries(hospital_id);
CREATE INDEX idx_maternity_patient ON maternity_records(patient_id);
CREATE INDEX idx_surgery_patient ON surgery_records(patient_id);
CREATE INDEX idx_surgery_date ON surgery_records(scheduled_date);
CREATE INDEX idx_referrals_patient ON hospital_referrals(patient_id);
CREATE INDEX idx_insurance_claims_patient ON insurance_claims(patient_id);
CREATE INDEX idx_pharmacy_inventory_hospital ON pharmacy_inventory(hospital_id);
CREATE INDEX idx_pharmacy_dispensing_patient ON pharmacy_dispensing(patient_id);
