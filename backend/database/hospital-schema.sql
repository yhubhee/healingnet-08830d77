-- HealingNet Hospital Module Schema (MySQL)
-- Run after schema.sql

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
    role ENUM('admin', 'receptionist', 'nurse', 'lab_tech', 'pharmacist', 'manager') DEFAULT 'receptionist',
    profile_image VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE
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
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
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
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    FOREIGN KEY (home_hospital_id) REFERENCES hospitals(id) ON DELETE SET NULL
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
    FOREIGN KEY (requesting_hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
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
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
    FOREIGN KEY (assigned_doctor_id) REFERENCES doctors(id) ON DELETE SET NULL
);

-- ==========================================
-- BILLING & REVENUE
-- ==========================================
CREATE TABLE IF NOT EXISTS hospital_billing (
    id INT AUTO_INCREMENT PRIMARY KEY,
    hospital_id INT NOT NULL,
    patient_id INT NOT NULL,
    appointment_id INT,
    consultation_request_id INT,
    checkin_id INT,
    billing_type ENUM('consultation', 'procedure', 'lab', 'pharmacy', 'external_consultation', 'teleconsultation') NOT NULL,
    description VARCHAR(255),
    amount DECIMAL(12, 2) NOT NULL,
    discount DECIMAL(12, 2) DEFAULT 0.00,
    tax DECIMAL(12, 2) DEFAULT 0.00,
    total DECIMAL(12, 2) NOT NULL,
    payment_status ENUM('pending', 'partial', 'paid', 'refunded', 'waived') DEFAULT 'pending',
    payment_method ENUM('cash', 'card', 'transfer', 'insurance', 'hmo') DEFAULT 'cash',
    insurance_provider VARCHAR(200),
    insurance_policy_number VARCHAR(100),
    paid_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
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
    entry_type ENUM('consultation_note', 'vitals', 'diagnosis', 'procedure', 'lab_order', 'lab_result', 'imaging', 'referral', 'discharge_summary') NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    structured_data JSON,
    attachments JSON,
    is_confidential BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (hospital_id) REFERENCES hospitals(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE SET NULL,
    FOREIGN KEY (checkin_id) REFERENCES patient_checkins(id) ON DELETE SET NULL
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
