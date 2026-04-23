import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

export function usePatientAppointments() {
  const { data: profile } = usePatientProfile();
  return useQuery({
    queryKey: ["patient-appointments", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("patient_appointments" as any)
        .select("*, hospitals(name), doctors(first_name, last_name, specialty)")
        .eq("patient_id", profile.id)
        .order("requested_date", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!profile,
  });
}

export function usePatientPrescriptions() {
  const { data: profile } = usePatientProfile();
  return useQuery({
    queryKey: ["patient-prescriptions", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("prescriptions" as any)
        .select("*, hospitals(name), doctors(first_name, last_name)")
        .eq("patient_id", profile.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!profile,
  });
}

export function usePatientLabResults() {
  const { data: profile } = usePatientProfile();
  return useQuery({
    queryKey: ["patient-lab-results", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("lab_results")
        .select("*, hospitals(name), lab_result_tests(*)")
        .eq("patient_id", profile.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile,
  });
}

export function usePatientEmr() {
  const { data: profile } = usePatientProfile();
  return useQuery({
    queryKey: ["patient-emr", profile?.id],
    queryFn: async () => {
      if (!profile) return [];
      const { data, error } = await supabase
        .from("emr_entries")
        .select("*, hospitals(name), doctors:doctor_id(first_name, last_name)")
        .eq("patient_id", profile.id)
        .eq("is_confidential", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile,
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
