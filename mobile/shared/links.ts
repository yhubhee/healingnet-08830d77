// Links between the website and the app: which app screen a website path opens, and the
// website addresses the app hands off to in 0.1.

/** App routes a notification can open. */
export type AppScreen = "/(tabs)" | "/(tabs)/visits" | "/prescriptions";

/**
 * Website path (a notification's action_url or a push's data.url) -> app screen.
 * /patient/appointments -> Visits, /patient/prescriptions -> Prescriptions, anything else -> Home.
 */
export function screenForUrl(url: unknown): AppScreen {
  if (typeof url !== "string" || !url.trim()) return "/(tabs)";
  let path = url.trim();
  // Full website addresses are accepted too; only the path matters.
  const m = /^[a-z][a-z0-9+.-]*:\/\/[^/]*(\/.*)?$/i.exec(path);
  if (m) path = m[1] ?? "/";
  path = path.split(/[?#]/)[0].replace(/\/+$/, "");
  if (path === "/patient/appointments" || path.startsWith("/patient/appointments/")) return "/(tabs)/visits";
  if (path === "/patient/prescriptions" || path.startsWith("/patient/prescriptions/")) return "/prescriptions";
  return "/(tabs)";
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
