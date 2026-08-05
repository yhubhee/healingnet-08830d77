import { supabase } from "@/integrations/supabase/client";

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;
const PAYSTACK_SECRET_KEY = import.meta.env.VITE_PAYSTACK_SECRET_KEY;

interface InitializePaymentParams {
  email: string;
  amount: number; // in kobo (NGN/100)
  reference: string;
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

export const paystackService = {
  /**
   * Initialize Paystack payment for consultation
   */
  async initializePayment({
    email,
    amount,
    reference,
    metadata,
  }: InitializePaymentParams) {
    try {
      const response = await fetch("https://api.paystack.co/transaction/initialize", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          amount, // in kobo
          reference,
          metadata: metadata || {},
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to initialize payment");
      }

      const data = await response.json();
      return {
        status: true,
        data: {
          authorization_url: data.data.authorization_url,
          access_code: data.data.access_code,
          reference: data.data.reference,
        },
      };
    } catch (error) {
      console.error("Paystack initialization error:", error);
      throw error;
    }
  },

  /**
   * Verify payment status
   */
  async verifyPayment({ reference }: VerifyPaymentParams) {
    try {
      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to verify payment");
      }

      const data = await response.json();
      return {
        status: true,
        data: {
          status: data.data.status,
          amount: data.data.amount,
          paid_at: data.data.paid_at,
          customer: data.data.customer,
          reference: data.data.reference,
        },
      };
    } catch (error) {
      console.error("Paystack verification error:", error);
      throw error;
    }
  },

  /**
   * Create recipient (bank account or mobile money account)
   */
  async createTransferRecipient({
    type = "nuban",
    account_number,
    bank_code,
    name,
  }: {
    type?: string;
    account_number: string;
    bank_code: string;
    name: string;
  }) {
    try {
      const response = await fetch("https://api.paystack.co/transferrecipient", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          account_number,
          bank_code,
          name,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create transfer recipient");
      }

      const data = await response.json();
      return {
        status: true,
        data: {
          recipient_code: data.data.recipient_code,
          account_number: data.data.account_number,
          bank_code: data.data.bank_code,
        },
      };
    } catch (error) {
      console.error("Transfer recipient creation error:", error);
      throw error;
    }
  },

  /**
   * Initiate transfer to doctor
   */
  async initiateTransfer({
    amount,
    recipient,
    reference,
    reason = "Consultation payment",
  }: InitiateTransferParams) {
    try {
      const response = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "balance",
          amount, // in kobo
          recipient,
          reference,
          reason,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to initiate transfer");
      }

      const data = await response.json();
      return {
        status: true,
        data: {
          transfer_code: data.data.transfer_code,
          reference: data.data.reference,
          status: data.data.status,
        },
      };
    } catch (error) {
      console.error("Transfer initiation error:", error);
      throw error;
    }
  },

  /**
   * Verify transfer status
   */
  async verifyTransfer({ reference }: { reference: string }) {
    try {
      const response = await fetch(
        `https://api.paystack.co/transfer/verify/${reference}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to verify transfer");
      }

      const data = await response.json();
      return {
        status: true,
        data: {
          status: data.data.status,
          amount: data.data.amount,
          transferred_at: data.data.transferred_at,
        },
      };
    } catch (error) {
      console.error("Transfer verification error:", error);
      throw error;
    }
  },

  /**
   * Process refund
   */
  async refund({
    paystack_reference,
    amount,
  }: {
    paystack_reference: string;
    amount: number;
  }) {
    try {
      const response = await fetch(
        `https://api.paystack.co/refund`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            transaction: paystack_reference,
            amount, // in kobo
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to process refund");
      }

      const data = await response.json();
      return {
        status: true,
        data: {
          reference: data.data.reference,
          status: data.data.status,
        },
      };
    } catch (error) {
      console.error("Refund error:", error);
      throw error;
    }
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
  const { data, error } = await (supabase as any)
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
  const { data, error } = await (supabase as any)
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
  const { data, error } = await (supabase as any)
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
  const { data, error } = await (supabase as any)
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
