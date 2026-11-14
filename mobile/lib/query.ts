// TanStack Query: the cache, what is saved to the device (encrypted), and clearing it all.
//
// Saved data is one entry per query in a natively encrypted store (lib/cacheStore.ts).
// A query that gets new data is only noted; it is written later, when the app is idle or
// going to the background, never while a tap or a tab change is being handled.
import NetInfo from "@react-native-community/netinfo";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";
import { clearEntries, createQuerySaver, readEntries, WEEK_MS, type SyncStore } from "@/shared/queryPersist";
import { activePerson } from "./activePerson";
import { saveAccountCheck } from "./boot";
import { clearLocalData } from "./cache";
import { cacheStore } from "./cacheStore";
import { clearPerf, devTiming, msSinceTouch } from "./perf";
import { unregisterPush } from "./push";
import { cancelAllReminders } from "./reminders";
import { DEVICE_KEYS, setFlag } from "./storage";
import { supabase } from "./supabase";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Saved data is kept for a week, so the app still opens offline after a few days.
      gcTime: WEEK_MS,
      retry: 1,
      refetchOnReconnect: true,
    },
  },
});

// Queries pause while the phone is offline and continue when it reconnects.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false)),
);

const SAVE_DELAY_MS = 1200;
const QUIET_AFTER_TOUCH_MS = 600;
const idle: (work: () => void) => void =
  typeof globalThis.requestIdleCallback === "function"
    ? (work) => { globalThis.requestIdleCallback(() => work(), { timeout: 3000 }); }
    : (work) => { setTimeout(work, 0); };

/** Later, when nothing is happening: after a pause, once the app is idle, and not just after a tap. */
function whenQuiet(work: () => void): void {
  setTimeout(() => idle(() => {
    if (msSinceTouch() < QUIET_AFTER_TOUCH_MS) whenQuiet(work);
    else work();
  }), SAVE_DELAY_MS);
}

let store: SyncStore | null = null;
let saver: ReturnType<typeof createQuerySaver> | null = null;

async function start(): Promise<void> {
  const opened = await cacheStore;
  store = opened;
  // Put the saved lists in place before the first screen, so it is drawn from them at once.
  const began = Date.now();
  for (const entry of readEntries(opened, Date.now())) {
    queryClient.setQueryData(entry.k, entry.d, { updatedAt: entry.t });
  }
  devTiming("saved data read, took", Date.now() - began, 50);

  const cache = queryClient.getQueryCache();
  const active = createQuerySaver({
    store: opened,
    find: (hash) => cache.get(hash),
    schedule: whenQuiet,
    onWrite: (name, ms, bytes) => devTiming(`cache save of ${name}, ${Math.round(bytes / 1024)} KB, took`, ms, 50),
  });
  saver = active;
  cache.subscribe((event) => {
    if (event.type === "updated" && event.action.type === "success") active.changed(event.query);
    else if (event.type === "removed") active.removed(event.query);
  });
  // Going to the background: write whatever is waiting, now.
  AppState.addEventListener("change", (state) => { if (state !== "active") active.flush(); });
}

/** Resolves once the saved data is in the cache. The first screen waits for it (a few milliseconds). */
export const cacheReady: Promise<void> = start().catch(() => {});

/** Sign-out and account deletion: clears the data, the saved data, the medicine reminders, the push registration and the session. */
export async function clearEverything(): Promise<void> {
  saver?.stop();
  await clearLocalData({
    queryClient,
    clearSaved: () => { if (store) clearEntries(store); },
    unregisterPush: async () => {
      // Medicine reminders first: they must never ring for the next person to use this phone.
      await cancelAllReminders();
      await unregisterPush();
    },
    endSession: async () => {
      // "local" also works offline; the server-side session ends when its token expires.
      const { error } = await supabase.auth.signOut();
      if (error) await supabase.auth.signOut({ scope: "local" });
    },
  });
  saver?.resume();
  // Nothing from this account is sent or shown later.
  clearPerf();
  // The next person to sign in on this phone starts as "Me".
  activePerson.reset();
  await saveAccountCheck(null);
  await setFlag(DEVICE_KEYS.appLock, null);
  await setFlag(DEVICE_KEYS.pushToken, null);
  await setFlag(DEVICE_KEYS.labsSeen, null);
}
