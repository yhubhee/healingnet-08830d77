// Columns the app may send on writes; the database rejects anything else.
export function pick<T extends Record<string, any>>(obj: T, keys: readonly string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of keys) if (k in obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export const ALLOWED = {
  checkinUpdate: ["assigned_doctor_id", "called_time", "checkin_type", "consultation_end", "consultation_start", "department", "notes", "queue_number", "status", "urgency", "vitals"],
  appointmentInsert: ["doctor_id", "hospital_id", "is_telemedicine", "notes", "patient_id", "reason", "requested_date", "requested_time", "status"],
  appointmentUpdate: ["consultation_notes", "doctor_id", "is_telemedicine", "notes", "reason", "requested_date", "requested_time", "status"],
  consultationRequestInsert: ["doctor_id", "patient_id", "patient_summary", "preferred_date", "preferred_time", "reason", "request_type", "requesting_hospital_id", "specialty_needed", "urgency"],
  consultationRequestUpdate: ["doctor_notes", "fee_agreed", "patient_summary", "preferred_date", "preferred_time", "reason", "request_type", "specialty_needed", "status", "urgency"],
  consultationUpdate: ["advice_plan", "final_diagnosis", "follow_up_date", "provisional_diagnosis"],
  hospitalDoctorInsert: ["contract_end", "contract_start", "department", "doctor_id", "employment_type", "hospital_id", "is_active", "notes", "status"],
  hospitalStaffInsert: ["department", "email", "first_name", "hospital_id", "is_active", "last_name", "phone", "profile_image_url", "role", "user_id"],
  doctorUpdate: ["bio", "first_name", "is_available", "last_name", "phone", "profile_image_url", "specialty", "years_experience"],
  hospitalUpdate: ["address", "city", "email", "lat", "license_number", "lng", "logo_url", "name", "phone", "state"],
  patientUpdate: ["first_name", "last_name", "phone", "email", "date_of_birth", "gender", "blood_group", "genotype", "address", "city", "state", "emergency_contact_name", "emergency_contact_phone", "insurance_provider", "insurance_policy_number", "profile_image_url", "status"],
  letterUpdate: ["title", "body", "issued_at", "valid_until", "status", "pdf_url", "letter_type"],
  patientRegister: ["first_name", "last_name", "phone", "email", "date_of_birth", "gender", "blood_group", "genotype", "address", "city", "state", "emergency_contact_name", "emergency_contact_phone", "insurance_provider", "insurance_policy_number"],
} as const;
