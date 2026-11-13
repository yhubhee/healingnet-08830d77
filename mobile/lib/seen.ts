import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { DEVICE_KEYS } from "./storage";

// ---- "New" on lab results ---------------------------------------------------------------
// The database has no "seen by the patient" mark, so the app remembers on this phone which
// results have been opened. Only ids are kept; they are removed at sign-out.
async function readSeen(): Promise<string[]> {
  try { return JSON.parse((await AsyncStorage.getItem(DEVICE_KEYS.labsSeen)) ?? "[]") as string[]; } catch { return []; }
}
let seenCache: Set<string> | null = null;
const listeners = new Set<() => void>();

export function forgetSeenLabs() {
  seenCache = null;
  listeners.forEach((l) => l());
}

export function useSeenLabs() {
  const [seen, setSeen] = useState<Set<string> | null>(seenCache);
  useEffect(() => {
    const load = () => {
      if (seenCache) return setSeen(seenCache);
      readSeen().then((ids) => { seenCache = new Set(ids); setSeen(seenCache); });
    };
    load();
    listeners.add(load);
    return () => { listeners.delete(load); };
  }, []);
  const markSeen = useCallback((id: string) => {
    if (!seenCache || seenCache.has(id)) return;
    seenCache = new Set(seenCache).add(id);
    AsyncStorage.setItem(DEVICE_KEYS.labsSeen, JSON.stringify([...seenCache].slice(-500))).catch(() => {});
    listeners.forEach((l) => l());
  }, []);
  return { seen, markSeen };
}
