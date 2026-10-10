// Paystack webhook (verify_jwt = false; authenticated by the HMAC signature).
// Only charge.success is handled, and the webhook body is never trusted for
// amounts: the reference is re-verified with Paystack and settled through the
// same code path as paystack-verify.
import { env } from "../_shared/clients.ts";
import { hmacSha512Hex, timingSafeEqual } from "../_shared/crypto.ts";
import { describeError, HttpError, readTextLimited } from "../_shared/http.ts";
import { findPaymentByReference, REFERENCE_PATTERN, settlePayment } from "../_shared/paystack.ts";

const ok = () => new Response("ok", { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let raw: string;
  let secret: string;
  try {
    secret = env("paystackSecretKey");
    raw = await readTextLimited(req, 256 * 1024);
  } catch (e) {
    if (e instanceof HttpError) return new Response(null, { status: e.status });
    console.error(`[paystack-webhook] ${describeError(e)}`);
    return new Response(null, { status: 500 });
  }

  const signature = req.headers.get("x-paystack-signature") ?? "";
  if (!signature || !(await timingSafeEqual(signature, await hmacSha512Hex(secret, raw)))) {
    return new Response(null, { status: 401 });
  }

  let event: { event?: unknown; data?: { reference?: unknown } };
  try {
    event = JSON.parse(raw);
  } catch {
    return ok(); // signed but unparseable: nothing we can do, don't make Paystack retry
  }
  if (event?.event !== "charge.success") return ok();

  const reference = typeof event.data?.reference === "string" ? event.data.reference : "";
  if (!REFERENCE_PATTERN.test(reference)) return ok();

  try {
    const payment = await findPaymentByReference(reference);
    if (!payment) return ok(); // not one of ours
    await settlePayment(payment, reference);
    return ok();
  } catch (e) {
    // Database or Paystack unavailable: let Paystack retry later.
    console.error(`[paystack-webhook] settle failed: ${e instanceof HttpError ? e.detail ?? e.publicMessage : describeError(e)}`);
    return new Response(null, { status: 500 });
  }
});
