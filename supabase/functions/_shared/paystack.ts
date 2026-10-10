// Paystack API calls and the single settlement path used by both
// paystack-verify and paystack-webhook.
import { env, serviceClient } from "./clients.ts";
import { sendTemplate } from "./email.ts";
import { describeError, HttpError } from "./http.ts";

const API = "https://api.paystack.co";
const TIMEOUT_MS = 15_000;

async function paystack(path: string, init: RequestInit = {}): Promise<{ status: boolean; message?: string; data?: unknown }> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env("paystackSecretKey")}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    throw new HttpError(502, "Payment provider unavailable. Please try again.", `paystack ${path.split("/")[1]}: ${describeError(e)}`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.status !== true) {
    throw new HttpError(
      502,
      "Payment provider error. Please try again.",
      `paystack ${path.split("/")[1]} http ${res.status}: ${String(body?.message ?? "").slice(0, 120)}`,
    );
  }
  return body;
}

export async function paystackInitialize(args: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl?: string;
  paymentId: string;
}): Promise<{ authorization_url: string }> {
  const body = await paystack("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: args.email,
      amount: args.amountKobo,
      currency: "NGN",
      reference: args.reference,
      ...(args.callbackUrl ? { callback_url: args.callbackUrl } : {}),
      metadata: { payment_id: args.paymentId },
    }),
  });
  const url = (body.data as { authorization_url?: unknown } | undefined)?.authorization_url;
  if (typeof url !== "string" || !url.startsWith("https://")) {
    throw new HttpError(502, "Payment provider error. Please try again.", "paystack initialize: no authorization_url");
  }
  return { authorization_url: url };
}

export interface VerifiedTransaction {
  status: string; // success | failed | abandoned | reversed | ongoing | pending | ...
  amount: number; // kobo
  currency: string;
  reference: string;
  channel: string | null;
}

export async function paystackVerify(reference: string): Promise<VerifiedTransaction> {
  const body = await paystack(`/transaction/verify/${encodeURIComponent(reference)}`);
  const d = (body.data ?? {}) as Record<string, unknown>;
  return {
    status: String(d.status ?? ""),
    amount: Number(d.amount),
    currency: String(d.currency ?? ""),
    reference: String(d.reference ?? ""),
    channel: typeof d.channel === "string" ? d.channel : null,
  };
}

export interface PaymentRow {
  id: string;
  amount: number;
  currency: string;
  status: string;
  purpose: string;
  hospital_id: string | null;
  payer_user_id: string | null;
  metadata: Record<string, unknown> | null;
}

export const PAYMENT_COLUMNS = "id, amount, currency, status, purpose, hospital_id, payer_user_id, metadata";

export type SettleStatus = "success" | "failed" | "pending";

/**
 * Re-verifies a reference with Paystack and, if it really succeeded for the
 * exact amount and currency we asked for, fulfils it exactly once.
 * Never trusts amounts supplied by the browser or the webhook body.
 */
export async function settlePayment(payment: PaymentRow, reference: string): Promise<SettleStatus> {
  if (payment.status === "success") return "success";

  const db = serviceClient();
  const tx = await paystackVerify(reference);

  if (tx.reference !== reference) {
    console.error(`[paystack] verify returned a different reference for payment ${payment.id}`);
    return "pending";
  }

  if (tx.status === "success") {
    if (tx.amount !== Number(payment.amount) || tx.currency !== "NGN" || payment.currency !== "NGN") {
      // Money moved but not what we asked for: never fulfil; flag for manual review/refund.
      console.error(`[paystack] amount/currency mismatch for payment ${payment.id}`);
      await db.from("payments")
        .update({
          status: "failed",
          channel: tx.channel,
          metadata: { ...(payment.metadata ?? {}), review: "amount_or_currency_mismatch" },
        })
        .eq("id", payment.id)
        .eq("status", "pending");
      return "failed";
    }

    const { data: fulfilled, error } = await db.rpc("fulfill_payment", {
      p_payment_id: payment.id,
      p_paid_amount: tx.amount,
      p_currency: tx.currency,
    });
    if (error) throw new HttpError(500, "Something went wrong. Please try again.", `fulfill_payment: ${describeError(error)}`);

    if (fulfilled === true) {
      await db.from("payments").update({ channel: tx.channel }).eq("id", payment.id);
      if (payment.payer_user_id) {
        // Best effort: a failed receipt must not undo or block the payment.
        try {
          await sendTemplate("payment_receipt", payment.payer_user_id, { payment_id: payment.id }, { callerUserId: null });
        } catch (e) {
          console.error(`[paystack] receipt not sent for payment ${payment.id}: ${e instanceof HttpError ? e.detail ?? e.publicMessage : describeError(e)}`);
        }
      }
      return "success";
    }

    // Already fulfilled by a concurrent verify/webhook call (or a mismatch fulfil_payment caught).
    const { data: now } = await db.from("payments").select("status").eq("id", payment.id).maybeSingle();
    return now?.status === "success" ? "success" : "failed";
  }

  if (["failed", "abandoned", "reversed"].includes(tx.status)) {
    await db.from("payments")
      .update({ status: tx.status === "abandoned" ? "abandoned" : "failed", channel: tx.channel })
      .eq("id", payment.id)
      .eq("status", "pending");
    return "failed";
  }

  return "pending";
}

/** Looks up a payment by Paystack reference with the service role. */
export async function findPaymentByReference(reference: string): Promise<PaymentRow | null> {
  const { data, error } = await serviceClient()
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("paystack_reference", reference)
    .maybeSingle();
  if (error) throw new HttpError(500, "Something went wrong. Please try again.", `payment lookup: ${describeError(error)}`);
  return data as PaymentRow | null;
}

/** Paystack references we generate: hn_<purpose>_<32 hex>. */
export const REFERENCE_PATTERN = /^[A-Za-z0-9_.=-]{6,100}$/;
