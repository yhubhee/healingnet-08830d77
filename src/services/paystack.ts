import { supabase } from "@/integrations/supabase/client";

/**
 * Every Paystack call goes through an edge function: the secret key, amounts,
 * payer email and callback URL are all decided server-side. The browser only
 * says what is being paid for (purpose + the record id).
 */

export type CheckoutRequest =
  | { purpose: "subscription"; plan: "emr" | "telemedicine"; billing_cycle: "monthly" | "yearly"; callback_path?: string }
  | { purpose: "bill"; bill_id: string; callback_path?: string }
  | { purpose: "consultation"; consultation_request_id: string; callback_path?: string }
  | { purpose: "pharmacy"; dispensing_id: string; callback_path?: string };

export interface VerifyResult {
  status: "success" | "failed" | "pending";
  reference: string;
  amount: number; // naira
}

/** The edge functions return `{ error }` with a message that is safe to show. */
export async function friendlyFunctionError(error: unknown, fallback: string): Promise<string> {
  try {
    const res = (error as any)?.context;
    if (res && typeof res.json === "function") {
      const body = await res.json();
      if (typeof body?.error === "string" && body.error) return body.error;
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

export const paystackService = {
  /** Start a checkout. Returns the Paystack page to open and the payment reference. */
  async startCheckout(req: CheckoutRequest): Promise<{ authorization_url: string; reference: string }> {
    const { data, error } = await supabase.functions.invoke("paystack-initialize", { body: req });
    if (error) throw new Error(await friendlyFunctionError(error, "We couldn't start the payment. Please try again."));
    if (!data?.authorization_url) throw new Error("We couldn't start the payment. Please try again.");
    return { authorization_url: data.authorization_url as string, reference: data.reference as string };
  },

  /** Ask the server for the payment status (amount is in naira). */
  async verifyPayment(reference: string): Promise<VerifyResult> {
    const { data, error } = await supabase.functions.invoke("paystack-verify", { body: { reference } });
    if (error || !data) throw new Error(await friendlyFunctionError(error, "We couldn't check the payment. Please try again."));
    return data as VerifyResult;
  },
};
