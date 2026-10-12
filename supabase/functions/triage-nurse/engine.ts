// Rules-based triage engine (no AI service, no per-request cost).
//
// 1. Reads the patient's own words and picks out symptoms (English, Pidgin and
//    common Yoruba, Igbo and Hausa words), understanding simple negation
//    ("no fever", "I no get cough").
// 2. Checks emergency red flags after every answer and stops at once if one is met.
// 3. Asks how severe and how long, safety-screening questions, then the
//    question that best separates the likely conditions.
// 4. Scores conditions from the answers (a simple Bayesian model over kb.ts)
//    and decides urgency and the specialist to book, never lower than the
//    safety floors.
//
// Pure functions only: no I/O, so it is easy to test (engine_test.ts).
import {
  CONDITIONS,
  type Condition,
  type Ctx,
  FLOORS,
  type Level,
  LEVEL_RANK,
  MAIN_COMPLAINT_OPTIONS,
  RED_FLAGS,
  type RedFlag,
  SCREENS,
  type Sex,
  type Symptom,
  SYMPTOMS,
} from "./kb.ts";

export const ENGINE_VERSION = "rules-v1";
export const MAX_QUESTIONS = 8;
const MAX_SCREENING_QUESTIONS = 3;
const DEFAULT_LIKELIHOOD = 0.03;
/** Background facts (history, pregnancy): unlisted conditions are neutral, listed ones compare against this base rate. */
const CONTEXT_IDS = new Set(["sickle_cell_known", "diabetes_known", "hypertension_known", "asthma_known", "pregnant"]);
const CONTEXT_BASE = 0.1;
const TEMPERATURE = 0.9;
/** Rules can't be certain; never show a match above this. */
const MAX_SHOWN_PROBABILITY = 0.9;

export interface Evidence {
  id: string;
  name: string;
  present: boolean;
}

export interface Question {
  id: string;
  text: string;
  explanation?: string;
  type: "boolean" | "multiple_choice" | "scale" | "duration";
  options?: string[];
  unit?: string;
}

export interface TriageOutput {
  new_evidence?: Evidence[];
  next_question?: Question;
  should_stop: boolean;
  differential: Array<{ name: string; probability: number; description?: string }>;
  severity_score?: number;
  triage_level: Level;
  triage_label: string;
  recommended_specialty: string;
  red_flags: string[];
  guidance: string;
}

