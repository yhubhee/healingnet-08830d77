// Care plans (maternity and surgery): what my_care() returns, the pregnancy arithmetic,
// how the to-do list is grouped, and the reminders the phone schedules for itself so they
// work without the internet. Nothing here touches the phone or the network.
// The website's copy is src/lib/care.ts.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const LAGOS_OFFSET_MS = HOUR; // UTC+1 all year
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

export type CareKind = "visit" | "test" | "medicine" | "task" | "instruction";
export const CARE_KINDS: { value: CareKind; label: string }[] = [
  { value: "visit", label: "Visit" }, { value: "test", label: "Test" }, { value: "medicine", label: "Medicine" },
  { value: "task", label: "To-do" }, { value: "instruction", label: "Instruction" },
];
export const careKindLabel = (kind: string) => CARE_KINDS.find((k) => k.value === kind)?.label ?? "To-do";

export interface CareItem {
  id: string;
  kind: CareKind;
  title: string;
  details: string | null;
  due_at: string | null;
  remind: boolean;
  status: "open" | "done" | "cancelled";
  done_at: string | null;
  done_by_patient: boolean;
}

export interface AntenatalVisit {
  visit_date: string;
  gestational_weeks: number | null;
  bp: string | null;
  weight_kg: number | null;
  fetal_heart_rate: number | null;
  next_visit_date: string | null;
}

export interface Pregnancy {
  id: string;
  hospital_name: string;
  doctor_name: string | null;
  status: string;
  lmp_date: string | null;
  edd: string | null;
  weeks_today: number | null;
  days_extra: number | null;
  patient_notes: string | null;
  delivery_date: string | null;
  delivery_type: string | null;
  baby_gender: string | null;
  baby_weight: number | null;
  visits: AntenatalVisit[];
  items: CareItem[];
}

export interface Surgery {
  id: string;
  hospital_name: string;
  surgeon_name: string | null;
  procedure_name: string;
  procedure_type: string | null;
  anaesthesia_type: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  admit_at: string | null;
  fasting_from: string | null;
  status: string;
  consent_signed: boolean;
  patient_instructions: string | null;
  post_op_instructions: string | null;
  items: CareItem[];
}

export interface CareData { pregnancies: Pregnancy[]; surgeries: Surgery[] }
export const EMPTY_CARE: CareData = { pregnancies: [], surgeries: [] };

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const rows = (v: unknown) => (Array.isArray(v) ? v.filter((r): r is Record<string, unknown> => !!r && typeof r === "object") : []);

function parseItem(r: Record<string, unknown>): CareItem | null {
  const id = str(r.id); const title = str(r.title);
  if (!id || !title) return null;
  const kind = CARE_KINDS.some((k) => k.value === r.kind) ? (r.kind as CareKind) : "task";
  const status = r.status === "done" || r.status === "cancelled" ? r.status : "open";
  return { id, kind, title, details: str(r.details), due_at: str(r.due_at), remind: r.remind !== false, status, done_at: str(r.done_at), done_by_patient: r.done_by_patient === true };
}
const items = (v: unknown) => rows(v).map(parseItem).filter((i): i is CareItem => !!i);

/** What my_care() returned, made safe to use: a missing part is empty, never a crash. */
export function parseCare(raw: unknown): CareData {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    pregnancies: rows(o.pregnancies).filter((p) => str(p.id)).map((p) => ({
      id: String(p.id), hospital_name: str(p.hospital_name) ?? "Hospital", doctor_name: str(p.doctor_name), status: str(p.status) ?? "anc_registered",
      lmp_date: str(p.lmp_date), edd: str(p.edd), weeks_today: numOrNull(p.weeks_today), days_extra: numOrNull(p.days_extra),
      patient_notes: str(p.patient_notes), delivery_date: str(p.delivery_date), delivery_type: str(p.delivery_type),
      baby_gender: str(p.baby_gender), baby_weight: numOrNull(p.baby_weight),
      visits: rows(p.visits).filter((v) => str(v.visit_date)).map((v) => ({
        visit_date: String(v.visit_date), gestational_weeks: numOrNull(v.gestational_weeks), bp: str(v.bp), weight_kg: numOrNull(v.weight_kg),
        fetal_heart_rate: numOrNull(v.fetal_heart_rate), next_visit_date: str(v.next_visit_date),
      })),
      items: items(p.items),
    })),
    surgeries: rows(o.surgeries).filter((s) => str(s.id) && str(s.scheduled_date)).map((s) => ({
      id: String(s.id), hospital_name: str(s.hospital_name) ?? "Hospital", surgeon_name: str(s.surgeon_name), procedure_name: str(s.procedure_name) ?? "Procedure",
      procedure_type: str(s.procedure_type), anaesthesia_type: str(s.anaesthesia_type), scheduled_date: String(s.scheduled_date), scheduled_time: str(s.scheduled_time),
      admit_at: str(s.admit_at), fasting_from: str(s.fasting_from), status: str(s.status) ?? "scheduled", consent_signed: s.consent_signed === true,
      patient_instructions: str(s.patient_instructions), post_op_instructions: str(s.post_op_instructions), items: items(s.items),
    })),
  };
}

