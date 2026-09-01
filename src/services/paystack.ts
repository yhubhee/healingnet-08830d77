import { supabase } from "@/integrations/supabase/client";

// consultation_payments is not in the generated DB types yet; use an untyped client for it.
const db = supabase as any;

/**
 * NOTE: every privileged Paystack call goes through an edge function so the
 * Paystack secret key stays server-side. Nothing in this file may read a
 * secret key from `import.meta.env` — that would ship it to the browser.
 */

interface InitializePaymentParams {
  email: string;
  amount: number; // in kobo (NGN/100)
  reference?: string;
  metadata?: Record<string, any>;
}

interface VerifyPaymentParams {
  reference: string;
}

interface InitiateTransferParams {
  amount: number; // in kobo
  recipient: string; // recipient code from Paystack
  reference: string;
  reason?: string;
}

function serverOnly(operation: string): never {
  throw new Error(
    `${operation} requires the Paystack secret key and must run in an edge function. ` +
      `It is not available from the browser.`,
  );
}

export const paystackService = {
  /**
   * Initialize a Paystack payment for a consultation, via the
   * `paystack-initialize` edge function.
   */
  async initializePayment({ email, amount, metadata }: InitializePaymentParams) {
    const { data, error } = await supabase.functions.invoke("paystack-initialize", {
      body: {
        purpose: "consultation",
        // the edge function takes naira and converts to kobo itself
        amount: amount / 100,
        email,
        referenceId: metadata?.consultation_id ?? null,
        patientId: metadata?.patient_id ?? null,
        metadata: metadata ?? {},
      },
    });

    if (error) throw error;
    if (!data?.authorization_url) throw new Error(data?.error || "Failed to initialize payment");

    return {
      status: true,
      data: {
        authorization_url: data.authorization_url as string,
        access_code: data.access_code as string,
        reference: data.reference as string,
      },
    };
  },

  /**
   * Verify payment status via the `paystack-verify` edge function.
   */
  async verifyPayment({ reference }: VerifyPaymentParams) {
    const { data, error } = await supabase.functions.invoke("paystack-verify", {
      body: { reference },
    });

    if (error) throw error;
    if (!data) throw new Error("Failed to verify payment");

    return {
      status: true,
      data: {
        status: data.status as string,
        amount: data.amount as number,
        paid_at: data.paid_at as string | null,
        customer: data.customer ?? null,
        reference,
      },
    };
  },

  /** Server-side only — needs the Paystack secret key. */
  async createTransferRecipient(_params: {
    type?: string;
    account_number: string;
    bank_code: string;
    name: string;
  }) {
    serverOnly("Creating a transfer recipient");
  },

  /** Server-side only — needs the Paystack secret key. */
  async initiateTransfer(_params: InitiateTransferParams) {
    serverOnly("Initiating a transfer");
  },

  /** Server-side only — needs the Paystack secret key. */
  async verifyTransfer(_params: { reference: string }) {
    serverOnly("Verifying a transfer");
  },

  /** Server-side only — needs the Paystack secret key. */
  async refund(_params: { paystack_reference: string; amount: number }) {
    serverOnly("Processing a refund");
  },
};

/**
 * Save consultation payment to database
 */
export async function saveConsultationPayment({
  consultation_id,
  patient_id,
  doctor_id,
  amount,
  paystack_reference,
  paystack_auth_url,
  paystack_access_code,
}: {
  consultation_id: string;
  patient_id: string;
  doctor_id: string;
  amount: number;
  paystack_reference: string;
  paystack_auth_url: string;
  paystack_access_code: string;
}) {
  const { data, error } = await db
    .from("consultation_payments")
    .insert({
      consultation_id,
      patient_id,
      doctor_id,
      amount,
      paystack_reference,
      paystack_auth_url,
      paystack_access_code,
      payment_status: "pending",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update payment status after verification
 */
export async function updatePaymentStatus({
  consultation_id,
  payment_status,
  charged_at,
}: {
  consultation_id: string;
  payment_status: string;
  charged_at?: string;
}) {
  const { data, error } = await db
    .from("consultation_payments")
    .update({
      payment_status,
      charged_at: charged_at || new Date().toISOString(),
    })
    .eq("consultation_id", consultation_id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Mark consultation as refunded
 */
export async function refundConsultationPayment({
  consultation_id,
  reason,
  refund_reference,
}: {
  consultation_id: string;
  reason: string;
  refund_reference?: string;
}) {
  const { data, error } = await db
    .from("consultation_payments")
    .update({
      payment_status: "refunded",
      refund_reason: reason,
      refund_reference: refund_reference || null,
      refunded_at: new Date().toISOString(),
    })
    .eq("consultation_id", consultation_id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Complete transfer to doctor
 */
export async function completeTransfer({
  consultation_id,
  transfer_reference,
  transfer_amount,
}: {
  consultation_id: string;
  transfer_reference: string;
  transfer_amount: number;
}) {
  const { data, error } = await db
    .from("consultation_payments")
    .update({
      transfer_status: "completed",
      transfer_reference,
      transfer_amount,
      transferred_at: new Date().toISOString(),
    })
    .eq("consultation_id", consultation_id)
    .select()
    .single();

  if (error) throw error;
  return data;
}
