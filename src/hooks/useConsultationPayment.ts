import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  paystackService,
  saveConsultationPayment,
  updatePaymentStatus,
  refundConsultationPayment,
  completeTransfer,
} from "@/services/paystack";

/**
 * Hook to initialize consultation payment
 */
export function useInitializeConsultationPayment() {
  return useMutation({
    mutationFn: async ({
      email,
      amount,
      consultation_id,
      patient_id,
      doctor_id,
    }: {
      email: string;
      amount: number;
      consultation_id: string;
      patient_id: string;
      doctor_id: string;
    }) => {
      const reference = `CONS-${consultation_id.slice(0, 8)}-${Date.now()}`;

      // Initialize payment with Paystack
      const paymentInit = await paystackService.initializePayment({
        email,
        amount: amount * 100, // Convert to kobo
        reference,
        metadata: {
          consultation_id,
          patient_id,
          doctor_id,
          type: "consultation",
        },
      });

      // Save payment record
      const paymentRecord = await saveConsultationPayment({
        consultation_id,
        patient_id,
        doctor_id,
        amount,
        paystack_reference: paymentInit.data.reference,
        paystack_auth_url: paymentInit.data.authorization_url,
        paystack_access_code: paymentInit.data.access_code,
      });

      return {
        paymentInit: paymentInit.data,
        paymentRecord,
      };
    },
  });
}

/**
 * Hook to verify consultation payment
 */
export function useVerifyConsultationPayment(consultationId?: string) {
  return useQuery({
    queryKey: ["consultation-payment", consultationId],
    enabled: !!consultationId,
    queryFn: async () => {
      if (!consultationId) return null;

      // Get payment record from DB
      const { data: paymentRecord, error: dbError } = await supabase
        .from("consultation_payments")
        .select("*")
        .eq("consultation_id", consultationId)
        .single();

      if (dbError) throw dbError;
      if (!paymentRecord) return null;

      // If already verified, return cached data
      if (paymentRecord.payment_status === "paid") {
        return paymentRecord;
      }

      // Verify with Paystack
      try {
        const verification = await paystackService.verifyPayment({
          reference: paymentRecord.paystack_reference,
        });

        if (verification.data.status === "success") {
          // Update payment status
          await updatePaymentStatus({
            consultation_id: consultationId,
            payment_status: "paid",
          });

          return {
            ...paymentRecord,
            payment_status: "paid",
          };
        }
      } catch (error) {
        console.error("Payment verification failed:", error);
      }

      return paymentRecord;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to refund consultation payment
 */
export function useRefundConsultationPayment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      consultation_id,
      reason,
    }: {
      consultation_id: string;
      reason: "cancelled_before_call" | "doctor_no_show" | "patient_request";
    }) => {
      // Get payment record
      const { data: paymentRecord, error: dbError } = await supabase
        .from("consultation_payments")
        .select("*")
        .eq("consultation_id", consultation_id)
        .single();

      if (dbError) throw dbError;
      if (!paymentRecord) throw new Error("Payment record not found");

      // Only refund if payment was successful
      if (paymentRecord.payment_status !== "paid") {
        throw new Error("Can only refund paid consultations");
      }

      // Process refund with Paystack
      const refundResult = await paystackService.refund({
        paystack_reference: paymentRecord.paystack_reference,
        amount: paymentRecord.amount * 100, // Convert to kobo
      });

      // Update database
      const updated = await refundConsultationPayment({
        consultation_id,
        reason,
        refund_reference: refundResult.data.reference,
      });

      return updated;
    },
    onSuccess: (_, { consultation_id }) => {
      qc.invalidateQueries({ queryKey: ["consultation-payment", consultation_id] });
      qc.invalidateQueries({ queryKey: ["consultation", consultation_id] });
    },
  });
}

/**
 * Hook to complete transfer to doctor
 */
export function useCompleteConsultationTransfer() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      consultation_id,
      doctor_bank_account,
      doctor_bank_code,
      doctor_name,
    }: {
      consultation_id: string;
      doctor_bank_account: string;
      doctor_bank_code: string;
      doctor_name: string;
    }) => {
      // Get payment record
      const { data: paymentRecord, error: dbError } = await supabase
        .from("consultation_payments")
        .select("*")
        .eq("consultation_id", consultation_id)
        .single();

      if (dbError) throw dbError;
      if (!paymentRecord) throw new Error("Payment record not found");

      // Only transfer paid consultations
      if (paymentRecord.payment_status !== "paid") {
        throw new Error("Payment not completed");
      }

      // Create transfer recipient
      const recipientResult = await paystackService.createTransferRecipient({
        account_number: doctor_bank_account,
        bank_code: doctor_bank_code,
        name: doctor_name,
      });

      // Initiate transfer
      const transferRef = `TRANS-${consultation_id.slice(0, 8)}-${Date.now()}`;
      const transferResult = await paystackService.initiateTransfer({
        amount: paymentRecord.amount * 100, // Convert to kobo
        recipient: recipientResult.data.recipient_code,
        reference: transferRef,
        reason: `Consultation payment to ${doctor_name}`,
      });

      // Update database
      const updated = await completeTransfer({
        consultation_id,
        transfer_reference: transferResult.data.reference,
        transfer_amount: paymentRecord.amount,
      });

      return updated;
    },
    onSuccess: (_, { consultation_id }) => {
      qc.invalidateQueries({ queryKey: ["consultation-payment", consultation_id] });
      qc.invalidateQueries({ queryKey: ["consultation", consultation_id] });
    },
  });
}

/**
 * Hook to get consultation payment status
 */
export function useConsultationPaymentStatus(consultationId?: string) {
  return useQuery({
    queryKey: ["consultation-payment-status", consultationId],
    enabled: !!consultationId,
    queryFn: async () => {
      if (!consultationId) return null;

      const { data, error } = await supabase
        .from("consultation_payments")
        .select("*")
        .eq("consultation_id", consultationId)
        .single();

      if (error && error.code === "PGRST116") return null; // No record found
      if (error) throw error;

      return data;
    },
  });
}
