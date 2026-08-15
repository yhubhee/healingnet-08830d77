import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHospitalId } from "./useHospitalData";

/**
 * Plan truth lives on the hospital record (written by the Paystack webhook).
 * The subscriptions table is kept as a fallback / billing history.
 */
export function useSubscription() {
  const { data: hospitalId } = useHospitalId();
  return useQuery({
    queryKey: ["hospital-subscription", hospitalId],
    queryFn: async () => {
      if (!hospitalId) return null;

      const { data: hospital } = await supabase
        .from("hospitals")
        .select("active_plan, subscription_status")
        .eq("id", hospitalId)
        .maybeSingle();

      const activePlan = (hospital as any)?.active_plan;
      const subStatus = (hospital as any)?.subscription_status;
      if (activePlan && activePlan !== "none") {
        return { plan: activePlan, status: subStatus } as any;
      }

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
    refetchInterval: (query) =>
      (query.state.data as any)?.status === "active" ? false : 10000,
  });
}

export function hasPlan(current: string | undefined | null, required: "emr" | "telemedicine") {
  if (!current || current === "none") return false;
  if (required === "emr") return ["emr", "telemedicine"].includes(current);
  return current === "telemedicine";
}
