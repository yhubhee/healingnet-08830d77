import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PlanName = "emr" | "telemedicine";
export type BillingCycle = "monthly" | "yearly";

export interface PlanPrice {
  plan: string;
  billing_cycle: string;
  amount_kobo: number;
}

/** Prices live only in the plan_prices table (anyone can read it). */
export function usePlanPrices() {
  return useQuery({
    queryKey: ["plan-prices"],
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<PlanPrice[]> => {
      const { data, error } = await supabase
        .from("plan_prices")
        .select("plan, billing_cycle, amount_kobo")
        .eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Price in naira, or null when that plan/cycle is not on sale. */
export function priceNaira(prices: PlanPrice[] | undefined, plan: PlanName, cycle: BillingCycle): number | null {
  const row = prices?.find((p) => p.plan === plan && p.billing_cycle === cycle);
  return row ? row.amount_kobo / 100 : null;
}

export function formatNaira(n: number | null): string {
  return n == null ? "…" : `₦${n.toLocaleString("en-NG")}`;
}
