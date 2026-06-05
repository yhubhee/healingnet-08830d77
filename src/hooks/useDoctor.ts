import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDoctor() {
  return useQuery({
    queryKey: ["doctor", "self"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data: doctor } = await supabase.from("doctors").select("*").eq("user_id", user.id).maybeSingle();
      if (!doctor) return null;
      const { data: hd } = await supabase.from("hospital_doctors")
        .select("hospital_id, hospitals:hospital_id(id,name)")
        .eq("doctor_id", doctor.id).eq("is_active", true);
      return { user, doctor, hospitals: (hd || []).map((r: any) => r.hospitals).filter(Boolean) };
    },
  });
}

export function useDoctorPatients(doctorId?: string) {
  return useQuery({
    enabled: !!doctorId,
    queryKey: ["doctor", "patients", doctorId],
    queryFn: async () => {
      const { data: appts } = await supabase.from("patient_appointments").select("patient_id").eq("doctor_id", doctorId!);
      const ids = Array.from(new Set((appts || []).map((a: any) => a.patient_id)));
      if (!ids.length) return [];
      const { data } = await supabase.from("patients").select("id, first_name, last_name, user_id, gender, date_of_birth").in("id", ids);
      return data || [];
    },
  });
}

export function useDoctorBadges(doctorId?: string, userId?: string) {
  return useQuery({
    enabled: !!doctorId,
    queryKey: ["doctor", "badges", doctorId],
    refetchInterval: 30000,
    queryFn: async () => {
      const [appts, cons, msgs] = await Promise.all([
        supabase.from("patient_appointments").select("id", { count: "exact", head: true }).eq("doctor_id", doctorId!).eq("status", "pending"),
        supabase.from("consultation_requests").select("id", { count: "exact", head: true }).eq("doctor_id", doctorId!).eq("status", "pending"),
        userId ? supabase.from("patient_messages").select("id", { count: "exact", head: true }).eq("to_user_id", userId).eq("is_read", false) : Promise.resolve({ count: 0 } as any),
      ]);
      return {
        appointments: appts.count || 0,
        consultations: cons.count || 0,
        messages: (msgs as any).count || 0,
      };
    },
  });
}
