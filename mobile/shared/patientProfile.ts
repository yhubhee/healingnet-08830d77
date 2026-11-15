// Copied from the website (src/lib/patientProfile.ts and src/lib/allowed.ts): what a patient
// profile needs before the app opens, and Nigerian phone checks. Keep the files the same.

export const PATIENT_REQUIRED = [
  "phone", "date_of_birth", "gender", "state", "city", "address", "emergency_contact_name", "emergency_contact_phone",
] as const;
export type PatientRequired = (typeof PATIENT_REQUIRED)[number];

type PatientLike = Partial<Record<PatientRequired, string | null>> | null | undefined;

export function missingPatientFields(p: PatientLike): PatientRequired[] {
  if (!p) return [...PATIENT_REQUIRED];
  return PATIENT_REQUIRED.filter((k) => !String(p[k] ?? "").trim());
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

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const GENOTYPES = ["AA", "AS", "AC", "SS", "SC", "CC"];

/** Columns a patient may send when updating their own profile; the database rejects anything else. */
export const PATIENT_UPDATE_COLUMNS = [
  "first_name", "last_name", "phone", "email", "date_of_birth", "gender", "blood_group", "genotype", "address", "city",
  "state", "emergency_contact_name", "emergency_contact_phone", "insurance_provider", "insurance_policy_number",
  "profile_image_url", "status", "allergies", "medical_conditions",
] as const;

export function pick<T extends Record<string, unknown>>(obj: T, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}

export interface ProfileForm {
  phone: string; date_of_birth: string; gender: string; state: string; city: string; address: string;
  emergency_contact_name: string; emergency_contact_phone: string;
  blood_group: string; genotype: string; insurance_provider: string; insurance_policy_number: string;
  allergies: string; medical_conditions: string;
}

/** The database allows up to 500 characters for allergies and for long-term conditions. */
export const HEALTH_NOTE_MAX = 500;
/** What the health card shows when nothing has been written. */
export const NONE_KNOWN = "None known";
export const healthNote = (v: string | null | undefined) => (v ?? "").trim() || NONE_KNOWN;
export type ProfileErrors = Partial<Record<keyof ProfileForm, string>>;

/** "3 of 8 done": how many of the required details are filled in and valid so far. */
export function profileProgress(f: ProfileForm, today: string): { done: number; total: number; text: string } {
  const errors = validateProfile(f, today);
  const total = PATIENT_REQUIRED.length;
  const done = PATIENT_REQUIRED.filter((k) => !errors[k]).length;
  return { done, total, text: `${done} of ${total} done` };
}

/** The same checks and messages as the website's Complete profile page. */
export function validateProfile(f: ProfileForm, today: string): ProfileErrors {
  const e: ProfileErrors = {};
  if (!f.phone.trim()) e.phone = "Enter your phone number.";
  else if (!isNigerianPhone(f.phone)) e.phone = "Enter a Nigerian number, e.g. 0803 123 4567 or +234 803 123 4567.";
  if (!f.date_of_birth) e.date_of_birth = "Enter your date of birth.";
  else if (f.date_of_birth > today) e.date_of_birth = "Your date of birth can't be in the future.";
  else if (f.date_of_birth < "1900-01-01") e.date_of_birth = "Check the year.";
  if (!f.gender) e.gender = "Choose your gender.";
  if (!f.state) e.state = "Choose your state.";
  if (!f.city.trim()) e.city = "Enter your city or town.";
  if (!f.address.trim()) e.address = "Enter your address.";
  if (!f.emergency_contact_name.trim()) e.emergency_contact_name = "Enter a name.";
  if (!f.emergency_contact_phone.trim()) e.emergency_contact_phone = "Enter a phone number.";
  else if (!isNigerianPhone(f.emergency_contact_phone)) e.emergency_contact_phone = "Enter a Nigerian number, e.g. 0803 123 4567.";
  if (f.allergies.trim().length > HEALTH_NOTE_MAX) e.allergies = `Keep this under ${HEALTH_NOTE_MAX} characters.`;
  if (f.medical_conditions.trim().length > HEALTH_NOTE_MAX) e.medical_conditions = `Keep this under ${HEALTH_NOTE_MAX} characters.`;
  return e;
}
