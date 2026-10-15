// Where to go after the first sign-in, when a signed-out visitor started somewhere
// specific on the public site (e.g. the hero search → /patient/book?specialty=…).
//
// `?next=` is validated, then kept in localStorage ("hn_next", with a timestamp) instead
// of being added to auth redirect URLs, which must match Supabase's allow-list exactly.
// It is used once, within an hour, and only inside the user's own portal.

const KEY = "hn_next";
const MAX_AGE_MS = 60 * 60 * 1000;

/** Same-site path only: one leading "/", no "//" or "/\", no control characters. */
export function isSafeNext(path: unknown): path is string {
  if (typeof path !== "string" || path.length === 0 || path.length > 500) return false;
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return false;
  if (/[\u0000-\u001f\u007f\\]/.test(path)) return false;
  try {
    const base = "https://healingnet.invalid";
    return new URL(path, base).origin === base;
  } catch {
    return false;
  }
}

/** Remember a validated `next` for the first sign-in. Unsafe values are ignored. */
export function saveNext(path: string | null | undefined) {
  if (!isSafeNext(path)) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    /* storage unavailable: fall back to the normal dashboard */
  }
}

/** Read and delete the saved `next`. Returns null if missing, expired or unsafe. */
function takeNext(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof at !== "number" || Date.now() - at > MAX_AGE_MS || Date.now() < at) return null;
    return isSafeNext(path) ? path : null;
  } catch {
    return null;
  }
}

/**
 * Final destination after sign-in. `home` is the user's dashboard from routeForUser
 * (/patient, /doctor, /hospital, /admin or /complete-signup). A saved `next` is used
 * only if it is inside that portal; otherwise the user goes to their dashboard.
 */
export function destinationAfterLogin(home: string): string {
  const next = takeNext();
  if (!next || home === "/complete-signup") return home;
  const path = next.split(/[?#]/)[0];
  return path === home || path.startsWith(`${home}/`) ? next : home;
}
