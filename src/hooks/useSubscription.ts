import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useHospitalId } from "./useHospitalData";

export type PlanState = "active" | "trialing" | "expired" | "none";

export interface Subscription {
  plan: string; // active_plan on the hospital
  status: string; // subscription_status
  expiresAt: string | null;
  trialEndsAt: string | null;
  state: PlanState;
  trialDaysLeft: number;
  verificationStatus: string;
  verificationNotes: string | null;
}

const DAY = 24 * 60 * 60 * 1000;

/**
 * Plan truth lives on the hospital record (written by the Paystack webhook and
 * the signup trigger). The rules below mirror private.hospital_has_plan.
 */
export function useSubscription() {
  const { data: hospitalId } = useHospitalId();
  return useQuery({
    queryKey: ["hospital-subscription", hospitalId],
    enabled: !!hospitalId,
    refetchInterval: (query) => ((query.state.data as Subscription | null)?.state === "active" ? false : 15000),
    queryFn: async (): Promise<Subscription | null> => {
      if (!hospitalId) return null;
      const { data, error } = await supabase
        .from("hospitals")
        .select("active_plan, subscription_status, plan_expires_at, trial_ends_at, verification_status, verification_notes")
        .eq("id", hospitalId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      const now = Date.now();
      const trialEnd = data.trial_ends_at ? new Date(data.trial_ends_at).getTime() : 0;
      const expiry = data.plan_expires_at ? new Date(data.plan_expires_at).getTime() : null;
      const paidNow = data.subscription_status === "active" && (expiry === null || expiry > now);
      const trialNow = data.subscription_status === "trialing" && trialEnd > now;
      const state: PlanState = paidNow ? "active" : trialNow ? "trialing" : data.subscription_status === "none" && !data.trial_ends_at ? "none" : "expired";

      return {
        plan: data.active_plan,
        status: data.subscription_status,
        expiresAt: data.plan_expires_at,
        trialEndsAt: data.trial_ends_at,
        state,
        trialDaysLeft: trialNow ? Math.max(1, Math.ceil((trialEnd - now) / DAY)) : 0,
        verificationStatus: data.verification_status,
        verificationNotes: data.verification_notes,
      };
    },
  });
}

/** Same rule as private.hospital_has_plan: telemedicine includes EMR; the trial covers EMR only. */
export function hasPlan(sub: Subscription | null | undefined, required: "emr" | "telemedicine") {
  if (!sub) return false;
  if (sub.state === "active") return sub.plan === required || (sub.plan === "telemedicine" && required === "emr");
  if (sub.state === "trialing") return required === "emr";
  return false;
}
