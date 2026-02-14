-- DROP DATABASE IF EXISTS hospital_new; -- If exited
create database healingNet;
CREATE TABLE patients (
    patient_id INT PRIMARY KEY AUTO_INCREMENT,
    -- Basic details
    firstname VARCHAR(50) NOT NULL,
    lastname VARCHAR(50) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    gender VARCHAR(30),
    date_of_birth DATE,
    address VARCHAR(200),

    -- Registration data
    date_joined DATETIME DEFAULT CURRENT_TIMESTAMP,
    password VARCHAR(250) NOT NULL,
    status VARCHAR(30) DEFAULT 'active',

    -- Medical information
    symptoms TEXT,                              -- reason they joined / current complaints
    medical_conditions TEXT,                     -- hypertension, diabetes, asthma, etc.
    allergies TEXT,                              -- drug/food allergies
    medications TEXT,                            -- long-term medications
    surgical_history TEXT,
    family_medical_history TEXT,

    -- Additional relevant medical fields
    blood_type VARCHAR(5),                       -- A+, O-, etc.
    genotype VARCHAR(10),                        -- AA, AS, SS (important in Nigeria)
    chronic_conditions TEXT,                     -- e.g. sickle cell, HIV, epilepsy
    lifestyle_factors TEXT,                      -- smoking, alcohol, exercise
    immunization_history TEXT,                   -- vaccinations

    reminder_channel ENUM('email','sms') DEFAULT 'email',

    -- Emergency info
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(50),
    emergency_contact_relationship VARCHAR(50),
    emergency_contact_information TEXT,          -- (kept for compatibility)

    -- Insurance / organization
    insurance_provider VARCHAR(150),
    insurance_number VARCHAR(100),
    organization_id INT NULL,                    -- if patient belongs to a company/family plan

    -- Identity
    profile_img BLOB,
    national_id VARCHAR(100),                    -- NIN or any ID

    -- System fields
    last_login DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE admins (
    admin_id INT PRIMARY KEY AUTO_INCREMENT,

    -- Basic Info
    firstname VARCHAR(100) NOT NULL,
    lastname VARCHAR(100) NOT NULL,
    
    -- Contact
    email VARCHAR(150) UNIQUE NOT NULL,

    -- Security
    password VARCHAR(255) NOT NULL,
    last_login TIMESTAMP NULL,
    password_reset_token VARCHAR(300) NULL,
    password_reset_expires DATETIME NULL,

    -- Role Management
    role ENUM('super_admin','support_admin','hospital_admin','organisation_admin')
         DEFAULT 'support_admin',

    -- Account Status
    status ENUM('active','inactive','suspended') DEFAULT 'active',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE doctors (
    doctor_id INT PRIMARY KEY AUTO_INCREMENT,

    -- Basic Info
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    gender ENUM('male','female','other') NOT NULL,
    date_of_birth DATE NULL,

    -- Contact
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(50) UNIQUE NOT NULL,
    address VARCHAR(255) NULL,

    -- Professional Info
    specialty VARCHAR(150) NOT NULL,
    sub_specialty VARCHAR(150) NULL,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    years_of_experience INT DEFAULT 1,
    medical_school VARCHAR(150) NULL,
    certifications TEXT NULL,

    -- Telehealth-specific
    availability_status TEXT NULL,
    consultation_fee DECIMAL(10,2) DEFAULT 0.00,
    telehealth_mode ENUM('chat','audio','video','all') DEFAULT 'all',

    -- Profile
    profile_image_url VARCHAR(500) NULL,
    about_doctor TEXT NULL,

    -- Account Security
    password VARCHAR(255) NOT NULL,
    last_login TIMESTAMP NULL,
    password_reset_token VARCHAR(300) NULL,
    password_reset_expires DATETIME NULL,
    
    reminder_channel ENUM('email','sms') DEFAULT 'email',

    -- Admin Relationship (If hospital or platform-admin manages them)
    admin_id INT NULL,
    FOREIGN KEY (admin_id) REFERENCES admins(admin_id),

    -- System
    status ENUM('verified','Top','suspended','inactive') 
    DEFAULT 'verified',
    date_joined TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE token_blacklist (
    id INT PRIMARY KEY AUTO_INCREMENT,
    token VARCHAR(500) NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE appointments (
    appointment_id INT PRIMARY KEY AUTO_INCREMENT,

    -- Relationships
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,

    -- Appointment details
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    appointment_endtime TIME NOT NULL,
    appointment_type ENUM('virtual','in_person','home_visit') DEFAULT 'virtual',
    reason VARCHAR(255) NULL,
    notes TEXT NULL,

    -- Doctor approval status
    doc_status_approve ENUM('pending','approved','declined') DEFAULT 'pending',

    -- Appointment lifecycle status
    status ENUM('pending','approved','cancelled','completed','no_show') 
    DEFAULT 'pending',

    -- Payment info
    fee DECIMAL(10,2) NULL,
    payment_status ENUM('pending','paid','failed') DEFAULT 'pending',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    reminder_sent TINYINT(1) DEFAULT 0,
    reminder_sent_at DATETIME NULL, 

    -- Foreign keys
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE
);
CREATE TABLE medical_records (
    id INT AUTO_INCREMENT PRIMARY KEY,

    -- Relationships
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_id INT NULL,

    -- Visit info
    visit_type ENUM('virtual', 'in_person', 'home_visit') DEFAULT 'virtual',
    visit_reason VARCHAR(255),
    chief_complaint TEXT,

    -- Medical history updates (specific to visit)
    history_presenting_illness TEXT,
    past_medical_history TEXT,
    medications_history TEXT,
    allergies TEXT,
    family_history TEXT,
    social_history TEXT,

    -- Vitals
    temperature DECIMAL(5,2),
    blood_pressure VARCHAR(20),
    heart_rate INT,
    respiratory_rate INT,
    spo2 INT,
    weight DECIMAL(5,2),
    height DECIMAL(5,2),
    bmi DECIMAL(5,2),

    -- Doctor notes
    clinical_findings TEXT,
    diagnosis TEXT,
    differential_diagnosis TEXT,
    plan TEXT,
    medical_advice TEXT,

    -- Investigations
    lab_tests_ordered TEXT,
    lab_results TEXT,
    imaging_requested TEXT,
    imaging_results TEXT,

    -- Follow-up
    follow_up_date DATETIME,
    follow_up_instructions TEXT,

    -- Telehealth specifics
    call_duration INT,
    call_recording_url VARCHAR(500),
    attachments JSON,

    -- Billing
    consultation_fee DECIMAL(10,2),
    payment_status ENUM('pending','paid','failed') DEFAULT 'pending',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Foreign keys
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);
CREATE TABLE prescriptions (
    prescription_id INT PRIMARY KEY AUTO_INCREMENT,

    -- Relationships
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    medical_record_id INT NULL,

    -- Prescription details
    diagnosis VARCHAR(255) NULL,
    drug_name VARCHAR(150) NOT NULL,
    dosage VARCHAR(150) NOT NULL,
    frequency VARCHAR(150) NOT NULL,
    duration VARCHAR(150) NOT NULL,

    -- Extra medical info
    route ENUM('oral', 'injection', 'iv', 'topical', 'inhalation', 'other') DEFAULT 'oral',
    quantity INT NULL,
    refill_allowed ENUM('yes','no') DEFAULT 'no',
    refills_remaining INT NOT NULL DEFAULT 0
    notes TEXT NULL,

    -- Status
    prescription_status ENUM('active','completed','cancelled') DEFAULT 'active',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Foreign Keys
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    FOREIGN KEY (medical_record_id) REFERENCES medical_records(id) ON DELETE CASCADE
);
CREATE TABLE doctor_schedules (
    schedule_id INT PRIMARY KEY AUTO_INCREMENT,

    -- Relationships
    doctor_id INT NOT NULL,

    -- Schedule info
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,

    availability_status ENUM('available', 'booked', 'unavailable') 
        DEFAULT 'available',

    -- Optional: recurring schedule
    recurring ENUM('none','daily','weekly','monthly') DEFAULT 'none',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    -- Foreign Key
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id) ON DELETE CASCADE
);
CREATE TABLE symptom_checker_results (
    id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT,
    appointment_id INT NULL,
    specialty VARCHAR(150),
    disease VARCHAR(150),
    matched_symptoms JSON,
    match_percentage INT,
    telemedicine_context TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id)
);
CREATE TABLE lab_tests (
    lab_test_id INT PRIMARY KEY AUTO_INCREMENT,
    id INT,
    patient_id INT,
    doctor_id INT,

    test_name VARCHAR(150),
    test_type VARCHAR(100),
    status ENUM('pending', 'in_progress', 'completed') DEFAULT 'pending',
    result TEXT,
    result_file VARCHAR(300),
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (id) REFERENCES medical_records(id),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);
CREATE TABLE imaging (
    imaging_id INT PRIMARY KEY AUTO_INCREMENT,
    medical_record_id INT,
    patient_id INT,
    doctor_id INT,

    imaging_type VARCHAR(150),
    status ENUM('pending','scheduled','completed') DEFAULT 'pending',
    result TEXT,
    image_url VARCHAR(300),
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (medical_record_id) REFERENCES medical_records(id),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);
CREATE TABLE chat_messages (
    message_id INT PRIMARY KEY AUTO_INCREMENT,
    sender_id INT NOT NULL,
    receiver_id INT NOT NULL,
    sender_type ENUM('patient','doctor','admin') NOT NULL,
    message TEXT,
    attachment_url VARCHAR(255),
    is_read BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE notifications (
    notification_id INT PRIMARY KEY AUTO_INCREMENT,
    user_type ENUM('patient','doctor','admin') NOT NULL,
    user_id INT NOT NULL,
    title VARCHAR(150),
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE reviews (
    review_id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT,
    doctor_id INT,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);
CREATE TABLE audit_logs (
    log_id INT PRIMARY KEY AUTO_INCREMENT,
    user_type ENUM('patient','doctor','admin'),
    user_id INT,
    action VARCHAR(200),
    ip_address VARCHAR(50),
    user_agent TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE teleconsultation_sessions (
    session_id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT,
    patient_id INT,
    doctor_id INT,

    session_start DATETIME,
    session_end DATETIME,
    duration INT,
    session_status ENUM('active','ended','missed'),
    session_recording_url VARCHAR(300),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id),
    FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
);
CREATE TABLE organization_members (
    membership_id INT PRIMARY KEY AUTO_INCREMENT,
    organization_id INT,
    member_type ENUM('patient','doctor','admin'),
    member_id INT,
    role VARCHAR(100),
    status VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
);
CREATE TABLE invoices (
    invoice_id INT PRIMARY KEY AUTO_INCREMENT,
    billing_id INT,
    patient_id INT,
    amount DECIMAL(10,2),
    invoice_number VARCHAR(100),
    status ENUM('pending','paid','cancelled') DEFAULT 'pending',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (billing_id) REFERENCES billing(billing_id),
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
);
CREATE TABLE subscription_plans (
    plan_id INT PRIMARY KEY AUTO_INCREMENT,
    plan_name VARCHAR(100),
    plan_type ENUM('individual','family','organization'),
    price DECIMAL(10,2),
    duration_days INT,
    features TEXT,
    status VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE lab_categories (
  category_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE lab_tests (
  test_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  category_id INT UNSIGNED NOT NULL,
  test_code VARCHAR(50),
  test_name VARCHAR(150) NOT NULL,
  sample_type ENUM('Blood','Urine','Stool','Swab','Other') NOT NULL,
  is_custom TINYINT(1) DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category_id),
  CONSTRAINT fk_lab_tests_category
    FOREIGN KEY (category_id)
    REFERENCES lab_categories(category_id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;
CREATE TABLE lab_test_parameters (
  parameter_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  test_id INT UNSIGNED NOT NULL,
  parameter_name VARCHAR(150) NOT NULL,
  unit VARCHAR(50),
  reference_min DECIMAL(10,2),
  reference_max DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_test (test_id),
  CONSTRAINT fk_parameters_test
    FOREIGN KEY (test_id)
    REFERENCES lab_tests(test_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE lab_result_headers (
  result_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  ordered_by INT UNSIGNED NULL,
  collected_at DATETIME NULL,
  reported_at DATETIME NULL,
  status ENUM('draft','final') DEFAULT 'draft',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_patient (patient_id),
  CONSTRAINT fk_results_patient
    FOREIGN KEY (patient_id)
    REFERENCES patients(patient_id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE lab_result_values (
  value_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  result_id INT UNSIGNED NOT NULL,
  test_id INT UNSIGNED NOT NULL,
  parameter_id INT UNSIGNED NULL,
  result_value VARCHAR(100) NOT NULL,
  unit VARCHAR(50),
  flag ENUM('low','normal','high','critical') DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_result (result_id),
  INDEX idx_test (test_id),
  CONSTRAINT fk_values_result
    FOREIGN KEY (result_id)
    REFERENCES lab_result_headers(result_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_values_test
    FOREIGN KEY (test_id)
    REFERENCES lab_tests(test_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_values_parameter
    FOREIGN KEY (parameter_id)
    REFERENCES lab_test_parameters(parameter_id)
    ON DELETE SET NULL
) ENGINE=InnoDB;
CREATE TABLE lab_orders (
  order_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id INT UNSIGNED NOT NULL,
  ordered_by INT UNSIGNED NOT NULL,
  status ENUM('pending','in_progress','completed','cancelled') DEFAULT 'pending',
  priority ENUM('routine','urgent','stat') DEFAULT 'routine',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_patient
    FOREIGN KEY (patient_id)
    REFERENCES patients(patient_id)
) ENGINE=InnoDB;

CREATE TABLE lab_order_tests (
  order_id INT UNSIGNED NOT NULL,
  test_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (order_id, test_id),
  CONSTRAINT fk_order_tests_order
    FOREIGN KEY (order_id)
    REFERENCES lab_orders(order_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_tests_test
    FOREIGN KEY (test_id)
    REFERENCES lab_tests(test_id)
) ENGINE=InnoDB;

CREATE TABLE lab_reference_ranges (
  range_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  parameter_id INT UNSIGNED NOT NULL,
  gender ENUM('male','female','all') DEFAULT 'all',
  age_min INT NULL,
  age_max INT NULL,
  ref_min DECIMAL(10,2),
  ref_max DECIMAL(10,2),
  CONSTRAINT fk_ranges_parameter
    FOREIGN KEY (parameter_id)
    REFERENCES lab_test_parameters(parameter_id)
) ENGINE=InnoDB;

CREATE TABLE lab_attachments (
  attachment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  result_id INT UNSIGNED NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_attachments_result
    FOREIGN KEY (result_id)
    REFERENCES lab_result_headers(result_id)
    ON DELETE CASCADE
) ENGINE=InnoDB;








-- ALTER TABLE appointments
-- ADD COLUMN reminder_sent TINYINT(1) DEFAULT 0,
-- ADD COLUMN reminder_sent_at DATETIME NULL;

-- ADD COLUMN reminder_channel ENUM('email','sms') DEFAULT 'email';

--  "username": b"jonathanroumie3040@gmail.com",
-- "password": b"kkea rrpc owys amor ",