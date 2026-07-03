import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const DOCTOR_SELF_COLUMNS = "id,user_id,first_name,last_name,email,phone,specialty,years_experience,rating,profile_image_url,bio,is_available,verification_status,verification_rejection_reason,created_at,updated_at";
const PATIENT_LIST_COLUMNS = "id, first_name, last_name, user_id, gender, date_of_birth, phone, genotype, blood_group";

export function useDoctor() {
  return useQuery({
    queryKey: ["doctor", "self"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: doctor, error: doctorError } = await supabase
        .from("my_doctor_profile")
        .select(DOCTOR_SELF_COLUMNS)
        .maybeSingle();

      if (doctorError) throw doctorError;
      if (!doctor) return null;

      const { data: hd, error: hospitalError } = await supabase
        .from("hospital_doctors")
        .select("hospital_id, hospitals:hospital_id(id,name)")
        .eq("doctor_id", doctor.id)
        .eq("is_active", true);

      if (hospitalError) throw hospitalError;

      return { user, doctor, hospitals: (hd || []).map((r: any) => r.hospitals).filter(Boolean) };
    },
  });
}

export function useDoctorPatients(doctorId?: string) {
  return useQuery({
    enabled: !!doctorId,
    queryKey: ["doctor", "patients", doctorId],
    queryFn: async () => {
      const [appts, rx, labs] = await Promise.all([
        supabase.from("patient_appointments").select("patient_id").eq("doctor_id", doctorId!),
        supabase.from("prescriptions").select("patient_id").eq("doctor_id", doctorId!),
        supabase.from("lab_results").select("patient_id").eq("ordered_by", doctorId!),
      ]);

      const ids = Array.from(new Set([
        ...((appts.data || []).map((a: any) => a.patient_id)),
        ...((rx.data || []).map((r: any) => r.patient_id)),
        ...((labs.data || []).map((l: any) => l.patient_id)),
      ].filter(Boolean)));

      if (!ids.length) return [];

      const { data, error } = await supabase
        .from("patients")
        .select(PATIENT_LIST_COLUMNS)
        .in("id", ids)
        .order("first_name");

      if (error) throw error;
      return data || [];
    },
  });
}

export function useDoctorBadges(doctorId?: string, userId?: string) {
  return useQuery({
    enabled: !!doctorId,
    queryKey: ["doctor", "badges", doctorId],
    refetchInterval: 10000,
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
