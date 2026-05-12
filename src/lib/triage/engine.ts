// Rule-based triage engine. Severity scored 1-10.
export type Symptom = string;

interface Rule {
  match: (s: Set<Symptom>, free: string) => boolean;
  specialty: string;
  weight: number; // added to severity
  redFlag?: boolean;
}

const has = (s: Set<string>, ...keys: string[]) => keys.some((k) => s.has(k));
const text = (free: string, ...keys: string[]) =>
  keys.some((k) => free.toLowerCase().includes(k));

const RULES: Rule[] = [
  // Cardiac red flags
  { match: (s, f) => has(s, "Chest pain") && (has(s, "Sweating", "Shortness of breath") || text(f, "left arm", "radiating")), specialty: "Cardiology", weight: 9, redFlag: true },
  { match: (s) => has(s, "Chest pain"), specialty: "Cardiology", weight: 6 },
  { match: (s) => has(s, "Palpitations"), specialty: "Cardiology", weight: 4 },
  // Stroke
  { match: (s, f) => text(f, "slurred", "face droop", "weakness one side", "stroke"), specialty: "Neurology", weight: 10, redFlag: true },
  // Neurology
  { match: (s) => has(s, "Severe headache"), specialty: "Neurology", weight: 6 },
  { match: (s) => has(s, "Headache"), specialty: "General Practice", weight: 2 },
  // Respiratory
  { match: (s) => has(s, "Shortness of breath"), specialty: "Pulmonology", weight: 7 },
  { match: (s) => has(s, "Cough") && has(s, "Fever"), specialty: "General Practice", weight: 4 },
  { match: (s) => has(s, "Cough"), specialty: "General Practice", weight: 2 },
  // GI
  { match: (s) => has(s, "Vomiting") && has(s, "Bleeding"), specialty: "Gastroenterology", weight: 8, redFlag: true },
  { match: (s) => has(s, "Vomiting"), specialty: "General Practice", weight: 3 },
  { match: (s) => has(s, "Abdominal pain"), specialty: "Gastroenterology", weight: 4 },
  // Obstetrics
  { match: (s, f) => (has(s, "Bleeding") && text(f, "pregnan")) || text(f, "labour", "labor pain"), specialty: "Obstetrics", weight: 9, redFlag: true },
  // Skin
  { match: (s) => has(s, "Rash"), specialty: "Dermatology", weight: 2 },
  // Ortho
  { match: (s, f) => text(f, "fracture", "broken bone"), specialty: "Orthopedics", weight: 7 },
  { match: (s) => has(s, "Joint pain", "Back pain"), specialty: "Orthopedics", weight: 3 },
  // ENT
  { match: (s) => has(s, "Ear pain", "Sore throat"), specialty: "ENT", weight: 2 },
  // Mental health
  { match: (s, f) => text(f, "suicid", "self harm"), specialty: "Psychiatry", weight: 10, redFlag: true },
  // Default
  { match: (s) => has(s, "Fever"), specialty: "General Practice", weight: 3 },
];

export const SYMPTOM_CHIPS = [
  "Fever", "Cough", "Chest pain", "Shortness of breath", "Palpitations",
  "Headache", "Severe headache", "Abdominal pain", "Vomiting", "Bleeding",
  "Rash", "Joint pain", "Back pain", "Ear pain", "Sore throat", "Sweating",
];

export type Urgency = "routine" | "soon" | "urgent" | "emergency";

export interface TriageResult {
  severity: number; // 1-10
  specialty: string;
  urgency: Urgency;
  redFlag: boolean;
  guidance: string;
  matchedRules: string[];
}

export function runTriage(opts: {
  symptoms: Symptom[];
  freeText?: string;
  duration?: string; // 'today' | 'few_days' | 'weeks'
  selfSeverity?: number; // 1-10
}): TriageResult {
  const set = new Set(opts.symptoms);
  const free = opts.freeText || "";
  let weight = 0;
  let specialty = "General Practice";
  let bestWeight = 0;
  let redFlag = false;
  const matched: string[] = [];

  for (const r of RULES) {
    if (r.match(set, free)) {
      weight += r.weight;
      if (r.weight > bestWeight) {
        bestWeight = r.weight;
        specialty = r.specialty;
      }
      if (r.redFlag) redFlag = true;
      matched.push(`${r.specialty}+${r.weight}`);
    }
  }

  // Duration adjustment
  if (opts.duration === "weeks") weight += 1;
  if (opts.duration === "today") weight += 1;

  // Self-rated severity blend
  const self = opts.selfSeverity ?? 0;
  const blended = Math.round(weight * 0.7 + self * 0.6);
  const severity = Math.max(1, Math.min(10, blended || self || 1));

  const urgency: Urgency =
    redFlag || severity >= 9 ? "emergency"
      : severity >= 7 ? "urgent"
      : severity >= 4 ? "soon"
      : "routine";

  const guidance =
    urgency === "emergency" ? "⚠️ Seek emergency care immediately. Call your nearest hospital or go to A&E now."
    : urgency === "urgent" ? "Book an appointment within 24 hours. Do not delay."
    : urgency === "soon" ? "Book an appointment within the next few days."
    : "Routine care — book at your convenience.";

  return { severity, specialty, urgency, redFlag, guidance, matchedRules: matched };
}
