// Dates and times in Nigerian time (Africa/Lagos). Lagos is UTC+1 all year, with no
// daylight saving, so these helpers shift by one hour instead of relying on the phone's
// time-zone data. Calendar dates are "YYYY-MM-DD" strings, as the database stores them.

const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const pad = (n: number) => String(n).padStart(2, "0");

/** A Date whose UTC fields read as Lagos wall-clock time. */
const inLagos = (d: Date) => new Date(d.getTime() + LAGOS_OFFSET_MS);
const isDateOnly = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Today's date in Lagos, e.g. "2026-10-15". */
export const lagosToday = (now: Date = new Date()) => inLagos(now).toISOString().slice(0, 10);

/** The current time in Lagos, e.g. "14:05". */
export const lagosNowTime = (now: Date = new Date()) => inLagos(now).toISOString().slice(11, 16);

/** Add whole days to a "YYYY-MM-DD" date. */
export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Day of week (0 = Sunday) of a "YYYY-MM-DD" date. */
export const dayOfWeek = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();

function parts(value: string): Date | null {
  const d = isDateOnly(value) ? new Date(value + "T00:00:00Z") : inLagos(new Date(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "15 Oct 2026" for a "YYYY-MM-DD" date or an ISO timestamp (shown in Lagos time). */
export function fmtLongDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = parts(value);
  return d ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}` : "—";
}

/** "Thu 15 Oct 2026". */
export function fmtDayDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = parts(value);
  return d ? `${DAYS_SHORT[d.getUTCDay()]} ${fmtLongDate(value)}` : "—";
}

/** Short pieces for a day chip: { weekday: "Thu", day: 15, month: "Oct" }. */
export function dayChip(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return { weekday: DAYS_SHORT[d.getUTCDay()], day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()] };
}

/** "09:30" or "09:30:00" -> "9:30 am". */
export function fmt12(time: string | null | undefined): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "am" : "pm"}`;
}

/** "15 Oct 2026, 2:05 pm" for an ISO timestamp, in Lagos time. */
export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = parts(value);
  if (!d) return "—";
  return isDateOnly(value) ? fmtLongDate(value) : `${fmtLongDate(value)}, ${fmt12(`${d.getUTCHours()}:${d.getUTCMinutes()}`)}`;
}

/** The moment an appointment starts: its date and time are Lagos wall-clock values. */
export function appointmentStart(date: string, time: string | null | undefined): Date {
  const t = (time || "09:00").slice(0, 5);
  return new Date(`${date}T${t}:00+01:00`);
}

/** Whole days from today (Lagos) until a "YYYY-MM-DD" date; negative if past. */
export function daysFromToday(iso: string, now: Date = new Date()): number {
  const a = new Date(lagosToday(now) + "T00:00:00Z").getTime();
  const b = new Date(iso.slice(0, 10) + "T00:00:00Z").getTime();
  return Math.round((b - a) / 86_400_000);
}

/** "Just now", "5 min ago", "3h ago", "2d ago". */
export function timeAgo(value: string, now: Date = new Date()): string {
  const mins = Math.floor((now.getTime() - new Date(value).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** The phone's own clock time, "10:42", for "last updated". */
export function fmtClock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "14:59" style countdown from milliseconds. */
export function fmtRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

// ---- Time slots (same rules as the website's booking flow) ---------------------------
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

/** Half-hour start times between two "HH:MM" times. */
export function halfHours(start: string, end: string): string[] {
  const out: string[] = [];
  for (let m = toMin(start); m + 30 <= toMin(end); m += 30) out.push(toTime(m));
  return out;
}
export const DEFAULT_SLOTS = halfHours("08:00", "17:00");
