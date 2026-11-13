// Which kind of account is signed in. Same checks, in the same order of precedence, as the
// website's routeForUser (src/lib/roles.ts); the five lookups run together, so the answer
// takes one round trip instead of five. The app is for patients only, so it does not accept
// pending staff invites on the user's behalf (the website does that at sign-in).
import type { AccountKind } from "@/shared/startup";
import { supabase } from "./supabase";

export type { AccountKind };

export async function accountKind(userId: string): Promise<AccountKind> {
  const [admin, pharmacy, doctor, hospitals, patient] = await Promise.all([
    supabase.rpc("admin_whoami"),
    supabase.rpc("my_pharmacy"),
    supabase.rpc("my_doctor_id"),
    supabase.rpc("my_hospital_ids"),
    supabase.from("patients").select("id").eq("user_id", userId).maybeSingle(),
  ]);
  if (admin.error) throw admin.error;
  if (admin.data === true) return "admin";
  if (pharmacy.error) throw pharmacy.error;
  if (pharmacy.data && (pharmacy.data as { member?: unknown }).member) return "pharmacy";
  if (doctor.error) throw doctor.error;
  if (doctor.data) return "doctor";
  if (hospitals.error) throw hospitals.error;
  if ((hospitals.data ?? []).some((r) => r.membership === "staff")) return "hospital";
  if (patient.error) throw patient.error;
  return patient.data ? "patient" : "new";
}
