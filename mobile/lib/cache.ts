// What is saved for offline use (the list is in shared/queryPersist.ts), and how
// everything is cleared on sign-out.
import type { QueryClient } from "@tanstack/react-query";

export { PERSISTED_QUERIES, shouldPersistQuery } from "@/shared/queryPersist";

export interface ClearDeps {
  queryClient: Pick<QueryClient, "clear" | "cancelQueries">;
  /** Deletes every saved query from the encrypted store. */
  clearSaved: () => Promise<unknown> | unknown;
  /** Removes this phone's push registration (needs the session, so it runs first). */
  unregisterPush: () => Promise<void>;
  /** Ends the session and deletes it from the device. */
  endSession: () => Promise<void>;
}

/**
 * Sign-out and account deletion: remove the push registration, the in-memory data,
 * the saved data and the stored session. Each step runs even if an earlier one fails.
 */
export async function clearLocalData({ queryClient, clearSaved, unregisterPush, endSession }: ClearDeps): Promise<void> {
  const quiet = async (step: () => Promise<unknown> | unknown) => { try { await step(); } catch { /* keep clearing */ } };
  await quiet(unregisterPush);
  await quiet(() => queryClient.cancelQueries());
  await quiet(() => queryClient.clear());
  await quiet(clearSaved);
  await quiet(endSession);
  // A save that was already in flight could have written the data again; remove it once more.
  await quiet(clearSaved);
}
