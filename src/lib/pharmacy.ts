// Shared types and helpers for the pharmacy network (prescription documents,
// pharmacy accounts, requests and fees). Every write goes through a database
// function; these are the shapes those functions return.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta",
  "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT (Abuja)", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina",
  "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers",
  "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;

// ---- Money: stored in kobo, shown in naira -----------------------------------
const NGN = new Intl.NumberFormat("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
export function formatKobo(kobo: number | string | null | undefined): string {
  const n = Number(kobo);
  if (kobo === null || kobo === undefined || !Number.isFinite(n)) return "—";
  return "₦" + NGN.format(n / 100);
}
/** "2,500" / "2500.50" → 250050. Returns null for blank or invalid input. */
export function nairaToKobo(input: string): number | null {
  const clean = input.replace(/[₦,\s]/g, "");
  if (!clean || !/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  return Math.round(Number(clean) * 100);
}

// ---- Dates --------------------------------------------------------------------
export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "—" : t.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}
export function fmtDateTime(d: string | null | undefined): string {
  if (!d) return "—";
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? "—" : t.toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}
export function ageFrom(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - b.getFullYear();
  if (now.getMonth() < b.getMonth() || (now.getMonth() === b.getMonth() && now.getDate() < b.getDate())) a--;
  return a >= 0 ? a : null;
}
/** "34 y, female" with missing parts left out; "" when nothing is known. */
export function ageGender(dob: string | null | undefined, gender: string | null | undefined): string {
  const a = ageFrom(dob);
  return [a !== null ? `${a} y` : null, gender || null].filter(Boolean).join(", ");
}

// ---- Prescription documents -------------------------------------------------------
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

/** Short label for a document's status, as shown on cards and the print page. */
export function rxStatusLabel(doc: Pick<RxPayload, "status" | "expires_at">): string {
  switch (doc.status) {
    case "valid": return `Valid until ${fmtDate(doc.expires_at)}`;
    case "expired": return `Expired ${fmtDate(doc.expires_at)}`;
    case "used": return "Dispensed";
    case "cancelled": return "Cancelled";
    case "not_valid": return "Hospital record only";
    default: return "Not found";
  }
}
export const NOT_VALID_TEXT = "Hospital record only: not valid at outside pharmacies";

/** Why one medicine can't be dispensed (for a disabled row). */
export function notDispensableReason(it: RxItem): string {
  if (!it.doctor_issued) return NOT_VALID_TEXT;
  if (it.status === "cancelled") return "Cancelled by the doctor";
  if (it.remaining <= 0 || it.status === "completed") return "Already dispensed (no refills left)";
  if (it.status !== "active") return `Status: ${it.status}`;
  return "Can't be dispensed";
}

export const verifyUrl = (code: string) => `${window.location.origin}/verify/${encodeURIComponent(code)}`;

// ---- Pharmacy accounts --------------------------------------------------------------
export interface MyPharmacy {
  member: {
    id: string;
    first_name: string;
    last_name: string;
    role: "owner" | "pharmacist" | "assistant";
    pcn_reg_no: string | null;
    licence_expiry: string | null;
    verification_status: "pending" | "approved" | "rejected";
    review_note: string | null;
    is_active: boolean;
    can_dispense: boolean;
  };
  pharmacy: {
    id: string;
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    phone: string | null;
    email: string | null;
    premises_licence_no: string | null;
    premises_licence_expiry: string | null;
    superintendent_name: string | null;
    superintendent_pcn_no: string | null;
    verification_status: "pending" | "approved" | "rejected" | "suspended";
    review_note: string | null;
    is_listed: boolean;
    paused_reason: string | null;
    join_code: string | null;
  };
}

export const MY_PHARMACY_KEY = ["pharmacy", "me"] as const;

export async function fetchMyPharmacy(): Promise<MyPharmacy | null> {
  const { data, error } = await supabase.rpc("my_pharmacy");
  if (error) throw error;
  return (data as unknown as MyPharmacy | null) ?? null;
}

export function useMyPharmacy(enabled = true) {
  return useQuery({ queryKey: MY_PHARMACY_KEY, queryFn: fetchMyPharmacy, enabled, staleTime: 60_000, meta: { inlineError: true } });
}

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