export const SYMPTOM_BY_ID = new Map(SYMPTOMS.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------
// Understanding the patient's own words
// ---------------------------------------------------------------------------
const NEGATIONS = new Set([
  "no", "not", "never", "without", "nor", "neither", "none", "nothing", "denies", "deny",
  "dont", "didnt", "doesnt", "havent", "hasnt", "hadnt", "isnt", "wasnt", "arent", "werent",
]);

export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "") // strip accents/tone marks (ìbà -> iba)
    .toLowerCase()
    .replace(/['’`]/g, "") // can't -> cant
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const tokens = (s: string) => normalize(s).split(" ").filter(Boolean);

interface CompiledSymptom {
  symptom: Symptom;
  phrases: string[][];
  combos: Array<[string[][], string[][]]>;
}

const COMPILED: CompiledSymptom[] = SYMPTOMS.map((symptom) => ({
  symptom,
  phrases: symptom.phrases.map(tokens).filter((t) => t.length > 0),
  combos: (symptom.combos ?? []).map(([a, b]) => [a.map(tokens), b.map(tokens)] as [string[][], string[][]]),
}));

function findSeq(words: string[], seq: string[]): number[] {
  const hits: number[] = [];
  outer: for (let i = 0; i + seq.length <= words.length; i++) {
    for (let j = 0; j < seq.length; j++) if (words[i + j] !== seq[j]) continue outer;
    hits.push(i);
  }
  return hits;
}

function negatedBefore(words: string[], start: number): boolean {
  for (let i = Math.max(0, start - 3); i < start; i++) if (NEGATIONS.has(words[i])) return true;
  return false;
}

/** Symptoms mentioned in free text: id -> present (false when negated). */
export function extractSymptoms(freeText: string): Map<string, boolean> {
  const found = new Map<string, boolean>();
  const clauses = freeText.split(/[.,;:!?\n]+|\b(?:but|and|though|however|plus|also)\b/i);

  for (const clause of clauses) {
    const words = tokens(clause);
    if (words.length === 0) continue;

    // Phrases first, longest first. A phrase that sits entirely inside a longer one is skipped
    // ("eye discharge" is not "discharge", "no appetite" is not a negated "appetite"),
    // but phrases that only overlap both count ("red eyes with discharge").
    const candidates: Array<{ id: string; start: number; len: number }> = [];
    for (const c of COMPILED) {
      for (const p of c.phrases) for (const start of findSeq(words, p)) candidates.push({ id: c.symptom.id, start, len: p.length });
    }
    candidates.sort((a, b) => b.len - a.len || a.start - b.start);
    const used = new Array<boolean>(words.length).fill(false);
    const accepted: Array<{ start: number; end: number }> = [];
    const local = new Map<string, boolean>();
    for (const m of candidates) {
      const end = m.start + m.len;
      if (accepted.some((a) => a.start <= m.start && end <= a.end)) continue;
      accepted.push({ start: m.start, end });
      for (let i = m.start; i < end; i++) used[i] = true;
      const present = !negatedBefore(words, m.start);
      if (!local.has(m.id) || present) local.set(m.id, present);
    }

    // Body part + complaint word within 4 words ("my belle dey pain me", "pain in my lower back").
    for (const c of COMPILED) {
      if (local.has(c.symptom.id)) continue;
      for (const [parts, complaints] of c.combos) {
        for (const part of parts) {
          for (const ps of findSeq(words, part)) {
            if (used[ps]) continue;
            for (const comp of complaints) {
              for (const cs of findSeq(words, comp)) {
                if (Math.abs(cs - ps) > 4) continue;
                const first = Math.min(ps, cs);
                const last = Math.max(ps, cs);
                let negated = negatedBefore(words, first);
                for (let i = first + 1; i < last; i++) if (NEGATIONS.has(words[i])) negated = true;
                if (!local.has(c.symptom.id) || !negated) local.set(c.symptom.id, !negated);
              }
            }
          }
        }
      }
    }

    for (const [id, present] of local) if (!found.has(id) || present) found.set(id, present);
  }
  return found;
}

// ---------------------------------------------------------------------------
// Facts from the evidence list the browser sends back
// ---------------------------------------------------------------------------
export function answerValue(e: Evidence): string {
  const i = e.name.lastIndexOf(": ");
  return i >= 0 ? e.name.slice(i + 2).trim() : "";
}

export function parseDurationDays(value: string): number | undefined {
  const m = value.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(hour|day|week|month|year)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  const per: Record<string, number> = { hour: 1 / 24, day: 1, week: 7, month: 30, year: 365 };
  return n * per[m[2]];
}

export function buildCtx(age: number, sex: string, evidence: Evidence[]): Ctx {
  const ctx: Ctx = {
    age,
    sex: sex.toLowerCase() === "male" ? "male" : sex.toLowerCase() === "female" ? "female" : "other",
    present: new Set(),
    absent: new Set(),
  };
  const mark = (id: string, present: boolean) => {
    if (!SYMPTOM_BY_ID.has(id)) return;
    (present ? ctx.absent : ctx.present).delete(id);
    (present ? ctx.present : ctx.absent).add(id);
  };
  for (const e of evidence) {
    if (e.id === "severity") {
      const n = Number(answerValue(e));
      if (Number.isFinite(n)) ctx.severity = Math.min(10, Math.max(1, Math.round(n)));
    } else if (e.id === "duration") {
      ctx.durationDays = parseDurationDays(answerValue(e));
    } else if (e.id === "main_complaint") {
      const opt = MAIN_COMPLAINT_OPTIONS.find((o) => o.label === answerValue(e));
      for (const id of opt?.ids ?? []) mark(id, true);
    } else {
      mark(e.id, e.present);
    }
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------
type Demo = { sex?: Sex; minAge?: number; maxAge?: number };
const fits = (d: Demo, ctx: Ctx) =>
  (!d.sex || ctx.sex === "other" || d.sex === ctx.sex) &&
  (d.minAge === undefined || ctx.age >= d.minAge) &&
  (d.maxAge === undefined || ctx.age <= d.maxAge);

const clampL = (l: number) => Math.min(0.97, Math.max(0.01, l));

function logLikelihood(c: Condition, id: string, present: boolean): number {
  const listed = c.s[id];
  if (CONTEXT_IDS.has(id)) {
    if (listed === undefined) return 0;
    const l = clampL(listed);
    return present ? Math.log(l / CONTEXT_BASE) : Math.log((1 - l) / (1 - CONTEXT_BASE));
  }
  const l = clampL(listed ?? DEFAULT_LIKELIHOOD);
  return Math.log(present ? l : 1 - l);
}

const COURSE_TABLE: Record<Condition["course"], [number, number, number]> = {
  acute: [0.6, 0.35, 0.05],
  subacute: [0.25, 0.55, 0.2],
  chronic: [0.05, 0.25, 0.7],
  any: [0.33, 0.33, 0.34],
};

export interface Scored {
  condition: Condition;
  p: number;
}

export function scoreConditions(ctx: Ctx): Scored[] {
  const fitting = CONDITIONS.filter((c) => fits(c, ctx) && (!c.requires || ctx.present.has(c.requires)));
  // Only compare conditions that explain at least one of the patient's symptoms
  // (a toothache is not compared with a cold). Background facts such as
  // pregnancy count only when nothing else is known.
  const symptoms = [...ctx.present].filter((id) => !CONTEXT_IDS.has(id));
  const anchor = symptoms.length > 0 ? symptoms : [...ctx.present];
  const explaining = anchor.length > 0 ? fitting.filter((c) => anchor.some((id) => c.s[id] !== undefined)) : [];
  const eligible = explaining.length > 0 ? explaining : fitting;
  const logs = eligible.map((c) => {
    let lp = Math.log(c.prior * (ctx.age < 13 ? c.childPrior ?? 1 : 1));
    for (const id of ctx.present) lp += logLikelihood(c, id, true);
    for (const id of ctx.absent) lp += logLikelihood(c, id, false);
    if (ctx.durationDays !== undefined) {
      const bucket = ctx.durationDays < 3 ? 0 : ctx.durationDays <= 14 ? 1 : 2;
      lp += Math.log(COURSE_TABLE[c.course][bucket]);
    }
    return lp * TEMPERATURE;
  });
  const max = Math.max(...logs);
  const exps = logs.map((l) => Math.exp(l - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return eligible.map((condition, i) => ({ condition, p: exps[i] / total })).sort((a, b) => b.p - a.p);
}

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------
export const SEVERITY_QUESTION: Question = {
  id: "severity",
  text: "How bad are your symptoms right now?",
  explanation: "This helps us decide how quickly you should see a doctor.",
  type: "scale",
  options: ["Mild", "Worst imaginable"],
  unit: "1-10 severity",
};

export const DURATION_QUESTION: Question = {
  id: "duration",
  text: "How long have you had these symptoms?",
  explanation: "Some illnesses are more likely the longer symptoms last.",
  type: "duration",
  unit: "days",
};

export const MAIN_COMPLAINT_QUESTION: Question = {
  id: "main_complaint",
  text: "What is bothering you most?",
  explanation: "We couldn't pick out a symptom from your description. Choose the closest match.",
  type: "multiple_choice",
  options: MAIN_COMPLAINT_OPTIONS.map((o) => o.label),
};

const SCREEN_IDS = new Set(SCREENS.flatMap((s) => s.ask));

function symptomQuestion(s: Symptom): Question {
  return { id: s.id, text: s.q, type: "boolean", ...(s.why ? { explanation: s.why } : {}) };
}

function entropy(ps: number[]): number {
  let h = 0;
  for (const p of ps) if (p > 0) h -= p * Math.log2(p);
  return h;
}

function pYes(c: Condition, id: string): number {
  const listed = c.s[id];
  if (listed !== undefined) return clampL(listed);
  return CONTEXT_IDS.has(id) ? CONTEXT_BASE : DEFAULT_LIKELIHOOD;
}

/** The yes/no question that is expected to narrow down the likely conditions the most. */
function mostInformative(ctx: Ctx, scored: Scored[], asked: Set<string>): Symptom | undefined {
  const top = scored.slice(0, 8).filter((s) => s.p > 0.01);
  const mass = top.reduce((a, s) => a + s.p, 0);
  if (top.length < 2 || mass === 0) return undefined;
  const ps = top.map((s) => s.p / mass);
  const h0 = entropy(ps);

  const candidates = new Set<string>();
  for (const s of top) for (const id of Object.keys(s.condition.s)) candidates.add(id);

  let best: { s: Symptom; gain: number } | undefined;
  for (const id of candidates) {
    const sym = SYMPTOM_BY_ID.get(id);
    if (!sym || asked.has(id) || !fits(sym, ctx)) continue;
    const yes = top.map((s, i) => ps[i] * pYes(s.condition, id));
    const py = yes.reduce((a, b) => a + b, 0);
    const no = ps.map((p, i) => p - yes[i]);
    const pn = 1 - py;
    const h1 = (py > 0 ? py * entropy(yes.map((v) => v / py)) : 0) + (pn > 0 ? pn * entropy(no.map((v) => v / pn)) : 0);
    const gain = h0 - h1;
    if (!best || gain > best.gain) best = { s: sym, gain };
  }
  return best && best.gain > 0.05 ? best.s : undefined;
}

export function chooseNextQuestion(ctx: Ctx, scored: Scored[], asked: Set<string>): Question | undefined {
  if (!asked.has("severity")) return SEVERITY_QUESTION;
  // Fever is the most useful single question in Nigerian primary care (malaria, typhoid, meningitis, Lassa).
  if (!asked.has("fever")) return symptomQuestion(SYMPTOM_BY_ID.get("fever")!);

  const screensAsked = [...asked].filter((id) => SCREEN_IDS.has(id)).length;
  if (screensAsked < MAX_SCREENING_QUESTIONS) {
    for (const screen of SCREENS) {
      if (!screen.when(ctx)) continue;
      for (const id of screen.ask) {
        const sym = SYMPTOM_BY_ID.get(id);
        if (sym && !asked.has(id) && fits(sym, ctx)) return symptomQuestion(sym);
      }
    }
  }

  if (!asked.has("duration")) return DURATION_QUESTION;

  const sym = mostInformative(ctx, scored, asked);
  return sym ? symptomQuestion(sym) : undefined;
}

// ---------------------------------------------------------------------------
// Urgency, specialty and advice
// ---------------------------------------------------------------------------
const LABELS: Record<Level, string> = {
  self_care: "Self-care at home for now",
  consultation: "See a doctor in the next few days",
  consultation_24: "See a doctor within 24 hours",
  emergency: "Go to the emergency department now",
  emergency_ambulance: "Get emergency help now",
};

const LEVEL_SCORE: Record<Level, number> = { self_care: 2, consultation: 4, consultation_24: 6, emergency: 9, emergency_ambulance: 10 };

const RED_FLAG_SPECIALTY: Record<string, string> = {
  stroke: "Neurology",
  thunderclap: "Neurology",
  meningitis: "Neurology",
  seizure: "Neurology",
  heart_attack: "Cardiology",
  breathing: "Pulmonology",
  pregnancy_danger: "Obstetrics",
  suicide: "Psychiatry",
  sickle_emergency: "Haematology",
  gi_bleed: "Gastroenterology",
  acute_abdomen: "General Surgery",
  infant_fever: "Pediatrics",
};

const maxLevel = (a: Level, b: Level): Level => (LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a);

export function matchedRedFlags(ctx: Ctx): RedFlag[] {
  return RED_FLAGS.filter((f) => f.when(ctx));
}

function specialtyFor(ctx: Ctx, flags: RedFlag[], scored: Scored[]): string {
  let specialty = flags.map((f) => RED_FLAG_SPECIALTY[f.id]).find(Boolean) ??
    (scored[0] && scored[0].p >= 0.35 ? scored[0].condition.specialty : "General Practice");
  if (ctx.age < 13 && specialty === "General Practice") specialty = "Pediatrics";
  return specialty;
}

const WATCH_FOR =
  "difficulty breathing, chest pain, confusion, a stiff neck, a seizure, fainting, unusual bleeding, or if you feel much worse";

export function finalize(ctx: Ctx, scored: Scored[]): Omit<TriageOutput, "should_stop" | "next_question" | "new_evidence"> {
  const flags = matchedRedFlags(ctx);
  const floors = FLOORS.filter((f) => f.when(ctx));
  const top = scored[0];

  let level: Level;
  if (flags.length > 0) {
    level = flags.reduce<Level>((l, f) => maxLevel(l, f.level), "emergency");
  } else {
    level = top ? top.condition.level : "consultation";
    // A serious condition that is still reasonably likely raises the level.
    for (const s of scored) if (s.p >= 0.3) level = maxLevel(level, s.condition.level);
    for (const f of floors) level = maxLevel(level, f.level);
    if (level === "self_care") {
      const ok = top && top.condition.selfCare && top.p >= 0.4 && ctx.severity !== undefined && ctx.severity <= 4 &&
        (ctx.durationDays === undefined || ctx.durationDays <= 10);
      if (!ok) level = "consultation";
    }
  }

  const specialty = specialtyFor(ctx, flags, scored);
  const base = LEVEL_SCORE[level];
  let severity = ctx.severity !== undefined ? Math.round((ctx.severity + base) / 2) : base;
  if (LEVEL_RANK[level] >= LEVEL_RANK.emergency) severity = Math.max(severity, 8);
  severity = Math.min(10, Math.max(1, severity));

  const redFlags = [...flags.map((f) => f.label), ...floors.filter((f) => f.warn).map((f) => f.label)];

  const differential = scored
    .filter((s, i) => i < 3 || s.p >= 0.03)
    .slice(0, 5)
    .map((s) => ({ name: s.condition.name, probability: Math.round(Math.min(s.p, MAX_SHOWN_PROBABILITY) * 100) / 100, description: s.condition.about }));

  const notDiagnosis = "This is not a diagnosis. A doctor will examine you and confirm what is going on.";
  let guidance: string;
  if (flags.length > 0) {
    const advice = [...new Set(flags.map((f) => f.advice))].join(" ");
    const how = level === "emergency_ambulance"
      ? "Call for an ambulance or have someone take you to the nearest hospital now."
      : "If you cannot get there safely on your own, ask someone to take you.";
    guidance = `${advice} ${how} ${notDiagnosis}`;
  } else {
    const action = level === "self_care"
      ? "This sounds manageable at home for now. Book a consultation if you are not getting better within a few days."
      : level === "consultation"
      ? `Book a consultation${specialty === "General Practice" ? "" : ` with ${specialty}`} in the next few days.`
      : level === "consultation_24"
      ? `Please see a doctor within 24 hours${specialty === "General Practice" ? "" : ` (${specialty})`}.`
      : "Go to the nearest emergency department now.";
    const tip = top && top.p >= 0.3 && top.condition.advice ? ` While you wait: ${top.condition.advice}` : "";
    const baby = ctx.age < 1 && ctx.present.has("fever") ? " Any fever in a baby under 3 months must be checked at a hospital today." : "";
    guidance = `${action}${tip}${baby} Go to a hospital at once if you develop ${WATCH_FOR}. ${notDiagnosis}`;
  }

  return {
    differential,
    severity_score: severity,
    triage_level: level,
    triage_label: LABELS[level],
    recommended_specialty: specialty,
    red_flags: [...new Set(redFlags)],
    guidance,
  };
}

// ---------------------------------------------------------------------------
// The two request stages used by the app
// ---------------------------------------------------------------------------
export function runParse(age: number, sex: string, freeText: string): TriageOutput {
  const found = extractSymptoms(freeText);
  const ctx0 = buildCtx(age, sex, []);
  const newEvidence: Evidence[] = [];
  for (const [id, present] of found) {
    const sym = SYMPTOM_BY_ID.get(id)!;
    if (!fits(sym, ctx0) && present) continue;
    newEvidence.push({ id, name: sym.name, present });
  }
  const ctx = buildCtx(age, sex, newEvidence);
  const scored = scoreConditions(ctx);
  const result = finalize(ctx, scored);

  if (matchedRedFlags(ctx).length > 0) {
    return { new_evidence: newEvidence, should_stop: true, ...result };
  }
  const next = ctx.present.size === 0 ? MAIN_COMPLAINT_QUESTION : SEVERITY_QUESTION;
  return { new_evidence: newEvidence, should_stop: false, next_question: next, ...result };
}

export function runNext(age: number, sex: string, evidence: Evidence[], askedIds: string[]): TriageOutput {
  const ctx = buildCtx(age, sex, evidence);
  const scored = scoreConditions(ctx);
  const result = finalize(ctx, scored);

  if (matchedRedFlags(ctx).length > 0) return { should_stop: true, ...result };

  // Never ask about something already known (from the free text, the main complaint or an earlier answer).
  const asked = new Set([...askedIds, ...evidence.map((e) => e.id), ...ctx.present, ...ctx.absent]);
  // Nothing recognised yet and the patient hasn't picked a main complaint: ask for one.
  if (ctx.present.size === 0 && !asked.has("main_complaint")) {
    return { should_stop: false, next_question: MAIN_COMPLAINT_QUESTION, ...result };
  }

  const count = askedIds.length;
  // Stop early once one condition clearly leads and severity and duration are known.
  const leads = scored[0] && (scored[0].p >= 0.85 || !scored[1] || scored[0].p >= 5 * scored[1].p);
  const confident = leads && asked.has("severity") && asked.has("duration") && count >= 3;
  if (count >= MAX_QUESTIONS || confident) return { should_stop: true, ...result };

  const next = chooseNextQuestion(ctx, scored, asked);
  if (!next) return { should_stop: true, ...result };
  return { should_stop: false, next_question: next, ...result };
}
