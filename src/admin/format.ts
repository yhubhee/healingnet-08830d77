// Formatting helpers for the admin console: money in naira, dates in Africa/Lagos time.
import { friendlyError } from "@/lib/errors";

const TZ = "Africa/Lagos";

const nairaFull = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });
const nairaCompact = new Intl.NumberFormat("en-NG", {
  style: "currency", currency: "NGN", notation: "compact", maximumFractionDigits: 1,
});
const num = new Intl.NumberFormat("en-NG");

/** Kobo (payments.amount and every *_kobo value) to naira. */
export const koboToNaira = (kobo: number | null | undefined) => (Number(kobo) || 0) / 100;
export const naira = (n: number) => nairaFull.format(n);
export const nairaShort = (n: number) => (Math.abs(n) >= 100_000 ? nairaCompact.format(n) : nairaFull.format(n));
export const fmtNum = (n: number | null | undefined) => num.format(Number(n) || 0);

const dateTime = new Intl.DateTimeFormat("en-NG", {
  timeZone: TZ, day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
});
const dateOnly = new Intl.DateTimeFormat("en-NG", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });

/** Absolute date and time in Lagos, e.g. "14 Oct 2026, 3:05 pm". */
export const fmtDateTime = (iso: string | null | undefined) => (iso ? dateTime.format(new Date(iso)) : "—");
export const fmtDate = (iso: string | null | undefined) => (iso ? dateOnly.format(new Date(iso)) : "—");

/** A calendar date ("2026-10-14", no time zone) as "14 Oct". */
export function fmtDay(day: string, withYear = false) {
  const d = new Date(day + "T00:00:00Z");
  return d.toLocaleDateString("en-NG", { timeZone: "UTC", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

/** Short relative time: "just now", "5 min ago", "3 h ago", "2 d ago", "4 mo ago". */
export function ago(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return "—";
  const s = Math.round((now - new Date(iso).getTime()) / 1000);
  if (s < 0) return "in the future";
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d < 45) return `${d} d ago`;
  const mo = Math.round(d / 30);
  if (mo < 18) return `${mo} mo ago`;
  return `${Math.round(d / 365)} y ago`;
}

/** Whole days from now until a date (negative if it has passed). */
export function daysUntil(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - now) / 86_400_000);
}

/** Whole days since a date. */
export function daysSince(iso: string | null | undefined, now = Date.now()) {
  if (!iso) return 0;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

export const titleCase = (s: string | null | undefined) =>
  (s || "").replace(/[_.]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const ACTIONS: Record<string, string> = {
  "hospital.approve": "Approved hospital",
  "hospital.reject": "Rejected hospital",
  "hospital.suspend": "Suspended hospital",
  "hospital.reactivate": "Reactivated hospital",
  "hospital.extend_trial": "Extended trial for",
  "doctor.approve": "Approved doctor",
  "doctor.reject": "Rejected doctor",
  "payment.refund_resolved": "Marked refund done for payment",
  "contact.handled": "Marked contact message handled",
  "contact.reopened": "Reopened contact message",
};
export const actionLabel = (a: string) => ACTIONS[a] ?? titleCase(a);

/**
 * Message for a failed admin action. The admin functions raise plain-English errors
 * ("This hospital has a paid plan running"), so show those as-is; map only
 * permission / network problems to the shared friendly text.
 */
export function actionError(e: unknown) {
  const msg = String((e as { message?: string })?.message ?? "");
  const code = String((e as { code?: string })?.code ?? "");
  if (!msg || code === "42501" || /permission|jwt|network|failed to fetch/i.test(msg)) return friendlyError(e);
  return msg;
}

/** Build and download a CSV file in the browser. */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** "+12% vs previous 30 days" style comparison. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

/** [0, 1, …, n-1], for rendering n skeleton rows. */
export const times = (n: number) => [...Array(n).keys()];
