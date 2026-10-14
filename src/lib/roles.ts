import { supabase } from "@/integrations/supabase/client";

// Hospital the signed-in user works at as staff (null if none).
export async function getStaffHospitalId(): Promise<string | null> {
  const { data } = await supabase.rpc("my_hospital_ids");
  const staff = (data ?? []).find((r) => r.membership === "staff");
  return staff?.hospital_id ?? null;
}

// Doctor id of the signed-in user (null if they are not a doctor).
export async function getMyDoctorId(): Promise<string | null> {
  const { data } = await supabase.rpc("my_doctor_id");
  return (data as string | null) ?? null;
}

// Pending staff invites are accepted once per user per page load, right after sign-in.
const invitesChecked = new Set<string>();

// Where to send a signed-in user: /admin, /doctor, /hospital, /patient, or the role picker.
export async function routeForUser(userId: string): Promise<string> {
  const { data: isAdmin } = await supabase.rpc("admin_whoami");
  if (isAdmin === true) return "/admin";
  if (!invitesChecked.has(userId)) {
    invitesChecked.add(userId);
    await supabase.rpc("accept_my_staff_invites"); // best effort; nothing to do if there are none
  }
  if (await getMyDoctorId()) return "/doctor";
  if (await getStaffHospitalId()) return "/hospital";
  const { data: patient } = await supabase.from("patients").select("id").eq("user_id", userId).maybeSingle();
  if (patient) return "/patient";
  return "/complete-signup";
}
