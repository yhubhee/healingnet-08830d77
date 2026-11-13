// What is saved for offline use, and how everything is cleared on sign-out.
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { KeyValueStore } from "./encryptedStorage";

/**
 * Only these queries are saved to the device: the profile (and whether this is a patient
 * account), the family list, appointments, prescription documents (including the code for
 * the QR), the home summary, lab results and medical records. Everything else is fetched
 * fresh. The per-person ones carry the patient id in their key (shared/keys.ts), so each
 * person's saved data is kept apart; sign-out removes all of it.
 */
export const PERSISTED_QUERIES = ["role", "profile", "family", "appointments", "rx-documents", "home-summary", "lab-results", "emr"] as const;

export function shouldPersistQuery(queryKey: QueryKey, status: string): boolean {
  return status === "success" && (PERSISTED_QUERIES as readonly string[]).includes(String(queryKey[0]));
}

export interface ClearDeps {
  queryClient: Pick<QueryClient, "clear" | "cancelQueries">;
  /** Encrypted storage holding the saved query data. */
  storage: KeyValueStore;
  cacheKey: string;
  /** Removes this phone's push registration (needs the session, so it runs first). */
  unregisterPush: () => Promise<void>;
  /** Ends the session and deletes it from the device. */
  endSession: () => Promise<void>;
}

/**
 * Sign-out and account deletion: remove the push registration, the in-memory data,
 * the saved data and the stored session. Each step runs even if an earlier one fails.
 */
export async function clearLocalData({ queryClient, storage, cacheKey, unregisterPush, endSession }: ClearDeps): Promise<void> {
  const quiet = async (step: () => Promise<unknown> | unknown) => { try { await step(); } catch { /* keep clearing */ } };
  await quiet(unregisterPush);
  await quiet(() => queryClient.cancelQueries());
  await quiet(() => queryClient.clear());
  await quiet(() => storage.removeItem(cacheKey));
  await quiet(endSession);
  // A save that was already in flight could have written the data again; remove it once more.
  await quiet(() => storage.removeItem(cacheKey));
}
