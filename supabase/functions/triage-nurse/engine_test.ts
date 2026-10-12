// Tests for the rules-based triage engine.
// Run: deno test supabase/functions/triage-nurse/engine_test.ts
import { z } from "npm:zod@3.23.8";
import { CONDITIONS, MAIN_COMPLAINT_OPTIONS, SCREENS, SYMPTOMS } from "./kb.ts";
import { type Evidence, extractSymptoms, MAX_QUESTIONS, type Question, runNext, runParse, SYMPTOM_BY_ID, type TriageOutput } from "./engine.ts";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}
const eq = (a: unknown, b: unknown, msg: string) => assert(a === b, `${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// The response shape the app relies on (same as the old AI version's validator).
const Contract = z.object({
  new_evidence: z.array(z.object({ id: z.string(), name: z.string(), present: z.boolean() })).optional(),
  next_question: z.object({
    id: z.string(),
    text: z.string().min(1),
    explanation: z.string().optional(),
    type: z.enum(["boolean", "multiple_choice", "scale", "duration"]),
    options: z.array(z.string()).optional(),
    unit: z.string().optional(),
  }).optional(),
  should_stop: z.boolean(),
  differential: z.array(z.object({ name: z.string(), probability: z.number().min(0).max(1), description: z.string().optional() })).min(1).max(5),
  severity_score: z.number().int().min(1).max(10),
  triage_level: z.enum(["self_care", "consultation", "consultation_24", "emergency_ambulance", "emergency"]),
  triage_label: z.string().min(1),
  recommended_specialty: z.string().min(1),
  red_flags: z.array(z.string()),
  guidance: z.string().min(1),
}).strict().refine((r) => r.should_stop || r.next_question !== undefined);

interface Patient {
  age: number;
  sex: "male" | "female";
  text: string;
  /** Symptoms the patient would answer "yes" to (everything else is "no"). */
  has?: string[];
  /** Symptoms the patient doesn't know (answered "unknown"). */
  unsure?: string[];
  severity?: number;
  duration?: string;
  mainComplaint?: string;
}

interface Run {
  first: TriageOutput;
  final: TriageOutput;
  asked: string[];
  questions: Question[];
}

/** Plays a full interview the way the app does (Triage.tsx). */
function interview(p: Patient): Run {
  const first = runParse(p.age, p.sex, p.text);
  Contract.parse(first);
  let evidence: Evidence[] = [...(first.new_evidence ?? [])];
  const asked: string[] = [];
  const questions: Question[] = [];
  let r = first;
  let q = first.should_stop ? undefined : first.next_question;
  while (q) {
    asked.push(q.id);
    questions.push(q);
    if (q.type === "boolean") {
      if (!(p.unsure ?? []).includes(q.id)) {
        evidence = [...evidence, { id: q.id, name: q.text, present: (p.has ?? []).includes(q.id) }];
      }
    } else {
      const value = q.type === "scale" ? String(p.severity ?? 5)
        : q.type === "duration" ? (p.duration ?? "2 days")
        : (p.mainComplaint ?? q.options![0]);
      evidence = [...evidence, { id: q.id, name: `${q.text}: ${value}`, present: true }];
    }
    const forceStop = asked.length >= MAX_QUESTIONS;
    r = runNext(p.age, p.sex, evidence, asked);
    Contract.parse(r);
    if (r.should_stop || forceStop || !r.next_question) break;
    assert(!asked.includes(r.next_question.id), `question repeated: ${r.next_question.id}`);
    q = r.next_question;
  }
  return { first, final: r, asked, questions };
}

const top = (r: TriageOutput) => r.differential[0]?.name;
const inTop = (r: TriageOutput, name: string, n = 3) => r.differential.slice(0, n).some((d) => d.name === name);
const isEmergency = (r: TriageOutput) => r.triage_level === "emergency" || r.triage_level === "emergency_ambulance";

// ---------------------------------------------------------------------------
// Knowledge base integrity
// ---------------------------------------------------------------------------
Deno.test("kb: every referenced symptom id exists", async () => {
  const ids = new Set(SYMPTOMS.map((s) => s.id));
  eq(ids.size, SYMPTOMS.length, "duplicate symptom ids");
  for (const c of CONDITIONS) {
    for (const [id, l] of Object.entries(c.s)) {
      assert(ids.has(id), `condition ${c.id} uses unknown symptom ${id}`);
      assert(l > 0 && l < 1, `condition ${c.id} symptom ${id} likelihood out of range`);
    }
    assert(c.prior > 0, `condition ${c.id} prior`);
  }
  for (const s of SCREENS) for (const id of s.ask) assert(ids.has(id), `screen asks unknown ${id}`);
  for (const o of MAIN_COMPLAINT_OPTIONS) for (const id of o.ids) assert(ids.has(id), `main complaint uses unknown ${id}`);
  // Ids used inside red flag / floor / screen rules (P(c, "x") and any(c, "x", ...)).
  const src = await Deno.readTextFile(new URL("./kb.ts", import.meta.url));
  for (const m of src.matchAll(/\b(?:P|any)\(c, ([^)]*)\)/g)) {
    for (const q of m[1].matchAll(/"([a-z_]+)"/g)) assert(ids.has(q[1]), `rule uses unknown symptom ${q[1]}`);
  }
  eq(new Set(CONDITIONS.map((c) => c.id)).size, CONDITIONS.length, "duplicate condition ids");
});

Deno.test("kb: every symptom has a question and at least one phrase", () => {
  for (const s of SYMPTOMS) {
    assert(s.q.endsWith("?"), `${s.id} question should end with ?`);
    assert(s.phrases.length > 0, `${s.id} has no phrases`);
  }
});

// ---------------------------------------------------------------------------
// Understanding free text
// ---------------------------------------------------------------------------
Deno.test("text: English, negation and overlaps", () => {
  const m = extractSymptoms("I have a headache but no fever. I don't have a cough");
  eq(m.get("headache"), true, "headache");
  eq(m.get("fever"), false, "fever negated");
  eq(m.get("cough"), false, "cough negated");

  const e = extractSymptoms("eye discharge and red eyes");
  eq(e.get("eye_discharge"), true, "eye discharge");
  eq(e.has("genital_discharge"), false, "eye discharge is not genital discharge");

  eq(extractSymptoms("I have no appetite").get("loss_of_appetite"), true, "no appetite = loss of appetite");
  eq(extractSymptoms("I am fit and healthy").has("seizure"), false, "fit is not a seizure");
  eq(extractSymptoms("I fell sick yesterday").has("injury"), false, "fell sick is not an injury");
  eq(extractSymptoms("pain in my lower back").get("back_pain"), true, "back pain combo");
  eq(extractSymptoms("pain at the back of my head").get("headache"), true, "back of head = headache");
  eq(extractSymptoms("I can't breathe well").get("shortness_of_breath"), true, "can't breathe");
  eq(extractSymptoms("my legs are swollen").get("leg_swelling"), true, "legs are swollen");
  eq(extractSymptoms("my gums are bleeding").get("unusual_bleeding"), true, "gums are bleeding");
  const eyes = extractSymptoms("red eyes with discharge");
  eq(eyes.get("eye_discharge"), true, "eyes with discharge");
  eq(eyes.get("red_eye"), true, "red eyes too");
  eq(eyes.has("genital_discharge"), false, "eye discharge is not genital discharge (combo)");
});

Deno.test("text: Pidgin", () => {
  const m = extractSymptoms("my body dey hot and my belle dey pain me, I dey purge");
  eq(m.get("fever"), true, "body dey hot");
  eq(m.get("abdominal_pain"), true, "belle dey pain");
  eq(m.get("diarrhoea"), true, "dey purge");
  eq(extractSymptoms("I no get fever").get("fever"), false, "I no get fever");
  eq(extractSymptoms("my belle no dey pain me").get("abdominal_pain"), false, "belle no dey pain");
  eq(extractSymptoms("catarrh dey worry me").get("runny_nose"), true, "catarrh");
  eq(extractSymptoms("my waist dey pain me").get("back_pain"), true, "waist pain");
});

Deno.test("text: Yoruba, Igbo and Hausa words", () => {
  const yo = extractSymptoms("Ìbà àti orí fífọ́");
  eq(yo.get("fever"), true, "iba");
  eq(yo.get("headache"), true, "ori fifo");
  const ig = extractSymptoms("ahụ ọkụ na isi ọwụwa");
  eq(ig.get("fever"), true, "ahu oku");
  eq(ig.get("headache"), true, "isi owuwa");
  const ha = extractSymptoms("ina da zazzabi da ciwon kai");
  eq(ha.get("fever"), true, "zazzabi");
  eq(ha.get("headache"), true, "ciwon kai");
});

// ---------------------------------------------------------------------------
// Emergencies stop at once
// ---------------------------------------------------------------------------
Deno.test("emergency: chest pain spreading to the left arm (English and Pidgin)", () => {
  for (const text of ["I have chest pain spreading to my left arm", "my chest dey pain me and e dey go my left arm"]) {
    const r = runParse(52, "male", text);
    Contract.parse(r);
    eq(r.should_stop, true, `stops: ${text}`);
    eq(r.triage_level, "emergency_ambulance", `level: ${text}`);
    eq(r.recommended_specialty, "Cardiology", "specialty");
  }
});

Deno.test("emergency: stroke, suicide, pregnancy bleeding, seizure, poisoning", () => {
  const cases: Array<[number, "male" | "female", string, string]> = [
    [70, "male", "his mouth don turn and he cannot talk properly, slurred speech", "Neurology"],
    [24, "female", "I want to kill myself", "Psychiatry"],
    [28, "female", "I am pregnant and I have vaginal bleeding", "Obstetrics"],
    [6, "male", "my son had a convulsion", "Neurology"],
    [3, "female", "she drank kerosene", "Pediatrics"],
  ];
  for (const [age, sex, text, specialty] of cases) {
    const r = runParse(age, sex, text);
    Contract.parse(r);
    assert(r.should_stop && isEmergency(r), `emergency for: ${text} (got ${r.triage_level})`);
    eq(r.recommended_specialty, specialty, `specialty for: ${text}`);
    assert(r.red_flags.length > 0, "red flags listed");
  }
});

Deno.test("emergency: found during the interview (fever + headache, then stiff neck)", () => {
  const run = interview({ age: 19, sex: "male", text: "fever and bad headache", has: ["stiff_neck"], severity: 7, duration: "1 days" });
  assert(run.asked.includes("stiff_neck"), "asks about stiff neck");
  assert(isEmergency(run.final) && run.final.should_stop, "meningitis red flag stops the interview");
});

Deno.test("emergency: cholera-like watery diarrhoea with dehydration", () => {
  const run = interview({ age: 30, sex: "male", text: "rice water stool many times and vomiting", has: ["signs_dehydration", "vomiting"], severity: 7 });
  assert(isEmergency(run.final), `got ${run.final.triage_level}`);
});

Deno.test("emergency: severe stomach pain in the lower right", () => {
  const run = interview({ age: 22, sex: "male", text: "pain in the lower right side of my stomach and vomiting", has: ["nausea", "loss_of_appetite"], severity: 7 });
  assert(isEmergency(run.final), `got ${run.final.triage_level}`);
  assert(inTop(run.final, "Appendicitis"), `appendicitis in top 3: ${JSON.stringify(run.final.differential.map((d) => d.name))}`);
});

// ---------------------------------------------------------------------------
// Common presentations
// ---------------------------------------------------------------------------
Deno.test("malaria: fever, headache, body pains, bitter taste", () => {
  const run = interview({ age: 34, sex: "male", text: "I have fever, headache and body pains, my mouth dey bitter", has: ["chills", "fatigue", "loss_of_appetite"], severity: 6, duration: "2 days" });
  eq(top(run.final), "Malaria", "top condition");
  eq(run.final.triage_level, "consultation_24", "level");
  eq(run.final.recommended_specialty, "General Practice", "specialty");
  assert(run.asked.length <= MAX_QUESTIONS, "question limit");
  assert(run.asked[0] === "severity", "severity asked first");
});

Deno.test("typhoid: a week of fever with stomach pain and constipation", () => {
  const run = interview({ age: 27, sex: "female", text: "fever for one week, stomach pain and constipation", has: ["fatigue", "loss_of_appetite", "headache"], severity: 6, duration: "7 days" });
  assert(inTop(run.final, "Typhoid fever", 2), `typhoid in top 2: ${JSON.stringify(run.final.differential.map((d) => d.name))}`);
  eq(run.final.triage_level, "consultation_24", "fever > 3 days floor");
  assert(run.asked.includes("pregnant"), "asks women of childbearing age about pregnancy");
});

Deno.test("common cold: self-care when mild", () => {
  const run = interview({ age: 30, sex: "male", text: "catarrh, sneezing and small cough", has: ["blocked_nose", "sore_throat"], severity: 3, duration: "2 days" });
  eq(top(run.final), "Common cold", "top");
  eq(run.final.triage_level, "self_care", "self-care");
});

Deno.test("common cold: not self-care when the patient says it is bad", () => {
  const run = interview({ age: 30, sex: "male", text: "catarrh, sneezing and small cough", has: ["blocked_nose"], severity: 6, duration: "2 days" });
  assert(run.final.triage_level !== "self_care", "severity 6 is never self-care");
});

Deno.test("UTI: burning urine in a young woman", () => {
  const run = interview({ age: 25, sex: "female", text: "burning when I urinate and I pee a lot", has: [], severity: 4, duration: "3 days" });
  eq(top(run.final), "Urinary tract infection (UTI)", "top");
  eq(run.final.triage_level, "consultation", "level");
});

Deno.test("TB: three weeks of cough with night sweats and weight loss", () => {
  const run = interview({ age: 40, sex: "male", text: "I have been coughing for 3 weeks with night sweats and weight loss", has: ["fever", "fatigue", "loss_of_appetite"], severity: 5, duration: "3 weeks" });
  eq(top(run.final), "Tuberculosis (TB)", "top");
  eq(run.final.recommended_specialty, "Pulmonology", "specialty");
  assert(run.final.red_flags.includes("Cough for 2 weeks or more"), "long cough flagged");
});

Deno.test("sickle cell crisis: known SS with bone pain", () => {
  const run = interview({ age: 16, sex: "female", text: "I am SS and my bones dey pain me", has: ["fatigue"], severity: 6, duration: "1 days" });
  eq(top(run.final), "Sickle cell pain crisis", "top");
  eq(run.final.recommended_specialty, "Haematology", "specialty");
  eq(run.final.triage_level, "consultation_24", "level");
});

Deno.test("child with fever and cough: at least within 24 hours, paediatrics", () => {
  const run = interview({ age: 3, sex: "male", text: "fever and cough", has: ["runny_nose"], severity: 5, duration: "2 days" });
  assert(["consultation_24", "emergency"].includes(run.final.triage_level), `got ${run.final.triage_level}`);
  eq(run.final.recommended_specialty, "Pediatrics", "specialty");
  assert(run.asked.includes("very_drowsy"), "asks about drowsiness in children");
});

Deno.test("skin: ring-shaped itchy patches", () => {
  const run = interview({ age: 20, sex: "male", text: "itchy ringworm on my neck", has: ["rash"], severity: 2, duration: "3 weeks" });
  eq(top(run.final), "Fungal skin infection", "top");
  eq(run.final.recommended_specialty, "Dermatology", "specialty");
});

Deno.test("toothache goes to dentistry", () => {
  const run = interview({ age: 35, sex: "female", text: "my tooth dey pain me", severity: 5, duration: "4 days" });
  eq(top(run.final), "Tooth or gum problem", "top");
  eq(run.final.recommended_specialty, "Dentistry", "specialty");
});

Deno.test("nothing recognised: asks for the main complaint", () => {
  const r = runParse(30, "male", "write me a poem about football");
  Contract.parse(r);
  eq(r.next_question?.id, "main_complaint", "main complaint question");
  const run = interview({ age: 30, sex: "male", text: "write me a poem about football", mainComplaint: "Headache", severity: 3, duration: "1 days" });
  assert(run.final.differential.some((d) => d.name.toLowerCase().includes("headache") || d.name === "Migraine"), "headache conditions after picking Headache");
});

Deno.test("every answer path stays within the contract and the question limit", () => {
  // A patient who says yes to nothing and "unknown" to some questions.
  const run = interview({ age: 45, sex: "female", text: "I feel tired", unsure: ["pregnant", "sweating"], severity: 5, duration: "10 days" });
  assert(run.asked.length <= MAX_QUESTIONS, "limit");
  for (const id of run.asked) assert(["severity", "duration", "main_complaint"].includes(id) || SYMPTOM_BY_ID.has(id), `unknown question ${id}`);
});

Deno.test("never self-care for babies, pregnancy or red flags", () => {
  const baby = interview({ age: 0, sex: "female", text: "catarrh and sneezing", severity: 2, duration: "1 days" });
  assert(baby.final.triage_level !== "self_care", "baby");
  const preg = interview({ age: 26, sex: "female", text: "I am pregnant and I have catarrh", severity: 2, duration: "2 days" });
  assert(preg.final.triage_level !== "self_care", "pregnant");
});

Deno.test("conditions that need a known fact are not suggested without it", () => {
  const run = interview({ age: 45, sex: "male", text: "my chest dey pain me small small when I waka", severity: 5, duration: "2 weeks" });
  assert(!run.final.differential.some((d) => d.name === "Sickle cell pain crisis"), "no sickle crisis without known sickle cell disease");
  eq(run.final.triage_level, "consultation_24", "chest pain floor");
});

Deno.test("fever is always checked early", () => {
  const run = interview({ age: 23, sex: "female", text: "stomach pain and vomiting since yesterday", has: ["nausea", "fever"], severity: 6, duration: "1 days" });
  eq(run.asked[1], "fever", "fever is the second question");
});

Deno.test("fever with bleeding gums stops as an emergency", () => {
  const r = runParse(19, "female", "I have fever and my gums are bleeding");
  assert(r.should_stop && isEmergency(r), `got ${r.triage_level}`);
});
