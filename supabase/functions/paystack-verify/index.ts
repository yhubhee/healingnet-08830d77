// Confirms a payment with Paystack and fulfils it once.
// Request:  { reference }
// Response: { status: "success" | "failed" | "pending", reference, amount }   (amount in naira)
import { requireUser } from "../_shared/auth.ts";
import { serviceClient } from "../_shared/clients.ts";
import { describeError, handle, HttpError, json, readJson, z } from "../_shared/http.ts";
import { findPaymentByReference, REFERENCE_PATTERN, settlePayment } from "../_shared/paystack.ts";
import { enforceRateLimit } from "../_shared/rate_limit.ts";

const Body = z.object({ reference: z.string().regex(REFERENCE_PATTERN) }).strict();

async function canSeePayment(userId: string, payerUserId: string | null, hospitalId: string | null) {
  if (payerUserId === userId) return true;
  if (!hospitalId) return false;
  const { data, error } = await serviceClient()
    .from("hospital_staff").select("id")
    .eq("user_id", userId).eq("hospital_id", hospitalId).eq("is_active", true)
    .limit(1);
  if (error) throw new HttpError(500, "Something went wrong. Please try again.", `staff lookup: ${describeError(error)}`);
  return (data?.length ?? 0) > 0;
}

Deno.serve(handle("paystack-verify", async (req) => {
  const { user } = await requireUser(req);
  const { reference } = await readJson(req, Body);
  // The checkout page polls every few seconds for a few minutes.
  await enforceRateLimit(user.id, "paystack-verify", 120, 60);

  const payment = await findPaymentByReference(reference);
  // Same answer for "does not exist" and "not yours".
  if (!payment || !(await canSeePayment(user.id, payment.payer_user_id, payment.hospital_id))) {
    throw new HttpError(404, "Payment not found");
  }

  const status = await settlePayment(payment, reference);
  return json(req, 200, { status, reference, amount: Number(payment.amount) / 100 });
}));
