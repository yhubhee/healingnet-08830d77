import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActivePersonId } from "./useActivePerson";
import { useAuth } from "./useAuth";

export function usePatientProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["patient-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("patients").select("*").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

/**
 * The patient id the patient pages read by: the family member chosen under "Who is this
 * for?", or the signed-in patient's own. It is part of every per-person query key, so two
 * people's data never share a cache entry.
 */
export function useActivePatientId(): string | undefined {
  const { data: profile } = usePatientProfile();
  const activeId = useActivePersonId();
  return profile?.id ? (activeId ?? profile.id) : undefined;
}

export function usePatientAppointments() {
  const pid = useActivePatientId();
  return useQuery({
    queryKey: ["patient-appointments", pid],
    queryFn: async () => {
      if (!pid) return [];
      const { data, error } = await supabase
        .from("patient_appointments" as any)
        .select("*, hospitals(name), doctors(first_name, last_name, specialty)")
        .eq("patient_id", pid)
        .order("requested_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!pid,
  });
}

export function usePatientPrescriptions() {
  const pid = useActivePatientId();
  return useQuery({
    queryKey: ["patient-prescriptions", pid],
    queryFn: async () => {
      if (!pid) return [];
      const { data, error } = await supabase
        .from("prescriptions" as any)
        .select("*, hospitals(name), doctors(first_name, last_name)")
        .eq("patient_id", pid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!pid,
  });
}

export function usePatientLabResults() {
  const pid = useActivePatientId();
  return useQuery({
    queryKey: ["patient-lab-results", pid],
    queryFn: async () => {
      if (!pid) return [];
      const { data, error } = await supabase
        .from("lab_results")
        .select("*, hospitals(name), lab_result_tests(*)")
        .eq("patient_id", pid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!pid,
  });
}

export function usePatientEmr() {
  const pid = useActivePatientId();
  return useQuery({
    queryKey: ["patient-emr", pid],
    queryFn: async () => {
      if (!pid) return [];
      const { data, error } = await supabase
        .from("emr_entries")
        .select("*, hospitals(name), doctors:doctor_id(first_name, last_name)")
        .eq("patient_id", pid)
        .eq("is_confidential", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!pid,
  });
}

export function usePatientMessages() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["patient-messages", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("patient_messages" as any)
        .select("*")
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!user,
  });
}

export function useHospitalsList() {
  return useQuery({
    queryKey: ["hospitals-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hospitals").select("id, name, city, state").order("name");
      if (error) throw error;
      return data || [];
    },
  });
}