// ---- Pregnancy arithmetic -----------------------------------------------------------------
export const PREGNANCY_DAYS = 280;
const dayMs = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(dayMs(v));

/** EDD = LMP + 280 days. */
export const eddFromLmp = (lmp: string | null | undefined): string | null => (isDate(lmp) ? isoDay(dayMs(lmp) + PREGNANCY_DAYS * DAY) : null);
/** LMP = EDD − 280 days. */
export const lmpFromEdd = (edd: string | null | undefined): string | null => (isDate(edd) ? isoDay(dayMs(edd) - PREGNANCY_DAYS * DAY) : null);

export interface Gestation { weeks: number; days: number }

/** How far along on `today` ("YYYY-MM-DD"), from the LMP, or from the EDD when there is no LMP. */
export function gestationOn(lmp: string | null | undefined, edd: string | null | undefined, today: string): Gestation | null {
  const start = isDate(lmp) ? lmp : lmpFromEdd(edd);
  if (!start || !isDate(today)) return null;
  const total = Math.round((dayMs(today) - dayMs(start)) / DAY);
  if (total < 0 || total > 46 * 7) return null;
  return { weeks: Math.floor(total / 7), days: total % 7 };
}

/** "24 weeks 3 days", "24 weeks", "1 week 1 day". */
export function gestationText(g: Gestation | null | undefined): string {
  if (!g) return "";
  const w = `${g.weeks} ${g.weeks === 1 ? "week" : "weeks"}`;
  return g.days > 0 ? `${w} ${g.days} ${g.days === 1 ? "day" : "days"}` : w;
}

/** Progress to 40 weeks, 0 to 1. */
export const pregnancyProgress = (g: Gestation | null | undefined) => (g ? Math.max(0, Math.min(1, (g.weeks * 7 + g.days) / PREGNANCY_DAYS)) : 0);

export const ACTIVE_PREGNANCY = ["anc_registered", "active_anc", "labour"];
export const isActivePregnancy = (p: Pick<Pregnancy, "status">) => ACTIVE_PREGNANCY.includes(p.status);
export const pregnancyStatusText = (status: string) => ({
  anc_registered: "Antenatal care", active_anc: "Antenatal care", labour: "In labour", delivered: "Delivered", postnatal: "After delivery", discharged: "Discharged",
}[status] ?? status.replace(/_/g, " "));

/** 140/90 or above: either number is enough. */
export const isHighBp = (systolic: number | null | undefined, diastolic: number | null | undefined) =>
  (typeof systolic === "number" && systolic >= 140) || (typeof diastolic === "number" && diastolic >= 90);
/** The flag in words. */
export const bpFlag = (systolic: number | null | undefined, diastolic: number | null | undefined) => (isHighBp(systolic, diastolic) ? "High BP" : null);

