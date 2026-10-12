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

// Where to send a signed-in user: /doctor, /hospital, /patient, or the role picker.
export async function routeForUser(userId: string): Promise<string> {
  if (await getMyDoctorId()) return "/doctor";
  if (await getStaffHospitalId()) return "/hospital";
  const { data: patient } = await supabase.from("patients").select("id").eq("user_id", userId).maybeSingle();
  if (patient) return "/patient";
  return "/complete-signup";
}
