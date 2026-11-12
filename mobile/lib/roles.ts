// Which kind of account is signed in. Same checks, in the same order, as the website's
// routeForUser (src/lib/roles.ts). The app is for patients only, so it does not accept
// pending staff invites on the user's behalf (the website does that at sign-in).
import { supabase } from "./supabase";

export type AccountKind = "patient" | "admin" | "pharmacy" | "doctor" | "hospital" | "new";

export async function accountKind(userId: string): Promise<AccountKind> {
  const admin = await supabase.rpc("admin_whoami");
  if (admin.error) throw admin.error;
  if (admin.data === true) return "admin";

  const pharmacy = await supabase.rpc("my_pharmacy");
  if (pharmacy.error) throw pharmacy.error;
  if (pharmacy.data && (pharmacy.data as { member?: unknown }).member) return "pharmacy";

  const doctor = await supabase.rpc("my_doctor_id");
  if (doctor.error) throw doctor.error;
  if (doctor.data) return "doctor";

  const hospitals = await supabase.rpc("my_hospital_ids");
  if (hospitals.error) throw hospitals.error;
  if ((hospitals.data ?? []).some((r) => r.membership === "staff")) return "hospital";

  const patient = await supabase.from("patients").select("id").eq("user_id", userId).maybeSingle();
  if (patient.error) throw patient.error;
  return patient.data ? "patient" : "new";
}
