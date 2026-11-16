// Calendar dates in Lagos time as "YYYY-MM-DD" strings (what <input type="date"> uses).

const lagosDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });
const lagosTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", hour: "2-digit", minute: "2-digit", hour12: false });

/** Today's date in Lagos, e.g. "2026-10-15". */
export const lagosToday = () => lagosDate.format(new Date());

/** The current time in Lagos, e.g. "14:05". */
export const lagosNowTime = () => lagosTime.format(new Date());

/** Add whole days to a "YYYY-MM-DD" date. */
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Day of week (0 = Sunday) of a "YYYY-MM-DD" date. */
export const dayOfWeek = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();

/** "15 Oct 2026" for a "YYYY-MM-DD" date or an ISO timestamp. */
export function fmtLongDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = value.length === 10 ? new Date(value + "T00:00:00Z") : new Date(value);
  return d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: value.length === 10 ? "UTC" : "Africa/Lagos" });
}

/** Whole days from today (Lagos) until a "YYYY-MM-DD" date; negative if past. */
export function daysFromToday(iso: string): number {
  const a = new Date(lagosToday() + "T00:00:00Z").getTime();
  const b = new Date(iso.slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}

// ---- Date and time boxes (<input type="datetime-local">), always in Lagos time ----------------
/** A stored timestamp as "YYYY-MM-DDTHH:MM" Lagos wall-clock time, for a datetime-local box. */
export function toLagosInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? "" : new Date(ms + 3_600_000).toISOString().slice(0, 16);
}
/** What a datetime-local box holds (Lagos wall-clock time) as a timestamp to store; null when empty. */
export function fromLagosInput(value: string | null | undefined): string | null {
  if (!value) return null;
  const ms = Date.parse(`${value.slice(0, 16)}:00+01:00`);
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}
/** Age in whole years on today's date (Lagos), from a "YYYY-MM-DD" date of birth. */
export function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return null;
  const today = lagosToday();
  const age = Number(today.slice(0, 4)) - Number(dob.slice(0, 4)) - (today.slice(5) < dob.slice(5, 10) ? 1 : 0);
  return age >= 0 && age < 130 ? age : null;
}
