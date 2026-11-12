// Types for the database. database.types.ts is the website's generated file, copied by
// `npm run sync-types`; never edit it here.
import type { Database, Json } from "./database.types";

export type { Database, Json };
export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

/** The push switches on notification_preferences. */
export type PushPrefs = Pick<
  Tables<"notification_preferences">,
  "push_enabled" | "push_appointments" | "push_prescriptions" | "push_lab_results" | "push_other" | "push_show_details"
>;
