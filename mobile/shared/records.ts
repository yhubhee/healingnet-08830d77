// Medical records (src/pages/patient/MedicalRecords.tsx) and letters
// (src/pages/patient/Letters.tsx): row shapes, wording and the printable letter.
import { fmtLongDate } from "./dates";

// ---- Medical records --------------------------------------------------------------------
export interface EmrEntry {
  id: string;
  entry_type: string;
  title: string;
  content: string | null;
  created_at: string;
  vital_data: Record<string, unknown> | null;
  doctors: { first_name: string; last_name: string } | null;
  hospitals: { name: string } | null;
}

const ENTRY_LABEL: Record<string, string> = {
  consultation_note: "Consultation", consultation: "Consultation", vitals: "Vitals", diagnosis: "Diagnosis", procedure: "Procedure",
  lab_order: "Lab order", lab_result: "Lab result", imaging: "Imaging", referral: "Referral", discharge_summary: "Discharge summary",
  surgery_note: "Surgery note", antenatal: "Antenatal", delivery: "Delivery", postnatal: "Postnatal",
  prescription: "Prescription", immunization: "Immunisation",
};
/** The entry type in plain words; an unknown type is shown as written, with spaces. */
export const entryTypeLabel = (type: string) => ENTRY_LABEL[type] ?? (type ? type.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase()) : "Record");

export const entryDoctor = (e: Pick<EmrEntry, "doctors">) => (e.doctors ? `Dr. ${e.doctors.first_name} ${e.doctors.last_name}` : null);

/** The vitals the website shows, in the same order and units. */
export function vitalsList(v: Record<string, unknown> | null | undefined): { label: string; value: string }[] {
  if (!v) return [];
  const has = (k: string) => v[k] !== null && v[k] !== undefined && v[k] !== "" && v[k] !== 0;
  const out: { label: string; value: string }[] = [];
  if (has("systolic") && has("diastolic")) out.push({ label: "Blood pressure", value: `${v.systolic}/${v.diastolic}` });
  if (has("heart_rate")) out.push({ label: "Heart rate", value: `${v.heart_rate} bpm` });
  if (has("temperature")) out.push({ label: "Temperature", value: `${v.temperature}°C` });
  if (has("oxygen_saturation")) out.push({ label: "Oxygen level", value: `${v.oxygen_saturation}%` });
  if (has("respiratory_rate")) out.push({ label: "Breathing rate", value: `${v.respiratory_rate} /min` });
  if (has("blood_glucose")) out.push({ label: "Blood sugar", value: `${v.blood_glucose} mg/dL` });
  if (has("weight")) out.push({ label: "Weight", value: `${v.weight} kg` });
  return out;
}

// ---- Letters ----------------------------------------------------------------------------
export interface Letter {
  id: string;
  letter_type: string;
  title: string;
  body: string;
  status: string;
  issued_at: string;
  valid_until: string | null;
  pdf_url: string | null;
  doctors: { first_name: string; last_name: string; specialty: string | null } | null;
  hospitals: { name: string; address: string | null } | null;
}

const LETTER_LABEL: Record<string, string> = {
  fit_to_work: "Fit-to-Work / Fit-to-Travel Letter",
  pregnancy_maternity: "Pregnancy & Maternity Letter",
  sick_leave: "Sick Leave Letter",
  excuse_of_duty: "Excuse of Duty Letter",
  vaccination_record: "Vaccination Record",
  lab_report: "Laboratory Report",
};
export const letterLabel = (l: Pick<Letter, "letter_type" | "title">) => LETTER_LABEL[l.letter_type] ?? l.title;
export const letterDoctor = (l: Pick<Letter, "doctors">) => (l.doctors ? `Dr. ${l.doctors.first_name} ${l.doctors.last_name}` : null);

export type LetterStatus = "issued" | "pending" | "expired";
/** As on the website: a letter past its "valid until" date counts as expired. */
export function letterStatus(l: Pick<Letter, "status" | "valid_until">, now: Date = new Date()): LetterStatus {
  if (l.valid_until && new Date(l.valid_until) < now) return "expired";
  return l.status === "pending" || l.status === "expired" ? l.status : "issued";
}
export const LETTER_STATUS_TEXT: Record<LetterStatus, string> = { issued: "Issued", pending: "Requested: waiting for your doctor", expired: "Expired" };

// ---- Requesting a letter (src/components/patient/RequestLetterDialog.tsx) ----------------
/** The letters a patient can ask for (the website's LETTER_TYPES; a lab report is not requested this way). */
export const LETTER_TYPES = [
  { value: "fit_to_work", label: "Fit-to-Work / Fit-to-Travel Letter" },
  { value: "pregnancy_maternity", label: "Pregnancy & Maternity Letter" },
  { value: "sick_leave", label: "Sick Leave Letter" },
  { value: "excuse_of_duty", label: "Excuse of Duty Letter" },
  { value: "vaccination_record", label: "Vaccination Record" },
] as const;
export const ANY_DOCTOR = "any";
export const LETTER_REQUEST_NEEDS_REASON = "Please describe what you need the letter for";
export const LETTER_REQUEST_SENT = "Request submitted — your doctor will review it";

/** The patient_letters row for a request: exactly what the website inserts. */
export function letterRequestRow(input: { patientId: string; doctorId: string; hospitalId: string | null; letterType: string; notes: string; now: Date }) {
  const def = LETTER_TYPES.find((l) => l.value === input.letterType) ?? LETTER_TYPES[0];
  return {
    patient_id: input.patientId,
    doctor_id: input.doctorId === ANY_DOCTOR ? null : input.doctorId,
    hospital_id: input.doctorId === ANY_DOCTOR ? null : input.hospitalId,
    letter_type: def.value,
    title: `Request: ${def.label}`,
    body: input.notes,
    status: "pending",
    issued_at: input.now.toISOString().slice(0, 10),
  };
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The letter as a printable page: the same parts, in the same order, as the website's PDF. */
export function letterHtml(l: Letter): string {
  const hospital = l.hospitals?.name || "HealingNet";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(l.title || letterLabel(l))}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #171717; background: #fff; margin: 0; }
  h1 { font-size: 22px; margin: 0; } h2 { font-size: 17px; margin: 22px 0 8px; } p { margin: 0; }
  .head { border-bottom: 1px solid #a3a3a3; padding-bottom: 12px; }
  .meta { display: flex; justify-content: space-between; gap: 16px; font-size: 12px; color: #404040; margin-bottom: 18px; }
  .body { white-space: pre-wrap; }
  .sign { margin-top: 40px; }
</style></head>
<body>
  <div class="head"><h1>${esc(hospital)}</h1>${l.hospitals?.address ? `<p>${esc(l.hospitals.address)}</p>` : ""}</div>
  <h2>${esc(l.title || letterLabel(l))}</h2>
  <div class="meta"><span>Issued: ${esc(fmtLongDate(l.issued_at))}</span>${l.valid_until ? `<span>Valid until: ${esc(fmtLongDate(l.valid_until))}</span>` : ""}</div>
  <p class="body">${esc(l.body)}</p>
  <div class="sign"><p>Sincerely,</p><p style="margin-top:28px"><strong>${esc(letterDoctor(l) ?? "Issuing Physician")}</strong></p>${l.doctors?.specialty ? `<p>${esc(l.doctors.specialty)}</p>` : ""}</div>
</body></html>`;
}
