// Public settings from mobile/.env (see .env.example). Only the publishable key is used:
// the service-role key must never be in the app.
import Constants from "expo-constants";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? "https://healingnet-08830d77.vercel.app").replace(/\/+$/, "");

/** False until mobile/.env is filled in; the app then shows a setup message instead of crashing. */
export const isConfigured = /^https:\/\//.test(SUPABASE_URL) && SUPABASE_PUBLISHABLE_KEY.length > 0;

export const APP_VERSION = Constants.expoConfig?.version ?? "0.1.0";

/** Deep links the app registers (add healingnet://** to Supabase's redirect URLs). */
export const AUTH_CALLBACK = "healingnet://auth-callback";
export const RESET_PASSWORD_LINK = "healingnet://reset-password";
