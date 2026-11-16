// Scan to check in: reading the hospital's QR code, and the wording of the queue screens.
// The QR at the front desk holds https://<site>/checkin/<token>; the app also opens
// healingnet://checkin/<token>. The website's copy is src/lib/checkin.ts.

export const CHECKIN_REASON_MAX = 300;
export const NOT_A_CHECKIN_CODE = "This isn't a HealingNet check-in code.";
export const SCANNER_OFFLINE = "You're offline. Checking in needs the internet.";

/** The database makes 16-character codes from lower-case letters and digits. */
const TOKEN = /^[a-z0-9]{8,64}$/;

/** A code typed by hand: spaces and dashes are dropped, capitals are accepted. */
export function cleanCheckinToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase().replace(/[\s-]+/g, "");
  return TOKEN.test(t) ? t : null;
}

const hostOf = (url: string): string | null => {
  const m = /^https?:\/\/([^/?#]+)/i.exec(url.trim());
  return m ? m[1].toLowerCase().replace(/^www\./, "") : null;
};

/**
 * The token inside a scanned or opened link, or null when it is not one of ours.
 * Accepted: healingnet://checkin/<token> and https://<our site>/checkin/<token>, where
 * "our site" is one of `sites` (full addresses, e.g. the app's WEB_URL). Nothing else:
 * not http, not another host, not another path.
 */
export function parseCheckinUrl(raw: unknown, sites: readonly string[]): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > 300 || /[\s\u0000-\u001f]/.test(text)) return null;
  const app = /^healingnet:\/\/\/?checkin\/([^/?#]+)\/?(?:[?#].*)?$/i.exec(text);
  if (app) return strictToken(app[1]);
  const web = /^https:\/\/([^/?#]+)\/checkin\/([^/?#]+)\/?(?:[?#].*)?$/i.exec(text);
  if (!web) return null;
  const host = web[1].toLowerCase().replace(/^www\./, "");
  if (host.includes("@")) return null;
  const allowed = sites.map(hostOf).filter((h): h is string => !!h);
  return allowed.includes(host) ? strictToken(web[2]) : null;
}

const strictToken = (t: string) => (TOKEN.test(t.toLowerCase()) ? t.toLowerCase() : null);

/** What the QR holds. */
export const checkinUrl = (site: string, token: string) => `${site.replace(/\/+$/, "")}/checkin/${encodeURIComponent(token)}`;
/** "Open in the app" on the website. */
export const checkinAppLink = (token: string) => `healingnet://checkin/${encodeURIComponent(token)}`;

// ---- What the database returns ------------------------------------------------------------
export interface CheckinLookup {
  hospital_id: string;
  name: string;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  appointment_today: { id: string; requested_time: string | null; doctor_name: string | null } | null;
  already_checked_in: { id: string; queue_number: number | null; status: string } | null;
  already_linked: boolean;
}

export interface CheckinStatus {
  checkin_id: string;
  hospital_id?: string | null;
  hospital_name: string;
  queue_number: number | null;
  status: string;
  ahead: number;
  doctor_name: string | null;
  checkin_time: string | null;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
const int = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);

export function parseLookup(raw: unknown): CheckinLookup | null {
  const o = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!o || !str(o.hospital_id)) return null;
  const a = (o.appointment_today && typeof o.appointment_today === "object" ? o.appointment_today : null) as Record<string, unknown> | null;
  const c = (o.already_checked_in && typeof o.already_checked_in === "object" ? o.already_checked_in : null) as Record<string, unknown> | null;
  return {
    hospital_id: String(o.hospital_id), name: str(o.name) ?? "Hospital", city: str(o.city), state: str(o.state), logo_url: str(o.logo_url),
    appointment_today: a && str(a.id) ? { id: String(a.id), requested_time: str(a.requested_time), doctor_name: str(a.doctor_name) } : null,
    already_checked_in: c && str(c.id) ? { id: String(c.id), queue_number: typeof c.queue_number === "number" ? c.queue_number : null, status: str(c.status) ?? "checked_in" } : null,
    already_linked: o.already_linked === true,
  };
}

export function parseStatuses(raw: unknown): CheckinStatus[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((r): r is Record<string, unknown> => !!r && typeof r === "object" && !!str((r as Record<string, unknown>).checkin_id)).map((r) => ({
    checkin_id: String(r.checkin_id), hospital_id: str(r.hospital_id), hospital_name: str(r.hospital_name) ?? "Hospital",
    queue_number: typeof r.queue_number === "number" ? r.queue_number : null, status: str(r.status) ?? "checked_in",
    ahead: int(r.ahead), doctor_name: str(r.doctor_name), checkin_time: str(r.checkin_time),
  }));
}

// ---- Wording ------------------------------------------------------------------------------
/** Still in the queue or with the doctor today. */
export const isOpenCheckin = (c: Pick<CheckinStatus, "status">) => ["checked_in", "waiting", "called", "in_consultation"].includes(c.status);
/** The patient may still leave the queue (the database refuses once they are called). */
export const canLeaveQueue = (c: Pick<CheckinStatus, "status">) => c.status === "checked_in" || c.status === "waiting";

/** "3 people ahead of you", "1 person ahead of you", "You're next". */
export function aheadText(ahead: number): string {
  const n = int(ahead);
  return n === 0 ? "You're next" : n === 1 ? "1 person ahead of you" : `${n} people ahead of you`;
}

/** The big line on the status screen. */
export function checkinHeadline(status: string): string {
  switch (status) {
    case "called": return "It's your turn";
    case "in_consultation": return "You're with the doctor";
    case "completed": return "Your visit is finished";
    case "cancelled": return "You left the queue";
    default: return "You're checked in";
  }
}

/** The line under it. */
export function checkinDetail(c: Pick<CheckinStatus, "status" | "ahead">): string {
  switch (c.status) {
    case "called": return "Please go to the front desk now.";
    case "in_consultation": return "";
    case "completed": return "Thank you for coming.";
    case "cancelled": return "Scan the code again if you still need to be seen.";
    default: return `${aheadText(c.ahead)}. We'll notify you when it's your turn. Stay nearby.`;
  }
}

/** Home card: "Queue #12 at City Hospital · 3 ahead", or "It's your turn at City Hospital". */
export function queueLine(c: Pick<CheckinStatus, "status" | "ahead" | "queue_number" | "hospital_name">): string {
  if (c.status === "called") return `It's your turn at ${c.hospital_name}`;
  if (c.status === "in_consultation") return `With the doctor at ${c.hospital_name}`;
  const n = int(c.ahead);
  return `Queue #${c.queue_number ?? "–"} at ${c.hospital_name} · ${n === 0 ? "you're next" : `${n} ahead`}`;
}

/** The open check-in to show on Home: a called one first, then the latest. */
export function currentCheckin<T extends Pick<CheckinStatus, "status">>(list: readonly T[]): T | null {
  const open = list.filter(isOpenCheckin);
  return open.find((c) => c.status === "called") ?? open[0] ?? null;
}

/** "You have a visit today at 10:30 am with Dr Ade" on the confirm screen. */
export function visitTodayLine(a: CheckinLookup["appointment_today"], fmtTime: (t: string) => string): string | null {
  if (!a) return null;
  const at = a.requested_time ? ` at ${fmtTime(a.requested_time)}` : "";
  return `You have a visit today${at}${a.doctor_name ? ` with ${a.doctor_name}` : ""}.`;
}

/** Shown before the button when the hospital is not linked to this person yet. */
export const linkNotice = (hospital: string) => `${hospital} will be able to see your profile and health card so they can care for you.`;

// ---- The front desk's queue ---------------------------------------------------------------
const APP_NOTE = "Checked in with the HealingNet app";

/** A check-in's notes: was it made with the app, and the patient's own reason (after "Reason:"). */
export function parseCheckinNotes(notes: string | null | undefined): { viaApp: boolean; reason: string | null } {
  const text = (notes ?? "").trim();
  const viaApp = text.startsWith(APP_NOTE);
  const m = /(?:^|\.\s*)Reason:\s*([\s\S]+)$/.exec(text);
  return { viaApp, reason: viaApp ? (m ? m[1].trim() || null : null) : null };
}
