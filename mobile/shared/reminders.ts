// Medicine reminders: everything that can be worked out without the phone. Reading a
// prescription's "how often" into suggested times, listing the doses until the course
// ends, and choosing which of them to hand to the phone's scheduler (never more than 60:
// iPhones only keep 64 scheduled notifications per app).

export const MAX_SCHEDULED = 60;
export const SNOOZE_MINUTES = 15;
export const DEFAULT_DAYS = 7;
export const MAX_DAYS = 365;
export const MAX_TIMES = 6;

export interface Reminder {
  /** The prescription line this reminds about (prescription_id). */
  id: string;
  documentId: string;
  drug: string;
  dose: string | null;
  /** Times of day as "HH:MM" (24-hour), on the phone's own clock. */
  times: string[];
  /** First day, "YYYY-MM-DD" on the phone's own calendar. */
  startDate: string;
  /** How many days the reminders run, counting the first. */
  days: number;
}

export interface Dose {
  /** `${reminder id}|${date}|${time}`: stable, so a dose is never scheduled twice. */
  key: string;
  reminderId: string;
  drug: string;
  dose: string | null;
  date: string;
  time: string;
  /** When it is due, in milliseconds. */
  at: number;
}

// ---- Reading the prescription -----------------------------------------------------------
export type FrequencyKind = "scheduled" | "as_needed" | "unknown";
export interface Suggestion { kind: FrequencyKind; times: string[] }

const ONCE = ["08:00"];
const TWICE = ["08:00", "20:00"];
const THREE = ["08:00", "14:00", "20:00"];
const EVERY_8_HOURS = ["06:00", "14:00", "22:00"];
const AT_NIGHT = ["21:00"];
const FOUR = ["08:00", "12:00", "16:00", "20:00"];
const EVERY_6_HOURS = ["00:00", "06:00", "12:00", "18:00"];

/**
 * Suggested reminder times for a prescription's frequency text:
 *   once daily -> 8:00 · twice -> 8:00 and 20:00 · 3 times -> 8:00, 14:00 and 20:00 ·
 *   every 8 hours -> 6:00, 14:00 and 22:00 · 4 times -> 8:00, 12:00, 16:00 and 20:00 ·
 *   every 6 hours -> 6:00, 12:00, 18:00 and 0:00 · "when needed" -> none.
 * Text the app does not recognise gives no reminders; the patient can still add times.
 */
export function suggestTimes(frequency: string | null | undefined): Suggestion {
  const f = ` ${(frequency ?? "").toLowerCase().replace(/[.,;()]/g, " ").replace(/\s+/g, " ").trim()} `;
  if (!f.trim()) return { kind: "unknown", times: [] };
  if (/ (prn|sos|when needed|as needed|if needed|when required|as required|when necessary|as necessary) /.test(f)) return { kind: "as_needed", times: [] };

  const hourly = /every (\d{1,2}) ?(h|hr|hrs|hour|hours) /.exec(f) ?? / (\d{1,2}) ?-?hourly /.exec(f) ?? / q ?(\d{1,2}) ?h /.exec(f);
  if (hourly) {
    const n = Number(hourly[1]);
    if (n === 6) return { kind: "scheduled", times: EVERY_6_HOURS };
    if (n === 8) return { kind: "scheduled", times: EVERY_8_HOURS };
    if (n === 12) return { kind: "scheduled", times: TWICE };
    if (n === 24) return { kind: "scheduled", times: ONCE };
    return { kind: "unknown", times: [] };
  }
  // More than four times a day is not guessed at (and must not fall through to "daily").
  const count = / (\d{1,2}) ?(x|times) /.exec(f);
  if ((count && Number(count[1]) > 4) || / (five|six|seven|eight) times /.test(f)) return { kind: "unknown", times: [] };
  if (/ (4|four) ?(x|times) | qds | qid | q d s | q i d | 4 ?x /.test(f)) return { kind: "scheduled", times: FOUR };
  if (/ (3|three) ?(x|times) | thrice | tds | tid | t d s | 3 ?x /.test(f)) return { kind: "scheduled", times: THREE };
  if (/ (2|two) ?(x|times) | twice | bd | bid | b d | 2 ?x /.test(f)) return { kind: "scheduled", times: TWICE };
  if (/ (nocte|at night|at bedtime|bedtime|every night|nightly) /.test(f)) return { kind: "scheduled", times: AT_NIGHT };
  if (/ (1|one) ?(x|time|times) | once | od | o d | daily | every day | each day | every morning | mane | a day /.test(f)) return { kind: "scheduled", times: ONCE };
  return { kind: "unknown", times: [] };
}

