// Speed tracking: everything that can be worked out without the phone or the browser.
// The app (lib/perf.ts) and the website (src/lib/perf.ts) both use this file; the website's
// copy is src/lib/perfCore.ts.
//
// Only three things are ever recorded: which screen or request it was (a route pattern or
// an endpoint name, never an id), how long it took, and whether it worked. No user id, no
// health data, no names, no tokens, no query strings.

export type PerfKind = "screen" | "request" | "startup";
export type PerfPlatform = "android" | "ios" | "web";
export type PerfNetwork = "wifi" | "cellular" | "offline" | "other" | "unknown";

/** One row for log_perf_events. */
export interface PerfEvent {
  occurred_at: string;
  platform: PerfPlatform;
  app_version: string;
  kind: PerfKind;
  name: string;
  duration_ms: number;
  ok: boolean;
  http_status?: number;
  network: PerfNetwork;
}

export const PERF_BATCH = 50;
export const PERF_MAX_WAITING = 300;
export const PERF_SEND_EVERY_MS = 60_000;
/** Over these, a line is printed to the console in development builds. */
export const SLOW_MS: Record<PerfKind, number> = { screen: 500, request: 1000, startup: 3000 };
/** The one request that is never timed: sending the timings themselves. */
export const PERF_RPC = "rpc:log_perf_events";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const SHARE_CODE = /hn-[a-z0-9]{5}-[a-z0-9]{5}/g;
const LONG_NUMBER = /[0-9]{4,}/g;
const ALLOWED = /^[a-z0-9_:/.\-[\]()]{1,100}$/;

/**
 * A name that is safe to store: lower case, no query string or fragment, and every id,
 * share code and long number replaced. Returns null when what is left is not a plain
 * route or endpoint name (the database applies the same rule again).
 */
export function cleanPerfName(raw: string | null | undefined): string | null {
  const base = String(raw ?? "").split("?")[0].split("#")[0].toLowerCase();
  const name = base.replace(UUID, ":id").replace(SHARE_CODE, ":code").replace(LONG_NUMBER, ":n").slice(0, 100);
  return ALLOWED.test(name) ? name : null;
}

/**
 * A screen name from a route pattern, e.g. "/(tabs)/visits" or "/lab-results/[id]".
 * `fromNetwork` marks a screen that had nothing saved and waited for the network
 * ("/(tabs)/visits:network"); the plain name means it was drawn from saved data.
 */
export function screenName(pattern: string, fromNetwork = false): string | null {
  const name = cleanPerfName(pattern);
  return name && fromNetwork ? cleanPerfName(`${name}:network`) : name;
}

const STORAGE_VERBS = new Set(["sign", "public", "authenticated", "list", "info", "upload", "render", "image"]);

/**
 * The name of a Supabase request, by type and target and nothing else:
 *   rest:<table> · rpc:<function> · fn:<edge function> · storage:<bucket> · auth:<path>
 * Returns null for anything that is not a Supabase API call.
 */
export function requestName(url: string | null | undefined): string | null {
  const path = String(url ?? "").replace(/^[a-z]+:\/\/[^/]+/i, "").split("?")[0].split("#")[0];
  const parts = path.split("/").filter(Boolean);
  const [area, version, ...rest] = parts;
  if (version !== "v1" || rest.length === 0) return null;
  if (area === "rest") return cleanPerfName(rest[0] === "rpc" ? `rpc:${rest[1] ?? ""}` : `rest:${rest[0]}`);
  if (area === "functions") return cleanPerfName(`fn:${rest[0]}`);
  if (area === "auth") return cleanPerfName(`auth:${rest[0]}`);
  if (area === "storage") {
    // /storage/v1/object/<verb>/<bucket>/<path...>: the path inside the bucket holds ids.
    let i = rest[0] === "object" || rest[0] === "render" ? 1 : 0;
    while (i < rest.length - 1 && STORAGE_VERBS.has(rest[i])) i++;
    return cleanPerfName(`storage:${rest[i] ?? "object"}`);
  }
  return null;
}

