// The Supabase client: the same project and publishable key as the website. All rules
// and security live in the database; the app only calls what exists.
import "react-native-get-random-values";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import type { Database } from "@/shared/database";
import { AUTH_STORAGE_KEY } from "./boot";
import { isConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";
import { setPerfSender, setPerfSignedIn, timedFetch } from "./perf";
import { encryptedStorage } from "./storage";

export const supabase = createClient<Database>(
  isConfigured ? SUPABASE_URL : "https://not-configured.invalid",
  isConfigured ? SUPABASE_PUBLISHABLE_KEY : "not-configured",
  {
    auth: {
      storage: encryptedStorage,
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
    // Times each request by type and target (lib/perf.ts); the request itself is untouched.
    global: { fetch: timedFetch },
  },
);

// Speed data is only sent for a signed-in person (the database function requires it).
setPerfSender(async (events) => {
  const { error } = await supabase.rpc("log_perf_events", { p_events: events as unknown as never });
  return !error;
});
supabase.auth.onAuthStateChange((_event, session) => setPerfSignedIn(!!session));

// Tokens are refreshed while the app is in the foreground, and again when it returns.
let watching = false;
export function watchAppStateForAuth() {
  if (watching || !isConfigured) return;
  watching = true;
  if (AppState.currentState === "active") supabase.auth.startAutoRefresh();
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
