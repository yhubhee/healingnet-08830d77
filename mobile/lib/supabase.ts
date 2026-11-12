// The Supabase client: the same project and publishable key as the website. All rules
// and security live in the database; the app only calls what exists.
import "react-native-get-random-values";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";
import type { Database } from "@/shared/database";
import { isConfigured, SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./env";
import { encryptedStorage } from "./storage";

export const supabase = createClient<Database>(
  isConfigured ? SUPABASE_URL : "https://not-configured.invalid",
  isConfigured ? SUPABASE_PUBLISHABLE_KEY : "not-configured",
  {
    auth: {
      storage: encryptedStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
    },
  },
);

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
