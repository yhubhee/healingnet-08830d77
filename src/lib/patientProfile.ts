// What a patient profile needs before the portal opens, and Nigerian phone checks.

export const PATIENT_REQUIRED = [
  "phone", "date_of_birth", "gender", "state", "city", "address", "emergency_contact_name", "emergency_contact_phone",
] as const;
export type PatientRequired = (typeof PATIENT_REQUIRED)[number];

export const PATIENT_FIELD_LABEL: Record<PatientRequired, string> = {
  phone: "phone number",
  date_of_birth: "date of birth",
  gender: "gender",
  state: "state",
  city: "city",
  address: "address",
  emergency_contact_name: "emergency contact name",
  emergency_contact_phone: "emergency contact phone",
};

type PatientLike = Partial<Record<PatientRequired, string | null>> | null | undefined;

export function missingPatientFields(p: PatientLike): PatientRequired[] {
  if (!p) return [...PATIENT_REQUIRED];
  return PATIENT_REQUIRED.filter((k) => !String(p[k] ?? "").trim());
}

/** Share of required fields filled in, 0–100. */
export function patientCompleteness(p: PatientLike): number {
  const missing = missingPatientFields(p).length;
  return Math.round(((PATIENT_REQUIRED.length - missing) / PATIENT_REQUIRED.length) * 100);
}

/** Spaces, dashes and brackets removed: "0803 123 4567" -> "08031234567". */
export const compactPhone = (s: string) => s.replace(/[\s\-().]/g, "");

/** Nigerian mobile or landline: 0 + 10 digits (11 digits locally), or +234 + 10 digits. */
export function isNigerianPhone(s: string): boolean {
  const v = compactPhone(s);
  return /^0[1-9]\d{9}$/.test(v) || /^\+234[1-9]\d{9}$/.test(v);
}

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi",
  "Edo", "Ekiti", "Enugu", "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];
