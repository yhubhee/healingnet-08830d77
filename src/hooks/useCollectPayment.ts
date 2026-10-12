import { useState } from "react";
import { paystackService } from "@/services/paystack";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type CollectArgs = { purpose: "bill"; billId: string } | { purpose: "pharmacy"; dispensingId: string };

/**
 * Starts a real Paystack checkout through the backend (the secret key, amount and
 * payer email are all decided on the server), then polls verification until the
 * payment settles.
 */
export function useCollectPayment() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const collect = async (args: CollectArgs) => {
    setIsProcessing(true);
    try {
      const { authorization_url, reference } = await paystackService.startCheckout(
        args.purpose === "bill"
          ? { purpose: "bill", bill_id: args.billId }
          : { purpose: "pharmacy", dispensing_id: args.dispensingId },
      );

      const checkout = window.open(authorization_url, "_blank", "noopener,noreferrer");
      if (!checkout) {
        toast({ title: "Popup blocked", description: "Allow popups to open the payment page.", variant: "destructive" });
        setIsProcessing(false);
        return;
      }

      toast({ title: "Payment started", description: "Complete the payment in the new tab — we'll confirm it here." });

      const deadline = Date.now() + 5 * 60 * 1000;

      const poll = async (): Promise<void> => {
        if (Date.now() > deadline) {
          setIsProcessing(false);
          toast({ title: "Still pending", description: "We couldn't confirm the payment yet. Refresh once it completes." });
          return;
        }
        await new Promise((r) => setTimeout(r, 5000));
        const v = await paystackService.verifyPayment(reference).catch(() => null);
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
      toast({ title: "Payment error", description: e?.message ?? "We couldn't start the payment. Please try again.", variant: "destructive" });
    }
  };

  return { collect, isProcessing };
}