export const isSlow = (e: Pick<PerfEvent, "kind" | "duration_ms">) => e.duration_ms > SLOW_MS[e.kind];

/** The development console line for a slow event. Holds a name and a time, nothing else. */
export function slowLine(e: Pick<PerfEvent, "kind" | "name" | "duration_ms" | "ok" | "network">): string {
  return `[speed] slow ${e.kind} ${e.name} ${Math.round(e.duration_ms)} ms${e.ok ? "" : " (failed)"} on ${e.network}`;
}

export interface PerfQueueDeps {
  /** Sends one batch; resolves true when the server took it. Must never throw to the user. */
  send: (events: PerfEvent[]) => Promise<boolean>;
  /** The "Share speed data" switch. When false nothing is recorded. */
  enabled: () => boolean;
  /** Online and signed in: the only time a batch is sent. */
  canSend: () => boolean;
  /** Development builds: where the one-line summary of a slow event goes. */
  devLog?: (line: string) => void;
}

export interface PerfQueue {
  record: (event: PerfEvent) => void;
  /** Sends the waiting events, 50 at a time (at most `maxBatches` batches). */
  flush: (maxBatches?: number) => Promise<void>;
  /** Forgets everything that is waiting (the switch was turned off, or sign-out). */
  clear: () => void;
  waiting: () => number;
}

/** Events wait in memory only (never on disk) and go out in batches. */
export function createPerfQueue({ send, enabled, canSend, devLog }: PerfQueueDeps): PerfQueue {
  let waiting: PerfEvent[] = [];
  let sending = false;
  return {
    record(event) {
      if (!enabled()) return;
      const name = cleanPerfName(event.name);
      if (!name || name === PERF_RPC) return;
      const duration = Math.round(event.duration_ms);
      if (!Number.isFinite(duration) || duration < 0 || duration > 120_000) return;
      const clean: PerfEvent = { ...event, name, duration_ms: duration };
      waiting.push(clean);
      // Keep the newest 300: the oldest are dropped first.
      if (waiting.length > PERF_MAX_WAITING) waiting = waiting.slice(waiting.length - PERF_MAX_WAITING);
      if (devLog && isSlow(clean)) devLog(slowLine(clean));
    },
    async flush(maxBatches = 2) {
      if (sending) return;
      sending = true;
      try {
        for (let i = 0; i < maxBatches && waiting.length > 0; i++) {
          if (!enabled()) { waiting = []; return; }
          if (!canSend()) return;
          const batch = waiting.slice(0, PERF_BATCH);
          waiting = waiting.slice(batch.length);
          let ok = false;
          try { ok = await send(batch); } catch { ok = false; }
          if (!ok) {
            // Put them back for the next try; the cap still applies.
            waiting = [...batch, ...waiting].slice(-PERF_MAX_WAITING);
            return;
          }
        }
      } finally {
        sending = false;
      }
    },
    clear() { waiting = []; },
    waiting: () => waiting.length,
  };
}

export interface TimedFetchDeps {
  fetch: typeof fetch;
  now: () => number;
  record: (e: { name: string; duration_ms: number; ok: boolean; http_status: number }) => void;
}

/**
 * A fetch that times each Supabase request. It never changes the request or the response,
 * and it never reads the body, the headers or the query string.
 */
export function createTimedFetch({ fetch: realFetch, now, record }: TimedFetchDeps): typeof fetch {
  return async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as { url: string }).url;
    const name = requestName(url);
    if (!name || name === PERF_RPC) return realFetch(input, init);
    const started = now();
    try {
      const response = await realFetch(input, init);
      record({ name, duration_ms: now() - started, ok: response.ok, http_status: response.status });
      return response;
    } catch (error) {
      record({ name, duration_ms: now() - started, ok: false, http_status: 0 });
      throw error;
    }
  };
}

/** Where a screen's timing starts: the tap that led to it if it was recent, else when it took focus. */
export function screenStart(lastTouchAt: number, focusedAt: number, maxGapMs = 2500): number {
  return lastTouchAt > 0 && lastTouchAt <= focusedAt && focusedAt - lastTouchAt <= maxGapMs ? lastTouchAt : focusedAt;
}