/** "5 days", "for 2 weeks", "1 month", "7/7" (days), "2/52" (weeks), "1/12" (months) -> days. */
export function parseDurationDays(duration: string | null | undefined): number | null {
  const d = (duration ?? "").toLowerCase().trim();
  if (!d) return null;
  const clamp = (n: number) => (n >= 1 && n <= MAX_DAYS ? Math.round(n) : null);
  let m = /(\d+)\s*\/\s*(7|52|12)\b/.exec(d);
  if (m) return clamp(Number(m[1]) * (m[2] === "7" ? 1 : m[2] === "52" ? 7 : 30));
  m = /(\d+)\s*(days?|d\b|weeks?|wks?|w\b|months?|mths?|mo\b)/.exec(d);
  if (!m) return null;
  const unit = m[2][0] === "d" ? 1 : m[2][0] === "w" ? 7 : 30;
  return clamp(Number(m[1]) * unit);
}

// ---- Times and dates --------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");
export const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const isTime = (t: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
export const toTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Valid, de-duplicated, earliest first. */
export const cleanTimes = (times: string[]) => [...new Set(times.filter(isTime))].sort().slice(0, MAX_TIMES);

function atLocal(date: string, time: string): number {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = time.split(":").map(Number);
  return new Date(y, mo - 1, d, h, mi, 0, 0).getTime();
}
function addLocalDays(date: string, days: number): string {
  const [y, mo, d] = date.split("-").map(Number);
  return localDate(new Date(y, mo - 1, d + days, 12));
}

/** The last day a reminder covers. */
export const endDate = (r: Pick<Reminder, "startDate" | "days">) => addLocalDays(r.startDate, Math.max(1, r.days) - 1);

/** Every dose of one reminder, from its first day until its duration ends. */
export function dosesFor(r: Reminder): Dose[] {
  const out: Dose[] = [];
  const times = cleanTimes(r.times);
  for (let i = 0; i < Math.min(Math.max(1, r.days), MAX_DAYS); i++) {
    const date = addLocalDays(r.startDate, i);
    for (const time of times) out.push({ key: `${r.id}|${date}|${time}`, reminderId: r.id, drug: r.drug, dose: r.dose, date, time, at: atLocal(date, time) });
  }
  return out;
}

/** Reminders whose course has not ended yet (the last day still counts). */
export const activeReminders = (reminders: Reminder[], now: Date) => reminders.filter((r) => r.times.length > 0 && endDate(r) >= localDate(now));

/** Today's doses across all reminders, earliest first: Home's "Today's medicines". */
export function todaysDoses(reminders: Reminder[], now: Date): Dose[] {
  const today = localDate(now);
  return reminders.flatMap(dosesFor).filter((d) => d.date === today).sort((a, b) => a.at - b.at || a.drug.localeCompare(b.drug));
}

// ---- What to hand to the phone ----------------------------------------------------------
/**
 * The doses to keep scheduled right now: those still to come and not ticked as taken,
 * soonest first, and never more than `cap`. Running it again later (when the app opens)
 * tops the list back up as earlier doses pass.
 */
export function planSchedule(reminders: Reminder[], now: Date, taken: Record<string, unknown> = {}, cap: number = MAX_SCHEDULED): Dose[] {
  const t = now.getTime();
  return reminders.flatMap(dosesFor).filter((d) => d.at > t && !taken[d.key]).sort((a, b) => a.at - b.at || a.key.localeCompare(b.key)).slice(0, Math.max(0, cap));
}

/** What changes between what the phone holds and the plan: which to cancel, which to add. */
export function topUp(scheduledKeys: string[], plan: Dose[]): { cancel: string[]; add: Dose[] } {
  const wanted = new Set(plan.map((d) => d.key));
  const have = new Set(scheduledKeys);
  return { cancel: scheduledKeys.filter((k) => !wanted.has(k)), add: plan.filter((d) => !have.has(d.key)) };
}

/** Taken marks older than a week are dropped, so the saved list stays small. */
export function pruneTaken(taken: Record<string, number>, now: Date): Record<string, number> {
  const cutoff = localDate(new Date(now.getTime() - 7 * 86_400_000));
  return Object.fromEntries(Object.entries(taken).filter(([key]) => (key.split("|")[1] ?? "") >= cutoff));
}

// ---- Wording ----------------------------------------------------------------------------
export const REMINDER_TITLE = "Time for your medicine";
/** The lock screen names the medicine only when the patient has turned "Show details" on. */
export function reminderText(d: Pick<Dose, "drug" | "dose">, showDetails: boolean): { title: string; body: string } {
  return { title: REMINDER_TITLE, body: showDetails ? [d.drug, d.dose].filter(Boolean).join(" · ") : "Open HealingNet to see which one." };
}
