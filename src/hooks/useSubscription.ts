import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHospitalId } from "./useHospitalData";

export function useSubscription() {
  const { data: hospitalId } = useHospitalId();
  return useQuery({
    queryKey: ["hospital-subscription", hospitalId],
    queryFn: async () => {
      if (!hospitalId) return null;
      const { data, error } = await supabase
        .from("hospital_subscriptions" as any)
        .select("*")
        .eq("hospital_id", hospitalId)
        .eq("status", "active")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!hospitalId,
  });
}

export function hasPlan(current: string | undefined | null, required: "emr" | "telemedicine") {
  if (!current) return false;
  if (required === "emr") return ["emr", "telemedicine"].includes(current);
  return current === "telemedicine";
}
