// Shared copy and link targets for the public website.

/**
 * Specialties for the hero search and the footer. `label` is what visitors read;
 * `value` is what /patient/book?specialty= receives. Booking matches doctors with
 * `specialty ilike '%value%'` and doctors type their specialty freely, so values are
 * the part most spellings share ("Paediatric" matches Paediatrics and Paediatrician;
 * "Obstetric" matches "Obstetrics & Gynaecology" and "Obstetrics and Gynaecology").
 * Hospitals without a match are still listed ("General doctors"), so no link is a dead end.
 */
export interface Specialty {
  label: string;
  value: string;
  /** Extra words that should find it in the search box. */
  keywords?: string;
}

export const SPECIALTIES: Specialty[] = [
  { label: "General practice", value: "General Practice", keywords: "gp family doctor general medicine" },
  { label: "Paediatrics", value: "Paediatric", keywords: "child children baby kids pediatrics" },
  { label: "Obstetrics & gynaecology", value: "Obstetric", keywords: "pregnancy antenatal obgyn women" },
  { label: "Internal medicine", value: "Internal Medicine", keywords: "physician adult" },
  { label: "Dermatology", value: "Dermatology", keywords: "skin rash acne" },
  { label: "Psychiatry", value: "Psychiatry", keywords: "mental health anxiety depression" },
  { label: "Cardiology", value: "Cardiology", keywords: "heart blood pressure" },
  { label: "ENT", value: "ENT", keywords: "ear nose throat" },
  { label: "Gynaecology", value: "Gynaecology", keywords: "women" },
  { label: "Ophthalmology", value: "Ophthalmology", keywords: "eye vision" },
  { label: "Dentistry", value: "Dentistry", keywords: "teeth dental" },
  { label: "Neurology", value: "Neurology", keywords: "brain headache nerves" },
  { label: "Urology", value: "Urology", keywords: "kidney bladder" },
  { label: "Gastroenterology", value: "Gastroenterology", keywords: "stomach gut digestion" },
  { label: "Pulmonology", value: "Pulmonology", keywords: "lungs chest breathing" },
  { label: "Endocrinology", value: "Endocrinology", keywords: "diabetes hormones thyroid" },
  { label: "General surgery", value: "Surgery", keywords: "surgeon operation" },
];

/** The eight shown in the footer, in the brief's order. */
export const FOOTER_SPECIALTIES = SPECIALTIES.slice(0, 8);

export function bookPath(specialty: string) {
  return `/patient/book?specialty=${encodeURIComponent(specialty)}`;
}

export function triagePath(complaint?: string) {
  return complaint ? `/patient/triage?complaint=${encodeURIComponent(complaint)}` : "/patient/triage";
}

/** Common reasons for a visit. Each opens the triage assistant with the reason filled in. */
export const REASONS = [
  "Fever or malaria symptoms",
  "Cough or cold",
  "Child unwell",
  "Pregnancy care",
  "Skin problem",
  "Blood pressure",
  "Diabetes check",
  "Mental health",
];

export const EMERGENCY_LINE = "If this is an emergency, call 112 or go to the nearest hospital.";

export const SUPPORT_EMAIL = "support.healingnet@gmail.com";

export const SITE_URL = "https://healingnet-08830d77.vercel.app";

// Hospital free trial (the rules live in the app; this only describes them).
export const TRIAL_INCLUDES = [
  "Patient registration and records",
  "Patient queue and check-in",
  "Electronic medical records: notes, history, examination, diagnosis",
  "In-person appointments and doctors' schedules",
  "Laboratory: test requests and results",
  "Pharmacy: inventory and dispensing",
  "Prescriptions and medical letters",
  "Billing and payments",
  "Insurance claims",
  "Maternity and surgery records",
  "Beds and wards",
  "Referrals",
  "Staff invites, and inviting doctors to your hospital",
  "Reports and analytics",
];

export const TELEMEDICINE_ONLY = [
  "Video consultations (patients can't book video visits at your hospital during the trial)",
  "Consultation requests between hospitals",
  "The doctor marketplace",
];

export const TEAM_LIMIT_EMR = "Up to 25 team members (staff and doctors)";
export const TEAM_LIMIT_TELE = "Unlimited team members";