// ---- Surgery ------------------------------------------------------------------------------
/** The operation's start: its date and time are Lagos wall-clock values. */
export function surgeryStart(s: Pick<Surgery, "scheduled_date" | "scheduled_time">): Date | null {
  if (!isDate(s.scheduled_date)) return null;
  const t = /^\d{2}:\d{2}/.test(s.scheduled_time ?? "") ? s.scheduled_time!.slice(0, 5) : "09:00";
  const d = new Date(`${s.scheduled_date.slice(0, 10)}T${t}:00+01:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
/** When the patient should be there: admission if set, otherwise the operation. */
export function surgeryArrival(s: Pick<Surgery, "scheduled_date" | "scheduled_time" | "admit_at">): Date | null {
  const a = s.admit_at ? new Date(s.admit_at) : null;
  return a && !Number.isNaN(a.getTime()) ? a : surgeryStart(s);
}
/** Suggested "fasting from": 6 hours before the start. The clinician can change it. */
export function suggestFastingFrom(date: string, time: string | null | undefined): Date | null {
  const start = surgeryStart({ scheduled_date: date, scheduled_time: time ?? null });
  return start ? new Date(start.getTime() - 6 * HOUR) : null;
}
export const SURGERY_STEPS = ["scheduled", "prep", "in_progress", "recovery", "completed"] as const;
export const UPCOMING_SURGERY = ["scheduled", "prep", "postponed"];
export const isUpcomingSurgery = (s: Pick<Surgery, "status">) => UPCOMING_SURGERY.includes(s.status);
export const surgeryStatusText = (status: string) => ({
  scheduled: "Scheduled", prep: "Getting ready", in_progress: "In theatre", recovery: "In recovery", completed: "Completed", cancelled: "Cancelled", postponed: "Postponed",
}[status] ?? status.replace(/_/g, " "));
export const procedureTypeText = (t: string | null | undefined) => ({ elective: "Planned", emergency: "Emergency", day_case: "Day case" }[t ?? ""] ?? "");

// ---- Dates in Nigerian format -------------------------------------------------------------
const lagos = (ms: number) => new Date(ms + LAGOS_OFFSET_MS);
const clock = (d: Date) => `${((d.getUTCHours() + 11) % 12) + 1}:${pad(d.getUTCMinutes())} ${d.getUTCHours() < 12 ? "am" : "pm"}`;

/** "Tue 24 Nov" for a "YYYY-MM-DD" date or a timestamp (Lagos time). */
export function careDay(value: string | null | undefined): string {
  if (!value) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const ms = Date.parse(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(ms)) return "";
  const d = dateOnly ? new Date(ms) : lagos(ms);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}
/** "9:00 am" for a timestamp (Lagos time). */
export function careTime(value: string | null | undefined): string {
  const ms = value ? Date.parse(value) : NaN;
  return Number.isNaN(ms) ? "" : clock(lagos(ms));
}
/** "Tue 24 Nov, 9:00 am". */
export const careDateTime = (value: string | null | undefined) => [careDay(value), careTime(value)].filter(Boolean).join(", ");
/** "Fasting from 10:00 pm, Mon 23 Nov". */
export const fastingLine = (fastingFrom: string | null | undefined) => (fastingFrom && careTime(fastingFrom) ? `Fasting from ${careTime(fastingFrom)}, ${careDay(fastingFrom)}` : "");

// ---- The to-do list -----------------------------------------------------------------------
export interface CareGroups<T> { upcoming: T[]; noDate: T[]; done: T[] }

/**
 * "Upcoming" (open, with a date, soonest first; a date that has passed stays here until it
 * is done), "No date" (open, no date) and "Done" (latest first). Cancelled items are left out.
 */
export function groupCareItems<T extends Pick<CareItem, "status" | "due_at" | "done_at">>(list: readonly T[]): CareGroups<T> {
  const t = (v: string | null) => (v ? Date.parse(v) || 0 : 0);
  const open = list.filter((i) => i.status === "open");
  return {
    upcoming: open.filter((i) => !!i.due_at).sort((a, b) => t(a.due_at) - t(b.due_at)),
    noDate: open.filter((i) => !i.due_at),
    done: list.filter((i) => i.status === "done").sort((a, b) => t(b.done_at) - t(a.done_at)),
  };
}
/** Visits are marked by the hospital; the patient ticks everything else. */
export const patientCanTick = (i: Pick<CareItem, "kind" | "status">) => i.kind !== "visit" && i.status !== "cancelled";
export const HOSPITAL_MARKS_VISITS = "The hospital will mark this";
export const NO_CARE_PLAN = "Your hospital hasn't added a pregnancy or procedure plan.";
export const isPast = (dueAt: string | null | undefined, now: Date) => !!dueAt && Date.parse(dueAt) < now.getTime();

/** Home shows the Care plan card only for an active pregnancy or an upcoming procedure. */
export function hasActiveCare(c: CareData | null | undefined): boolean {
  return !!c && (c.pregnancies.some(isActivePregnancy) || c.surgeries.some(isUpcomingSurgery));
}

/** Home card: "Next: Antenatal visit · Tue 24 Nov", or a plain line when nothing is dated. */
export function nextCareLine(c: CareData, now: Date): string {
  const t = now.getTime();
  const next: { at: number; text: string }[] = [];
  for (const p of c.pregnancies.filter(isActivePregnancy)) {
    for (const i of p.items) if (i.status === "open" && i.due_at && Date.parse(i.due_at) >= t) next.push({ at: Date.parse(i.due_at), text: i.title });
  }
  for (const s of c.surgeries.filter(isUpcomingSurgery)) {
    const start = surgeryArrival(s);
    if (start && start.getTime() >= t) next.push({ at: start.getTime(), text: s.procedure_name });
    for (const i of s.items) if (i.status === "open" && i.due_at && Date.parse(i.due_at) >= t) next.push({ at: Date.parse(i.due_at), text: i.title });
  }
  next.sort((a, b) => a.at - b.at);
  if (next[0]) return `Next: ${next[0].text} · ${careDay(new Date(next[0].at).toISOString())}`;
  const p = c.pregnancies.find(isActivePregnancy);
  if (p) return p.weeks_today !== null ? gestationText({ weeks: p.weeks_today, days: p.days_extra ?? 0 }) : "Antenatal care";
  return c.surgeries.some(isUpcomingSurgery) ? "Procedure planned" : "Nothing coming up";
}

// ---- Quick templates (the title only; the clinician writes the details) ---------------------
export const CARE_TEMPLATES: Record<"surgery" | "maternity", { title: string; kind: CareKind }[]> = {
  surgery: [
    { title: "Blood test", kind: "test" }, { title: "Stop eating (fasting)", kind: "instruction" }, { title: "Bring your medicines", kind: "task" },
    { title: "Wound check", kind: "visit" }, { title: "Remove stitches", kind: "visit" }, { title: "Clinic review", kind: "visit" },
  ],
  maternity: [
    { title: "Ultrasound scan", kind: "test" }, { title: "Blood tests", kind: "test" }, { title: "Tetanus vaccine", kind: "task" }, { title: "Iron and folic acid", kind: "medicine" },
  ],
};
export const CARE_TITLE_MAX = 120;
export const CARE_DETAILS_MAX = 1000;
/** A mistake made in the last 10 minutes may be deleted; after that the item is cancelled instead. */
export const canDeleteCareItem = (createdAt: string | null | undefined, now: Date) => !!createdAt && now.getTime() - Date.parse(createdAt) < 10 * 60_000;

// ---- Reminders kept on the phone ----------------------------------------------------------
export const CARE_REMINDER_TITLE = "Care plan reminder";

export interface CareAlert {
  /** Stable, so an alert is never scheduled twice: `${ref}|day`, `${ref}|due`, `${ref}|fast`. */
  key: string;
  /** The care item's id, or the surgery's: what a server notification's reference_id names. */
  ref: string;
  phase: "day" | "due" | "fast";
  /** When it rings, in milliseconds. */
  at: number;
  /** When the thing itself is. */
  dueAt: number;
  /** What it is about: shown only when "Show details on the lock screen" is on. */
  text: string;
  /** Whose it is (a family member's patient id); null for the signed-in patient. */
  patientId: string | null;
  /** The family member's first name, for "Tobi: …". */
  person?: string | null;
}

/** 18:00 Lagos time on the day before `due`. */
function eveningBefore(due: number): number {
  const d = lagos(due);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 1, 18, 0, 0) - LAGOS_OFFSET_MS;
}

/**
 * Every reminder still to come for one person's care plan:
 *   dated, open items with "remind" on: the day before at 18:00; then 2 hours before a
 *   visit, or at the time for anything else;
 *   an upcoming procedure: the day before at 18:00 and 2 hours before admission (or the
 *   operation), and 1 hour before fasting starts.
 */
export function planCareAlerts(c: CareData, now: Date, who: { patientId: string | null; person?: string | null } = { patientId: null }): CareAlert[] {
  const t = now.getTime();
  const out: CareAlert[] = [];
  const base = { patientId: who.patientId, ...(who.person ? { person: who.person } : {}) };
  const add = (ref: string, phase: CareAlert["phase"], at: number, dueAt: number, text: string) => {
    if (at > t) out.push({ key: `${ref}|${phase}`, ref, phase, at, dueAt, text, ...base });
  };
  const itemAlerts = (list: CareItem[]) => {
    for (const i of list) {
      if (i.status !== "open" || !i.remind || !i.due_at) continue;
      const due = Date.parse(i.due_at);
      if (Number.isNaN(due) || due <= t) continue;
      add(i.id, "day", eveningBefore(due), due, `${i.title} · tomorrow, ${careTime(i.due_at)}`);
      add(i.id, "due", i.kind === "visit" ? due - 2 * HOUR : due, due, i.kind === "visit" ? `${i.title} · today, ${careTime(i.due_at)}` : i.title);
    }
  };
  for (const p of c.pregnancies) if (isActivePregnancy(p) || p.status === "postnatal" || p.status === "delivered") itemAlerts(p.items);
  for (const s of c.surgeries) {
    if (s.status === "cancelled") continue;
    itemAlerts(s.items);
    if (s.status !== "scheduled" && s.status !== "prep") continue;
    const arrive = surgeryArrival(s);
    if (arrive && arrive.getTime() > t) {
      const iso = arrive.toISOString();
      add(s.id, "day", eveningBefore(arrive.getTime()), arrive.getTime(), `${s.procedure_name} · tomorrow, ${careTime(iso)}`);
      add(s.id, "due", arrive.getTime() - 2 * HOUR, arrive.getTime(), `${s.procedure_name} · today, ${careTime(iso)}`);
    }
    const fast = s.fasting_from ? Date.parse(s.fasting_from) : NaN;
    if (!Number.isNaN(fast) && fast > t) add(s.id, "fast", fast - HOUR, fast, `Fasting starts at ${careTime(s.fasting_from)}`);
  }
  return out.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}

/**
 * One budget for everything the phone schedules (medicines and care plans): the nearest
 * `cap` in total, never more. iPhones keep at most 64 scheduled notifications per app.
 */
export function shareBudget<D extends { at: number; key: string }, A extends { at: number; key: string }>(
  doses: readonly D[], alerts: readonly A[], cap = 60,
): { doses: D[]; alerts: A[] } {
  const all = [
    ...doses.map((d) => ({ at: d.at, key: `m:${d.key}`, dose: d as D | null, alert: null as A | null })),
    ...alerts.map((a) => ({ at: a.at, key: `c:${a.key}`, dose: null as D | null, alert: a as A | null })),
  ].sort((x, y) => x.at - y.at || x.key.localeCompare(y.key)).slice(0, Math.max(0, cap));
  return { doses: all.filter((x) => x.dose).map((x) => x.dose!), alerts: all.filter((x) => x.alert).map((x) => x.alert!) };
}

/**
 * The lock screen says only "Care plan reminder" unless the patient turned details on;
 * then it shows the title, with the person's name for a family member.
 */
export function careAlertText(a: Pick<CareAlert, "text" | "person">, showDetails: boolean): { title: string; body: string } {
  if (!showDetails) return { title: CARE_REMINDER_TITLE, body: "Open HealingNet to see it." };
  return { title: a.person ? `${a.person}: care plan reminder` : CARE_REMINDER_TITLE, body: a.text };
}

/**
 * A server notification about `ref` arrived at `now`: which local alert it replaces, so the
 * patient is not told twice. The server sends its day-before notice while the thing is more
 * than 2 hours away, the on-the-day one after that, and the fasting one within the hour
 * before fasting starts.
 */
export function alertsReplacedByPush(plan: readonly CareAlert[], ref: string, now: Date): string[] {
  const t = now.getTime();
  const mine = plan.filter((a) => a.ref === ref && a.at > t - 10 * 60_000);
  const fast = mine.find((a) => a.phase === "fast" && a.dueAt - t <= 65 * 60_000 && a.dueAt >= t - 10 * 60_000);
  if (fast) return [fast.key];
  const due = mine.find((a) => a.phase !== "fast");
  if (!due) return [];
  const phase = due.dueAt - t > 2 * HOUR + 5 * 60_000 ? "day" : "due";
  return mine.filter((a) => a.phase === phase).map((a) => a.key);
}
