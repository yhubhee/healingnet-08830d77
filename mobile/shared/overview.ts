// Home "Your health": the four cards (prescriptions, lab results, records, letters) from
// patient_health_overview(), and the one line of status each shows. The app and the website
// use the same wording (the website's copy is src/lib/overview.ts).

export interface HealthOverview {
  prescriptions: {
    active: number; total: number;
    latest: { document_id: string; issued_at: string | null; status: string; hospital_name: string | null; medicines: string[] } | null;
  };
  labs: {
    new: number; in_progress: number; total: number;
    latest: { id: string; status: string; created_at: string | null; is_new: boolean; tests: string[]; hospital_name: string | null } | null;
  };
  records: {
    total: number;
    latest: { id: string; title: string | null; entry_type: string | null; created_at: string | null; doctor_name: string | null; hospital_name: string | null } | null;
  };
  letters: {
    total: number;
    latest: { id: string; title: string | null; letter_type: string | null; issued_at: string | null } | null;
  };
}

export type OverviewCardId = "prescriptions" | "labs" | "records" | "letters";

export interface OverviewCard {
  id: OverviewCardId;
  title: string;
  /** One line of status. */
  status: string;
  /** The number in the badge; null for no badge. */
  count: number | null;
  /** The badge needs attention (a new lab result): shown with the word "new", never colour alone. */
  highlight: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const list = (v: unknown) => (Array.isArray(v) ? v.map(text).filter(Boolean) : []);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "12 Nov" in Lagos time, for a timestamp or a "YYYY-MM-DD" date; "" when there is none. */
export function shortDate(value: string | null | undefined): string {
  if (!value) return "";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const ms = Date.parse(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(ms)) return "";
  const d = new Date(dateOnly ? ms : ms + 3600_000);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** What the database returned, made safe to use: a missing part is empty, never a crash. */
export function parseOverview(raw: unknown): HealthOverview {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, Record<string, unknown> | null | undefined>;
  const latest = <T,>(part: Record<string, unknown> | null | undefined) =>
    (part?.latest && typeof part.latest === "object" ? (part.latest as T) : null);
  return {
    prescriptions: { active: num(o.prescriptions?.active), total: num(o.prescriptions?.total), latest: latest(o.prescriptions) },
    labs: { new: num(o.labs?.new), in_progress: num(o.labs?.in_progress), total: num(o.labs?.total), latest: latest(o.labs) },
    records: { total: num(o.records?.total), latest: latest(o.records) },
    letters: { total: num(o.letters?.total), latest: latest(o.letters) },
  };
}

/** "2 active · Amoxicillin, Paracetamol", or "No active prescriptions". */
export function prescriptionsLine(p: HealthOverview["prescriptions"]): string {
  if (p.active <= 0) return "No active prescriptions";
  const medicines = p.latest?.status === "valid" ? list(p.latest.medicines).slice(0, 3) : [];
  return medicines.length ? `${p.active} active · ${medicines.join(", ")}` : `${p.active} active`;
}

/** "1 new result", "2 in progress", or the latest test and its date. */
export function labsLine(l: HealthOverview["labs"]): string {
  if (l.new > 0) return plural(l.new, "new result");
  if (l.in_progress > 0) return `${l.in_progress} in progress`;
  if (!l.latest) return "No lab results yet";
  const tests = list(l.latest.tests);
  const name = tests.length > 1 ? `${tests[0]} and ${tests.length - 1} more` : tests[0] ?? "Lab result";
  return [name, shortDate(l.latest.created_at)].filter(Boolean).join(", ");
}

/** "Last: Consultation note, 12 Nov, Dr Okafor", or "No records yet". */
export function recordsLine(r: HealthOverview["records"]): string {
  if (!r.latest) return "No records yet";
  const title = text(r.latest.title) || text(r.latest.entry_type).replace(/_/g, " ") || "Record";
  return `Last: ${[title, shortDate(r.latest.created_at), text(r.latest.doctor_name)].filter(Boolean).join(", ")}`;
}

/** "3 letters · Sick leave", or "No letters yet". */
export function lettersLine(t: HealthOverview["letters"]): string {
  if (t.total <= 0) return "No letters yet";
  const title = text(t.latest?.title) || text(t.latest?.letter_type).replace(/_/g, " ");
  return [plural(t.total, "letter"), title].filter(Boolean).join(" · ");
}

/** The four cards in order, ready to draw. */
export function overviewCards(o: HealthOverview): OverviewCard[] {
  return [
    { id: "prescriptions", title: "Prescriptions", status: prescriptionsLine(o.prescriptions), count: o.prescriptions.active || null, highlight: false },
    { id: "labs", title: "Lab results", status: labsLine(o.labs), count: o.labs.new || o.labs.total || null, highlight: o.labs.new > 0 },
    { id: "records", title: "Records", status: recordsLine(o.records), count: o.records.total || null, highlight: false },
    { id: "letters", title: "Letters", status: lettersLine(o.letters), count: o.letters.total || null, highlight: false },
  ];
}

/** What a screen reader says for a card. */
export function cardSpoken(c: OverviewCard): string {
  const badge = c.count === null ? "" : c.highlight ? `${c.count} new. ` : `${c.count}. `;
  return `${c.title}. ${badge}${c.status}`;
}

/** Home refreshes the overview when it comes into view, but not more often than this. */
export const OVERVIEW_REFRESH_MS = 30_000;
export const overviewIsDue = (updatedAt: number, now: number) => now - updatedAt >= OVERVIEW_REFRESH_MS;
