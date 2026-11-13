// TanStack Query: the cache, what is saved to the device (encrypted), and clearing it all.
import NetInfo from "@react-native-community/netinfo";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import type { PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import { saveAccountCheck } from "./boot";
import { clearLocalData, shouldPersistQuery } from "./cache";
import { APP_VERSION } from "./env";
import { unregisterPush } from "./push";
import { cancelAllReminders } from "./reminders";
import { DEVICE_KEYS, encryptedStorage, QUERY_CACHE_KEY, setFlag } from "./storage";
import { supabase } from "./supabase";

const WEEK = 7 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Saved data is kept for a week, so the app still opens offline after a few days.
      gcTime: WEEK,
      retry: 1,
      refetchOnReconnect: true,
    },
  },
});

// Queries pause while the phone is offline and continue when it reconnects.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false)),
);

const persister = createAsyncStoragePersister({
  storage: encryptedStorage,
  key: QUERY_CACHE_KEY,
  throttleTime: 2000,
});

export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister,
  maxAge: WEEK,
  buster: APP_VERSION,
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => shouldPersistQuery(query.queryKey, query.state.status),
  },
};

/** Sign-out and account deletion: clears the data, the saved data, the medicine reminders, the push registration and the session. */
export async function clearEverything(): Promise<void> {
  await clearLocalData({
    queryClient,
    storage: encryptedStorage,
    cacheKey: QUERY_CACHE_KEY,
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
  await saveAccountCheck(null);
  await setFlag(DEVICE_KEYS.appLock, null);
  await setFlag(DEVICE_KEYS.pushToken, null);
  await setFlag(DEVICE_KEYS.labsSeen, null);
}
