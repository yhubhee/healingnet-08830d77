import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type Purpose = "billing" | "pharmacy" | "consultation";

interface CollectArgs {
  purpose: Purpose;
  amount: number;
  email: string;
  referenceId?: string | null;
  hospitalId?: string | null;
  patientId?: string | null;
}

/**
 * Starts a real Paystack checkout through the backend (the secret key never
 * touches the browser), then polls verification until the payment settles.
 */
export function useCollectPayment() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const collect = async ({ purpose, amount, email, referenceId, hospitalId, patientId }: CollectArgs) => {
    if (!email) {
      toast({ title: "Payer email required", description: "Add an email to this patient's record first.", variant: "destructive" });
      return;
    }
    if (!amount || amount <= 0) {
      toast({ title: "Nothing to collect", description: "This record has no outstanding amount.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-initialize", {
        body: { purpose, amount, email, referenceId, hospitalId, patientId },
      });
      if (error) throw error;
      if (!data?.authorization_url) throw new Error("Could not start checkout");

      const checkout = window.open(data.authorization_url, "_blank", "noopener,noreferrer");
      if (!checkout) {
        toast({ title: "Popup blocked", description: "Allow popups to open the payment page.", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      toast({ title: "Payment started", description: "Complete the payment in the new tab — we'll confirm it here." });

      const reference = data.reference as string;
      const deadline = Date.now() + 5 * 60 * 1000;

      const poll = async (): Promise<void> => {
        if (Date.now() > deadline) {
          setIsProcessing(false);
          toast({ title: "Still pending", description: "We couldn't confirm the payment yet. Refresh once it completes." });
          return;
        }
        await new Promise((r) => setTimeout(r, 5000));
        const { data: v } = await supabase.functions.invoke("paystack-verify", { body: { reference } });
        if (v?.status === "success") {
          setIsProcessing(false);
          toast({ title: "Payment received", description: `₦${Number(v.amount).toLocaleString()} confirmed.` });
          qc.invalidateQueries({ queryKey: ["hospital-billing"] });
          qc.invalidateQueries({ queryKey: ["pharmacy-dispensing"] });
          qc.invalidateQueries({ queryKey: ["payments"] });
          return;
        }
        if (v?.status === "failed") {
          setIsProcessing(false);
          toast({ title: "Payment failed", description: "The transaction did not go through.", variant: "destructive" });
          return;
        }
        return poll();
      };
      void poll();
    } catch (e: any) {
      setIsProcessing(false);
      toast({ title: "Payment error", description: e.message ?? "Could not start the payment", variant: "destructive" });
    }
  };

  return { collect, isProcessing };
}
