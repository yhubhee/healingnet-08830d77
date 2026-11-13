// Check symptoms: the pure logic of the website's triage page (src/pages/patient/Triage.tsx
// and src/components/triage/*), copied so the app asks, saves and words things the same way.
// The questions and the result come from the triage-nurse function; nothing is decided here
// except how an answer is sent back and when the emergency card must show.

export type Sex = "male" | "female";
export interface Evidence { id: string; name: string; present: boolean }
export interface Question {
  id: string;
  text: string;
  explanation?: string;
  type?: "boolean" | "multiple_choice" | "scale" | "duration" | "open_text";
  options?: string[];
  unit?: string;
}
export interface Condition { name: string; probability: number; description?: string }
export interface NurseResponse {
  new_evidence?: Evidence[];
  next_question?: Question;
  should_stop: boolean;
  differential: Condition[];
  severity_score?: number;
  triage_level: string;
  triage_label: string;
  recommended_specialty: string;
  red_flags?: string[];
  guidance: string;
}

export const MAX_QUESTIONS = 8;
export const MAX_COMPLAINT = 1500;
export const EMERGENCY_NUMBER = "112";

/** Friendly text for triage-nurse HTTP errors (same as the website). */
export const TRIAGE_ERRORS: Record<number, string> = {
  401: "Please sign in again.",
  429: "Too many requests. Wait a minute.",
  400: "Something in your answers couldn't be read. Please try again.",
};
export const TRIAGE_UNAVAILABLE = "The triage service is unavailable right now.";
export const triageErrorText = (status: number) => TRIAGE_ERRORS[status] ?? TRIAGE_UNAVAILABLE;

/** Whole years from a "YYYY-MM-DD" date of birth (the website's sum). */
export function ageFromDob(dob: string | null | undefined, now: Date = new Date()): number | null {
  if (!dob) return null;
  const t = new Date(dob).getTime();
  if (Number.isNaN(t)) return null;
  const years = Math.floor((now.getTime() - t) / (365.25 * 864e5));
  return years >= 0 && years <= 130 ? years : null;
}

/**
 * The evidence list after an answer. A yes/no question records present or absent, and
 * "I don't know" records nothing; every other kind records "question: answer" as present.
 */
export function addAnswer(evidence: Evidence[], q: Question, value: string | number): Evidence[] {
  if ((q.type ?? "boolean") === "boolean") {
    if (value === "unknown") return evidence;
    return [...evidence, { id: q.id, name: q.text, present: value === "yes" }];
  }
  return [...evidence, { id: q.id, name: `${q.text}: ${value}`, present: true }];
}

/** After this many questions the interview ends, whatever the service suggests next. */
export const interviewDone = (r: Pick<NurseResponse, "should_stop" | "next_question">, askedCount: number) =>
  r.should_stop || askedCount >= MAX_QUESTIONS || !r.next_question;

// ---- Emergency --------------------------------------------------------------------------
/**
 * Danger answers: the service answers with an emergency level (and stops asking) as soon as
 * a red flag is met. The app then shows the emergency card at once, whatever step it is on.
 */
export const isEmergency = (r: Pick<NurseResponse, "triage_level"> | null | undefined): boolean =>
  !!r && typeof r.triage_level === "string" && r.triage_level.startsWith("emergency");

export const needsAmbulance = (r: Pick<NurseResponse, "triage_level"> | null | undefined) => r?.triage_level === "emergency_ambulance";

// ---- Result wording ---------------------------------------------------------------------
const URGENCY_WORDS: Record<string, string> = {
  self_care: "Self-care",
  consultation: "See a doctor soon",
  consultation_24: "See a doctor within 24 hours",
  emergency_ambulance: "Emergency: call an ambulance",
  emergency: "Emergency: go to a hospital now",
};
/** How urgent it is, in words. */
export const urgencyWords = (level: string) => URGENCY_WORDS[level] ?? "See a doctor";

export type UrgencyTone = "success" | "primary" | "warning" | "danger";
export const urgencyTone = (level: string): UrgencyTone =>
  level.startsWith("emergency") ? "danger" : level === "consultation_24" ? "warning" : level === "self_care" ? "success" : "primary";

// ---- The saved session ------------------------------------------------------------------
/** triage_level -> the urgency the database stores. */
const URGENCY_MAP: Record<string, string> = {
  self_care: "routine", consultation: "soon", consultation_24: "soon", emergency_ambulance: "emergency", emergency: "emergency",
};

/** The triage_sessions row, exactly as the website saves it (severity_self stays null). */
export function sessionRow(input: {
  patientId: string; evidence: Evidence[]; freeText: string; response: NurseResponse; coords: { lat: number; lng: number } | null;
}) {
  const { patientId, evidence, freeText, response: r, coords } = input;
  return {
    patient_id: patientId,
    symptoms: evidence.map((e) => `${e.name}:${e.present ? "yes" : "no"}`).concat(freeText ? [freeText] : []),
    severity_self: null, // 1-10 when known; the interview doesn't collect it as a number
    severity_score: r.severity_score || Math.round((r.differential[0]?.probability || 0.3) * 10),
    recommended_specialty: r.recommended_specialty,
    urgency: URGENCY_MAP[r.triage_level] || "soon",
    recommended_hospitals: r,
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
  };
}

/** The reason pre-filled in the booking flow (same wording as the website). */
export const bookingReason = (r: Pick<NurseResponse, "triage_label" | "recommended_specialty">, freeText: string) =>
  `Triage: ${r.triage_label} (${r.recommended_specialty}). ${freeText}`.trim().slice(0, 500);

// ---- Tap-to-pick answers ----------------------------------------------------------------
/** "How long?" as big choices; each sends "<amount> <unit>" like the website's two boxes. */
export const DURATION_CHOICES: { label: string; value: string }[] = [
  { label: "Less than a day", value: "12 hours" },
  { label: "1 to 2 days", value: "2 days" },
  { label: "3 to 7 days", value: "5 days" },
  { label: "1 to 2 weeks", value: "2 weeks" },
  { label: "2 to 4 weeks", value: "4 weeks" },
  { label: "More than a month", value: "3 months" },
];
export const SCALE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
