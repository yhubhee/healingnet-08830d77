// Speed tracking in the app: how long screens, requests and start-up take, so slow ones
// can be found and fixed. The rules are in shared/perf.ts: a route pattern or endpoint
// name, a time and whether it worked. Never an id, a name, health data or a token.
//
// Events wait in memory (never on disk) and are sent 50 at a time, every minute and when
// the app goes to the background, only while online and signed in. Sending never blocks
// the screen and never shows an error. "Share speed data" in Me turns all of it off.
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { AppState, Platform, type GestureResponderEvent } from "react-native";
import {
  createPerfQueue, createTimedFetch, PERF_SEND_EVERY_MS, screenName, screenStart,
  type PerfEvent, type PerfKind, type PerfNetwork,
} from "@/shared/perf";
import { APP_VERSION } from "./env";
import { DEVICE_KEYS, getFlag, setFlag } from "./storage";

// The earliest moment this file can see. Start-up is measured from the process start when
// React Native reports it, otherwise from here.
const LOADED_AT = Date.now();
const platform = Platform.OS === "ios" ? "ios" : "android";

// ---- The switch ---------------------------------------------------------------------------
let enabled = true;
const switchListeners = new Set<() => void>();

/** Read once at start-up (lib/boot.ts). On unless the person turned it off. */
export function initSpeedData(saved: string | null): void {
  enabled = saved !== "off";
  if (!enabled) queue.clear();
}
export function setSpeedDataEnabled(on: boolean): void {
  enabled = on;
  if (!on) queue.clear();
  setFlag(DEVICE_KEYS.speedData, on ? null : "off");
  switchListeners.forEach((l) => l());
}
export const useSpeedDataEnabled = () =>
  useSyncExternalStore((l) => { switchListeners.add(l); return () => { switchListeners.delete(l); }; }, () => enabled, () => enabled);
export const readSpeedDataFlag = () => getFlag(DEVICE_KEYS.speedData);

// ---- Network ------------------------------------------------------------------------------
let network: PerfNetwork = "unknown";
let online = true;
NetInfo.addEventListener((state) => {
  online = state.isConnected !== false && state.isInternetReachable !== false;
  network = state.isConnected === false ? "offline"
    : state.type === "wifi" ? "wifi"
    : state.type === "cellular" ? "cellular"
    : state.type === "unknown" ? "unknown" : "other";
});

// ---- Sending ------------------------------------------------------------------------------
type Sender = (events: PerfEvent[]) => Promise<boolean>;
let sender: Sender | null = null;
let signedIn = false;

/** lib/supabase.ts supplies the call, so this file never imports the client. */
export function setPerfSender(send: Sender): void { sender = send; }
export function setPerfSignedIn(value: boolean): void { signedIn = value; }

const queue = createPerfQueue({
  send: (events) => (sender ? sender(events) : Promise.resolve(false)),
  enabled: () => enabled,
  canSend: () => online && signedIn && !!sender,
  devLog: __DEV__ ? (line) => console.log(line) : undefined,
});

function record(kind: PerfKind, name: string, durationMs: number, ok = true, httpStatus?: number): void {
  queue.record({
    occurred_at: new Date().toISOString(), platform, app_version: APP_VERSION, kind, name,
    duration_ms: durationMs, ok, ...(httpStatus === undefined ? {} : { http_status: httpStatus }), network,
  });
}

/** Sign-out: nothing from this account is sent later. */
export const clearPerf = () => queue.clear();

let started = false;
/** Called once from the root layout: the minute timer and the send on going to the background. */
export function startPerf(): void {
  if (started) return;
  started = true;
  setInterval(() => { queue.flush(1); }, PERF_SEND_EVERY_MS);
  AppState.addEventListener("change", (state) => { if (state !== "active") queue.flush(3); });
}

// ---- Requests -----------------------------------------------------------------------------
/** Given to createClient as global.fetch. */
export const timedFetch = createTimedFetch({
  fetch: (input, init) => fetch(input, init),
  now: () => Date.now(),
  record: (e) => record("request", e.name, e.duration_ms, e.ok, e.http_status),
});

// ---- Screens ------------------------------------------------------------------------------
let lastTouchAt = 0;

/**
 * On the root view (onTouchStart). The time the finger went down, taken from the phone's
 * own clock for the touch where that can be read, so a busy app that handles the tap late
 * is still measured from the real tap.
 */
export function noteTouch(event: GestureResponderEvent): void {
  const now = Date.now();
  const stamp = event?.nativeEvent?.timestamp;
  const mono = globalThis.performance?.now?.();
  const lag = typeof stamp === "number" && typeof mono === "number" ? mono - stamp : -1;
  lastTouchAt = lag >= 0 && lag < 30_000 ? now - lag : now;
}

/**
 * Times a screen from the tap that opened it to its first draw with content. `pattern` is
 * the route pattern ("/(tabs)/visits", "/lab-results/[id]"), never a real id. `ready` is
 * true once there is content to show; `fromNetwork` says it had to wait for the network
 * because nothing was saved. One event per visit to the screen.
 */
export function useScreenReady(pattern: string, ready: boolean, fromNetwork = false): void {
  const focus = useRef<{ start: number; done: boolean; waited: boolean } | null>(null);
  const readyRef = useRef(ready);
  readyRef.current = ready;
  const networkRef = useRef(fromNetwork);
  if (!ready && fromNetwork) networkRef.current = true;

  const finish = useCallback(() => {
    const f = focus.current;
    if (!f || f.done) return;
    f.done = true;
    const waited = f.waited || networkRef.current;
    // After the frame that shows the content has been drawn.
    requestAnimationFrame(() => {
      const name = screenName(pattern, waited);
      if (name) record("screen", name, Date.now() - f.start);
    });
  }, [pattern]);

  useFocusEffect(useCallback(() => {
    const now = Date.now();
    focus.current = { start: screenStart(lastTouchAt, now), done: false, waited: !readyRef.current };
    networkRef.current = false;
    if (readyRef.current) finish();
    return () => { focus.current = null; };
  }, [finish]));

  useEffect(() => { if (ready) finish(); }, [ready, finish]);
}

// ---- Start-up -----------------------------------------------------------------------------
let startupDone = false;

function processStart(): number {
  // React Native reports when the process began on the same clock as performance.now().
  const perf = globalThis.performance as (Performance & { rnStartupTiming?: { startTime?: number | null } }) | undefined;
  const mono = perf?.now?.();
  const begin = perf?.rnStartupTiming?.startTime;
  if (typeof mono === "number" && typeof begin === "number" && begin >= 0 && mono >= begin && mono - begin < 120_000) {
    return Date.now() - (mono - begin);
  }
  return LOADED_AT;
}

/** Once per process: from the process start to the first screen being visible. */
export function markStartup(screen: "home" | "welcome"): void {
  if (startupDone) return;
  startupDone = true;
  requestAnimationFrame(() => record("startup", `startup:${screen}`, Date.now() - processStart()));
}

/** Development only: a console line for work that held up the app (no ids, no data). */
export function devTiming(label: string, ms: number, slowMs = 100): void {
  if (__DEV__ && ms > slowMs) console.log(`[speed] ${label} ${Math.round(ms)} ms`);
}
