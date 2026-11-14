// What the app reads from the phone before it shows its first screen: the stored session,
// the result of the last role and profile check, and whether app lock is on. All local,
// so the first screen never waits for the network. The read starts as soon as this file loads.
import type { Session } from "@supabase/supabase-js";
import { parseAccountCheck, storedUserId, type AccountCheck } from "@/shared/startup";
import { activePerson } from "./activePerson";
import { isConfigured, SUPABASE_URL } from "./env";
import { initSpeedData } from "./perf";
import { DEVICE_KEYS, encryptedStorage, getFlag } from "./storage";

/** Where supabase-js keeps the session (its own default name, spelled out so the app can read it too). */
export const AUTH_STORAGE_KEY = `sb-${SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0]}-auth-token`;
export const ACCOUNT_CHECK_KEY = "hn.account-check";

export interface Boot {
  session: Session | null;
  check: AccountCheck | null;
  appLock: boolean;
}

async function readBoot(): Promise<Boot> {
  const empty: Boot = { session: null, check: null, appLock: false };
  if (!isConfigured) return empty;
  try {
    const [rawSession, rawCheck, lock, person, speed] = await Promise.all([
      encryptedStorage.getItem(AUTH_STORAGE_KEY).catch(() => null),
      encryptedStorage.getItem(ACCOUNT_CHECK_KEY).catch(() => null),
      getFlag(DEVICE_KEYS.appLock),
      getFlag(DEVICE_KEYS.activePerson),
      getFlag(DEVICE_KEYS.speedData),
    ]);
    initSpeedData(speed);
    const userId = storedUserId(rawSession);
    // "Who is this for?" is in place before the first screen, so the right person's saved data shows at once.
    activePerson.init(userId ? person : null);
    return {
      session: userId ? (JSON.parse(rawSession!) as Session) : null,
      check: parseAccountCheck(rawCheck, userId),
      appLock: lock === "1",
    };
  } catch {
    return empty;
  }
}

export const boot: Promise<Boot> = readBoot();

export async function saveAccountCheck(check: AccountCheck | null): Promise<void> {
  try {
    if (check) await encryptedStorage.setItem(ACCOUNT_CHECK_KEY, JSON.stringify(check));
    else await encryptedStorage.removeItem(ACCOUNT_CHECK_KEY);
  } catch { /* the check is read again from the network next time */ }
}
