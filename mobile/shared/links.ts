// Links between the website and the app: which app screen a website path opens, and the
// few website addresses the app still opens (the video visit, privacy policy and terms).

/** App routes a notification can open. */
export type AppScreen =
  | "/(tabs)" | "/(tabs)/visits" | "/(tabs)/messages" | "/prescriptions" | "/lab-results" | "/records" | "/letters" | "/family";

const SCREENS: [string, AppScreen][] = [
  ["/patient/appointments", "/(tabs)/visits"],
  ["/patient/prescriptions", "/prescriptions"],
  ["/patient/lab-results", "/lab-results"],
  ["/patient/records", "/records"],
  ["/patient/medical-records", "/records"], // the website's own address for the same page
  ["/patient/letters", "/letters"],
  ["/patient/messages", "/(tabs)/messages"],
  ["/patient/settings/family", "/family"], // a family document was approved or not accepted
];

/**
 * Website path (a notification's action_url or a push's data.url) -> app screen.
 * Appointments -> Visits, prescriptions -> Prescriptions, lab results, records, letters and
 * messages -> their own screens, anything else -> Home.
 */
export function screenForUrl(url: unknown): AppScreen {
  if (typeof url !== "string" || !url.trim()) return "/(tabs)";
  let path = url.trim();
  // Full website addresses are accepted too; only the path matters.
  const m = /^[a-z][a-z0-9+.-]*:\/\/[^/]*(\/.*)?$/i.exec(path);
  if (m) path = m[1] ?? "/";
  path = path.split(/[?#]/)[0].replace(/\/+$/, "");
  for (const [prefix, screen] of SCREENS) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return screen;
  }
  return "/(tabs)";
}

export interface NotificationTarget {
  pathname: AppScreen;
  /** `join`: open Visits with the Join call sheet ready for this visit ("ready" = whichever visit the doctor is waiting in). */
  params?: { join: string };
}

/**
 * Where a tapped notification leads, from its type as well as its link:
 *   'call_in' ("Your doctor is ready") -> Visits, with the Join call sheet open for that visit
 *   'message'                          -> Messages
 *   'family' (a document decision)     -> Family
 *   anything else                      -> the screen for its link (screenForUrl)
 * `referenceId` is the appointment for a call; a push does not carry it, so "ready" is used.
 */
export function notificationTarget(n: { url?: unknown; type?: unknown; referenceId?: unknown }): NotificationTarget {
  if (n.type === "call_in") {
    const id = typeof n.referenceId === "string" && /^[0-9a-f-]{36}$/i.test(n.referenceId) ? n.referenceId : "ready";
    return { pathname: "/(tabs)/visits", params: { join: id } };
  }
  if (n.type === "message") return { pathname: "/(tabs)/messages" };
  if (n.type === "family") return { pathname: "/family" };
  return { pathname: screenForUrl(n.url) };
}

const trimSlash = (s: string) => s.replace(/\/+$/, "");

/** What the prescription QR holds: the website's public verify page for this code. */
export function verifyUrl(webUrl: string, code: string): string {
  return `${trimSlash(webUrl)}/verify/${encodeURIComponent(code)}`;
}

/** A page on the website, e.g. webPage(base, "/patient/messages"). */
export function webPage(webUrl: string, path: string): string {
  return `${trimSlash(webUrl)}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The video-visit page for an appointment (opened in the in-app browser). */
export function consultUrl(webUrl: string, appointmentId: string): string {
  return `${trimSlash(webUrl)}/consult/${encodeURIComponent(appointmentId)}?mode=appointment`;
}
