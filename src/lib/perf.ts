// Speed tracking on the website: how long pages and requests take, so slow ones can be
// found and fixed. Same rules as the app (src/lib/perfCore.ts is a copy of
// mobile/shared/perf.ts): a route pattern or endpoint name, a time and whether it worked.
// Never an id, a name, health data, a token or a query string.
//
// Only for signed-in people (the database function requires it). Events wait in memory and
// go out 50 at a time, every minute and when the tab is hidden. Sending never blocks the
// page and never shows an error. "Share speed data" in patient Settings turns it off.
import { useEffect } from "react";
import { matchPath, useLocation } from "react-router-dom";
import {
  cleanPerfName, createPerfQueue, createTimedFetch, PERF_SEND_EVERY_MS, screenName, type PerfEvent, type PerfKind, type PerfNetwork,
} from "./perfCore";

/** The website's version in the speed data, so a release can be compared with the one before. */
export const WEB_VERSION = "0.4.0";
const SWITCH_KEY = "hn.speed-data";

// ---- The switch ---------------------------------------------------------------------------
function readSwitch(): boolean {
  try { return localStorage.getItem(SWITCH_KEY) !== "off"; } catch { return true; }
}
let enabled = readSwitch();
export const speedDataEnabled = () => enabled;
export function setSpeedDataEnabled(on: boolean): void {
  enabled = on;
  if (!on) queue.clear();
  try { if (on) localStorage.removeItem(SWITCH_KEY); else localStorage.setItem(SWITCH_KEY, "off"); } catch { /* private browsing */ }
}

// ---- Sending ------------------------------------------------------------------------------
type Sender = (events: PerfEvent[]) => Promise<boolean>;
let sender: Sender | null = null;
let signedIn = false;

function network(): PerfNetwork {
  if (typeof navigator === "undefined") return "unknown";
  if (navigator.onLine === false) return "offline";
  const type = (navigator as Navigator & { connection?: { type?: string } }).connection?.type;
  return type === "wifi" ? "wifi" : type === "cellular" ? "cellular" : type ? "other" : "unknown";
}

const queue = createPerfQueue({
  send: (events) => (sender ? sender(events) : Promise.resolve(false)),
  enabled: () => enabled,
  canSend: () => signedIn && !!sender && (typeof navigator === "undefined" || navigator.onLine !== false),
  devLog: import.meta.env.DEV ? (line) => console.log(line) : undefined,
});

function record(kind: PerfKind, name: string, durationMs: number, ok = true, httpStatus?: number): void {
  queue.record({
    occurred_at: new Date().toISOString(), platform: "web", app_version: WEB_VERSION, kind, name,
    duration_ms: durationMs, ok, ...(httpStatus === undefined ? {} : { http_status: httpStatus }), network: network(),
  });
}

let started = false;
/** Called once by the Supabase client: who sends, and whether anyone is signed in. */
export function attachPerf(send: Sender, onAuth: (listener: (isSignedIn: boolean) => void) => void): void {
  sender = send;
  onAuth((isSignedIn) => {
    signedIn = isSignedIn;
    if (!isSignedIn) queue.clear(); // nothing from a signed-out visit is kept
  });
  if (started || typeof window === "undefined") return;
  started = true;
  window.setInterval(() => { queue.flush(1); }, PERF_SEND_EVERY_MS);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") queue.flush(3); });
}

// ---- Requests -----------------------------------------------------------------------------
let inFlight = 0;
let lastSettledAt = 0;
const countingFetch: typeof fetch = async (input, init) => {
  inFlight++;
  try { return await fetch(input, init); } finally { inFlight--; lastSettledAt = performance.now(); }
};

/** Given to createClient as global.fetch. */
export const timedFetch = createTimedFetch({
  fetch: countingFetch,
  now: () => performance.now(),
  record: (e) => { if (signedIn) record("request", e.name, e.duration_ms, e.ok, e.http_status); },
});

// ---- Pages --------------------------------------------------------------------------------
// Routes with an id in them, as their patterns. Everything else under the signed-in areas
// is a fixed path and is used as it is (after the same cleaning the database applies).
const PATTERNS = [
  "/patient/prescriptions/:documentId/print", "/doctor/prescriptions/:documentId/print", "/hospital/prescriptions/:documentId/print",
  "/doctor/patients/:id", "/doctor/consultation/:consultationId", "/hospital/emr/:type", "/consult/:id", "/admin/hospitals/:id", "/admin/doctors/:id",
];
const AREAS = ["/patient", "/doctor", "/hospital", "/admin", "/pharmacy", "/consult"];

/** The route pattern for a path, or null for pages that are not timed (public pages, unknown addresses). */
export function routePattern(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const pattern = PATTERNS.find((p) => matchPath({ path: p, end: true }, path));
  if (pattern) return pattern.replace(/:[a-zA-Z]+/g, ":id");
  if (!AREAS.some((a) => path === a || path.startsWith(`${a}/`))) return null;
  // No segment of a fixed route is long; anything long is not a route name.
  if (path.split("/").some((s) => s.length > 32)) return null;
  return cleanPerfName(path);
}

const SETTLE_MS = 300;
const GIVE_UP_MS = 20_000;

/**
 * Mounted once inside the router. Times each page from the navigation (or the page load) to
 * the moment its requests have finished and the result has been drawn: the first time the
 * page shows its content.
 */
export function PerfRoutes(): null {
  const { pathname } = useLocation();
  useEffect(() => {
    const pattern = routePattern(pathname);
    if (!pattern || !enabled) return;
    // The first page of a visit is timed from the start of the page load.
    const first = !PerfRoutes.seen;
    PerfRoutes.seen = true;
    const start = first ? 0 : performance.now();
    let waited = false;
    let cancelled = false;
    // A page that asks for nothing is ready at its first frame.
    let firstFrameAt = 0;
    requestAnimationFrame(() => { firstFrameAt = performance.now(); });
    const timer = window.setInterval(() => {
      if (cancelled) return;
      const now = performance.now();
      if (inFlight > 0) { waited = true; if (now - start < GIVE_UP_MS) return; }
      const quietSince = Math.max(start, waited ? lastSettledAt : start);
      if (inFlight === 0 && now - quietSince < SETTLE_MS) return;
      window.clearInterval(timer);
      const end = waited ? Math.max(lastSettledAt, start) : start;
      requestAnimationFrame(() => {
        if (cancelled || !signedIn) return;
        const name = screenName(pattern, waited);
        if (name) record("screen", name, Math.max(0, (waited ? end : firstFrameAt || performance.now()) - start));
      });
    }, 50);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [pathname]);
  return null;
}
PerfRoutes.seen = false;
