import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { paystackService } from "@/services/paystack";

/**
 * Pay the locked fee_agreed of an accepted consultation request. The server works
 * out the amount and payer; only edge functions write payments.
 */
export function useStartConsultationPayment() {
  return useMutation({
    mutationFn: async (consultationRequestId: string) => {
      const { authorization_url } = await paystackService.startCheckout({
        purpose: "consultation",
        consultation_request_id: consultationRequestId,
        callback_path: "/hospital/consultations",
      });
      const tab = window.open(authorization_url, "_blank", "noopener,noreferrer");
      if (!tab) window.location.assign(authorization_url);
    },
  });
}

/** Payment state of a consultation request: paid_at, plus any rows in the read-only payments table. */
export function useConsultationPaymentStatus(consultationRequestId?: string) {
  return useQuery({
    queryKey: ["consultation-payment-status", consultationRequestId],
    enabled: !!consultationRequestId,
    queryFn: async () => {
      const { data: request, error } = await supabase
        .from("consultation_requests")
        .select("id, status, fee_agreed, paid_at")
        .eq("id", consultationRequestId!)
        .maybeSingle();
      if (error) throw error;
      if (!request) return null;
      const { data: payments } = await supabase
        .from("payments")
        .select("status, amount, paid_at")
        .eq("purpose", "consultation")
        .eq("reference_id", consultationRequestId!)
        .order("created_at", { ascending: false });
      return { ...request, payments: payments ?? [] };
    },
  });
}
