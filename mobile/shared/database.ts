// The website's generated types are in database.types.ts (copied by `npm run sync-types`).
// The mobile-app migration (20261112100000_mobile_app_support) added a few columns and
// functions that the website's generated file does not list yet; their shapes are written
// here by hand. When the website's types are regenerated and synced, these can be removed
// and the calls in lib/ switched to the typed client.
import type { Database, Json } from "./database.types";

export type { Database, Json };
export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

/** New columns on notification_preferences. */
export interface PushPrefs {
  push_enabled: boolean;
  push_appointments: boolean;
  push_prescriptions: boolean;
  push_lab_results: boolean;
  push_other: boolean;
  push_show_details: boolean;
}

/** New database functions and what they take. */
export interface NewFunctions {
  register_push_device: { p_token: string; p_platform: "ios" | "android"; p_app_version?: string };
  unregister_push_device: { p_token: string };
}
