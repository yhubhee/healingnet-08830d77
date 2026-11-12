// Prescription document and pharmacy-request shapes, as the database functions return them.
// Copied from the website (src/lib/pharmacy.ts); the labels must stay the same.
import { fmtLongDate } from "./dates";

export function formatKobo(kobo: number | string | null | undefined): string {
  const n = Number(kobo);
  if (kobo === null || kobo === undefined || !Number.isFinite(n)) return "—";
  const naira = Math.round(n) / 100;
  const [whole, frac] = naira.toFixed(2).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return "₦" + grouped + (frac === "00" ? "" : "." + frac.replace(/0$/, ""));
}

export function ageFrom(dob: string | null | undefined, now: Date = new Date()): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return a >= 0 ? a : null;
}
/** "34 y, female" with missing parts left out; "" when nothing is known. */
export function ageGender(dob: string | null | undefined, gender: string | null | undefined): string {
  const a = ageFrom(dob);
  return [a !== null ? `${a} y` : null, gender || null].filter(Boolean).join(", ");
}

export type RxStatus = "valid" | "expired" | "used" | "cancelled" | "not_valid" | "not_found";

export interface RxItem {
  prescription_id: string;
  drug_name: string;
  dosage: string | null;
  frequency: string | null;
  duration: string | null;
  instructions: string | null;
  refills_allowed: number;
  times_dispensed: number;
  remaining: number;
  status: string;
  doctor_issued: boolean;
  dispensable: boolean;
}
export interface RxDispense {
  prescription_id: string;
  pharmacy: string;
  pharmacist: string;
  pcn_reg_no: string;
  quantity: string | null;
  is_refill: boolean;
  at: string;
}
export interface RxPrescriber {
  name?: string | null;
  doctor_name?: string | null;
  licence_number?: string | null;
  licence_council?: string | null;
  doctor_verified?: boolean;
  practice_address?: string | null;
  phone?: string | null;
  hospital_name?: string | null;
  hospital_address?: string | null;
  hospital_phone?: string | null;
}
export interface RxPayload {
  status: RxStatus;
  code?: string;
  issued_at?: string;
  expires_at?: string;
  prescriber?: RxPrescriber;
  hospital_name?: string | null;
  full?: boolean;
  document_id?: string;
  signature_data?: string | null;
  patient?: { name: string; date_of_birth: string | null; gender: string | null };
  items?: RxItem[];
  dispenses?: RxDispense[];
}
export const prescriberName = (p?: RxPrescriber) => (p?.doctor_name ?? p?.name ?? "").trim() || "Unknown doctor";

/** Short label for a document's status, as shown on cards and the PDF. */
export function rxStatusLabel(doc: Pick<RxPayload, "status" | "expires_at">): string {
  switch (doc.status) {
    case "valid": return `Valid until ${fmtLongDate(doc.expires_at)}`;
    case "expired": return `Expired ${fmtLongDate(doc.expires_at)}`;
    case "used": return "Dispensed";
    case "cancelled": return "Cancelled";
    case "not_valid": return "Hospital record only";
    default: return "Not found";
  }
}
export const NOT_VALID_TEXT = "Hospital record only: not valid at outside pharmacies";

export type RequestStatus = "sent" | "available" | "partial" | "unavailable" | "collected" | "cancelled";
export const OPEN_REQUEST: RequestStatus[] = ["sent", "available", "partial"];
export const REQUEST_LABEL: Record<RequestStatus, string> = {
  sent: "Waiting for reply",
  available: "Available",
  partial: "Partly available",
  unavailable: "Not available",
  collected: "Collected",
  cancelled: "Cancelled",
};
export interface RxRequest {
  id: string;
  rx_document_id: string;
  patient_id: string;
  pharmacy_id: string;
  status: RequestStatus;
  patient_note: string | null;
  pharmacy_note: string | null;
  price_kobo: number | null;
  ready_by: string | null;
  responded_at: string | null;
  collected_at: string | null;
  created_at: string;
  updated_at: string;
}
export type PatientRequest = RxRequest & { pharmacies: { name: string } | null };

export type CheckResult = "genuine" | "not_found" | "suspected_fake";
export const CHECK_LABEL: Record<CheckResult, string> = { genuine: "Genuine", not_found: "Not found", suspected_fake: "Looks fake" };
export const FAKE_THANKS = "Thank you. HealingNet will review this. You can also report to NAFDAC directly.";
export const NAFDAC_GREENBOOK = "https://greenbook.nafdac.gov.ng";

/** What the patient should do next with a prescription, for the Home card. */
export function rxNextAction(doc: RxPayload, requests: PatientRequest[]): string {
  const mine = requests.filter((r) => r.rx_document_id === doc.document_id);
  const ready = mine.find((r) => r.status === "available" || r.status === "partial");
  if (ready) return `Ready at ${ready.pharmacies?.name ?? "the pharmacy"}. Pay at the counter when you collect.`;
  if (mine.some((r) => r.status === "sent")) return "Waiting for the pharmacy to reply.";
  return "Show the code at a pharmacy, or send it to one near you.";
}

/** Colour family for a prescription's status chip (the chip always shows the words too). */
export const RX_TONE: Record<RxStatus, "success" | "warning" | "danger" | "neutral"> = {
  valid: "success", expired: "danger", used: "neutral", cancelled: "danger", not_valid: "warning", not_found: "neutral",
};
export const REQUEST_TONE: Record<RequestStatus, "success" | "warning" | "danger" | "neutral" | "primary"> = {
  sent: "primary", available: "success", partial: "warning", unavailable: "danger", collected: "neutral", cancelled: "neutral",
};
