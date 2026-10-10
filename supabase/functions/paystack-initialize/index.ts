// Starts a Paystack checkout. The server decides what is being paid for and how
// much; the browser never sends an amount, an email or a full callback URL.
//
// Request:  { purpose: "subscription" | "bill" | "consultation" | "pharmacy",
//             plan?, billing_cycle?, hospital_id?,      // subscription
//             bill_id?, consultation_request_id?, dispensing_id?,
//             callback_path? }                          // e.g. "/hospital/confirming-payment"
// Response: { authorization_url, reference }
import { requireUser } from "../_shared/auth.ts";
import { env, serviceClient } from "../_shared/clients.ts";
import { describeError, handle, HttpError, json, readJson, uuid, z } from "../_shared/http.ts";
import { paystackInitialize } from "../_shared/paystack.ts";
import { enforceRateLimit } from "../_shared/rate_limit.ts";

const Body = z.object({
  purpose: z.enum(["subscription", "bill", "consultation", "pharmacy"]),
  plan: z.enum(["emr", "telemedicine"]).optional(),
  billing_cycle: z.enum(["monthly", "yearly"]).optional(),
  // Only used to choose between hospitals the caller is an admin of.
  hospital_id: uuid().optional(),
  bill_id: uuid().optional(),
  consultation_request_id: uuid().optional(),
  dispensing_id: uuid().optional(),
  callback_path: z.string().max(200).optional(),
}).strict();

type Body = z.infer<typeof Body>;

interface Quote {
  purpose: "subscription" | "billing" | "consultation" | "pharmacy";
  referenceId: string;
  amountKobo: number;
  hospitalId: string | null;
  patientId: string | null;
  payeeDoctorId: string | null;
  plan: string | null;
  billingCycle: string | null;
  email: string | null;
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const notFound = () => new HttpError(404, "Not found");
const dbError = (what: string, e: unknown) =>
  new HttpError(500, "Something went wrong. Please try again.", `${what}: ${describeError(e)}`);

function toKobo(naira: unknown): number {
  const n = Number(naira);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

async function isActiveStaff(userId: string, hospitalId: string): Promise<boolean> {
  const { data, error } = await serviceClient()
    .from("hospital_staff").select("id")
    .eq("user_id", userId).eq("hospital_id", hospitalId).eq("is_active", true)
    .limit(1);
  if (error) throw dbError("staff lookup", error);
  return (data?.length ?? 0) > 0;
}

/** The patient row's email, else the email of the patient's own account. */
async function patientEmail(patientId: string): Promise<string | null> {
  const db = serviceClient();
  const { data: p, error } = await db.from("patients").select("email, user_id").eq("id", patientId).maybeSingle();
  if (error) throw dbError("patient lookup", error);
  if (p?.email && EMAIL.test(p.email)) return p.email;
  if (p?.user_id) {
    const { data: u } = await db.auth.admin.getUserById(p.user_id);
    if (u?.user?.email) return u.user.email;
  }
  return null;
}

async function isOwnPatient(userId: string, patientId: string): Promise<boolean> {
  const { data, error } = await serviceClient()
    .from("patients").select("id").eq("id", patientId).eq("user_id", userId).maybeSingle();
  if (error) throw dbError("patient lookup", error);
  return !!data;
}

async function quoteSubscription(body: Body, userId: string, userEmail: string | null): Promise<Quote> {
  if (!body.plan || !body.billing_cycle) throw new HttpError(400, "Choose a plan and billing cycle");
  const db = serviceClient();

  const { data: adminRows, error } = await db
    .from("hospital_staff").select("hospital_id")
    .eq("user_id", userId).eq("role", "admin").eq("is_active", true);
  if (error) throw dbError("admin lookup", error);
  const hospitalIds = (adminRows ?? []).map((r) => r.hospital_id as string);
  let hospitalId: string;
  if (body.hospital_id) {
    if (!hospitalIds.includes(body.hospital_id)) throw new HttpError(403, "Only a hospital admin can pay for a subscription");
    hospitalId = body.hospital_id;
  } else if (hospitalIds.length === 1) {
    hospitalId = hospitalIds[0];
  } else if (hospitalIds.length === 0) {
    throw new HttpError(403, "Only a hospital admin can pay for a subscription");
  } else {
    throw new HttpError(400, "Choose which hospital to pay for");
  }

  const { data: hospital, error: hErr } = await db
    .from("hospitals").select("active_plan, subscription_status, plan_expires_at")
    .eq("id", hospitalId).maybeSingle();
  if (hErr) throw dbError("hospital lookup", hErr);
  if (!hospital) throw notFound();
  const stillActive = hospital.subscription_status === "active" && new Date(hospital.plan_expires_at) > new Date();
  if (stillActive && hospital.active_plan === "telemedicine" && body.plan === "emr") {
    throw new HttpError(409, "You can switch to the EMR plan when your current Telemedicine period ends");
  }

  const { data: price, error: pErr } = await db
    .from("plan_prices").select("amount_kobo")
    .eq("plan", body.plan).eq("billing_cycle", body.billing_cycle).eq("is_active", true)
    .maybeSingle();
  if (pErr) throw dbError("price lookup", pErr);
  if (!price) throw new HttpError(400, "This plan is not available");

  return {
    purpose: "subscription",
    referenceId: hospitalId,
    amountKobo: Number(price.amount_kobo),
    hospitalId,
    patientId: null,
    payeeDoctorId: null,
    plan: body.plan,
    billingCycle: body.billing_cycle,
    email: userEmail,
  };
}

async function quoteBill(body: Body, userId: string, userEmail: string | null): Promise<Quote> {
  if (!body.bill_id) throw new HttpError(400, "Invalid request");
  const { data: bill, error } = await serviceClient()
    .from("hospital_billing").select("id, hospital_id, patient_id, total, payment_status")
    .eq("id", body.bill_id).maybeSingle();
  if (error) throw dbError("bill lookup", error);
  if (!bill) throw notFound();

  const payerIsPatient = await isOwnPatient(userId, bill.patient_id);
  if (!payerIsPatient && !(await isActiveStaff(userId, bill.hospital_id))) throw notFound();
  if (bill.payment_status !== "pending") throw new HttpError(409, "This bill is not awaiting payment");

  const amountKobo = toKobo(bill.total);
  if (amountKobo <= 0) throw new HttpError(409, "This bill has nothing to pay");
  return {
    purpose: "billing",
    referenceId: bill.id,
    amountKobo,
    hospitalId: bill.hospital_id,
    patientId: bill.patient_id,
    payeeDoctorId: null,
    plan: null,
    billingCycle: null,
    // Staff collecting at the counter: the receipt goes to the patient.
    email: payerIsPatient ? userEmail : (await patientEmail(bill.patient_id)) ?? userEmail,
  };
}

async function quoteConsultation(body: Body, userId: string, userEmail: string | null): Promise<Quote> {
  if (!body.consultation_request_id) throw new HttpError(400, "Invalid request");
  const db = serviceClient();
  const { data: r, error } = await db
    .from("consultation_requests")
    .select("id, status, fee_agreed, paid_at, doctor_id, patient_id, requesting_hospital_id")
    .eq("id", body.consultation_request_id).maybeSingle();
  if (error) throw dbError("consultation lookup", error);
  if (!r) throw notFound();

  const payerIsPatient = await isOwnPatient(userId, r.patient_id);
  let allowed = payerIsPatient || (await isActiveStaff(userId, r.requesting_hospital_id));
  if (!allowed) {
    const { data: doc } = await db.from("doctors").select("id").eq("id", r.doctor_id).eq("user_id", userId).maybeSingle();
    allowed = !!doc;
  }
  if (!allowed) throw notFound();
  if (r.status !== "accepted") throw new HttpError(409, "The consultation must be accepted before payment");
  if (r.paid_at) throw new HttpError(409, "This consultation is already paid");

  // fee_agreed is locked once the request is accepted (guard trigger), so this is the agreed amount.
  const amountKobo = toKobo(r.fee_agreed);
  if (amountKobo <= 0) throw new HttpError(409, "No consultation fee has been set");
  return {
    purpose: "consultation",
    referenceId: r.id,
    amountKobo,
    hospitalId: r.requesting_hospital_id,
    patientId: r.patient_id,
    payeeDoctorId: r.doctor_id,
    plan: null,
    billingCycle: null,
    email: payerIsPatient ? userEmail : (await patientEmail(r.patient_id)) ?? userEmail,
  };
}

async function quotePharmacy(body: Body, userId: string, userEmail: string | null): Promise<Quote> {
  if (!body.dispensing_id) throw new HttpError(400, "Invalid request");
  const db = serviceClient();
  const { data: d, error } = await db
    .from("pharmacy_dispensing")
    .select("id, hospital_id, patient_id, drug_id, quantity_dispensed, payment_status")
    .eq("id", body.dispensing_id).maybeSingle();
  if (error) throw dbError("dispensing lookup", error);
  if (!d) throw notFound();
  if (!(await isActiveStaff(userId, d.hospital_id))) throw notFound();
  if (d.payment_status !== "pending") throw new HttpError(409, "This item is not awaiting payment");

  const { data: drug, error: dErr } = await db
    .from("pharmacy_inventory").select("unit_price").eq("id", d.drug_id).eq("hospital_id", d.hospital_id).maybeSingle();
  if (dErr) throw dbError("drug lookup", dErr);
  const amountKobo = toKobo(drug?.unit_price) * Number(d.quantity_dispensed ?? 0);
  if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) throw new HttpError(409, "This item has no price set");
  return {
    purpose: "pharmacy",
    referenceId: d.id,
    amountKobo,
    hospitalId: d.hospital_id,
    patientId: d.patient_id,
    payeeDoctorId: null,
    plan: null,
    billingCycle: null,
    email: (await patientEmail(d.patient_id)) ?? userEmail,
  };
}

/** callback_path must be a path on APP_URL; full URLs from the client are never accepted. */
function callbackUrl(path: string | undefined): string | undefined {
  if (path === undefined) return undefined;
  if (!/^\/(?![/\\])[A-Za-z0-9\-._~/?=&%]*$/.test(path)) throw new HttpError(400, "Invalid request", "bad callback_path");
  const base = new URL(env("appUrl"));
  const url = new URL(path, base);
  if (url.origin !== base.origin) throw new HttpError(400, "Invalid request", "callback_path left APP_URL");
  return url.toString();
}

Deno.serve(handle("paystack-initialize", async (req) => {
  const { user } = await requireUser(req);
  const body = await readJson(req, Body);
  const callback = callbackUrl(body.callback_path);
  await enforceRateLimit(user.id, "paystack-initialize", 20, 60);

  const quote = body.purpose === "subscription"
    ? await quoteSubscription(body, user.id, user.email)
    : body.purpose === "bill"
    ? await quoteBill(body, user.id, user.email)
    : body.purpose === "consultation"
    ? await quoteConsultation(body, user.id, user.email)
    : await quotePharmacy(body, user.id, user.email);

  if (!quote.email || !EMAIL.test(quote.email)) {
    throw new HttpError(400, "No email address is on file for this payment");
  }

  const db = serviceClient();

  // Reuse a recent pending checkout for the same thing, payer and amount.
  let reuse = db.from("payments")
    .select("paystack_reference, authorization_url")
    .eq("purpose", quote.purpose)
    .eq("reference_id", quote.referenceId)
    .eq("payer_user_id", user.id)
    .eq("status", "pending")
    .eq("amount", quote.amountKobo)
    .not("authorization_url", "is", null)
    .gte("created_at", new Date(Date.now() - 30 * 60_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1);
  if (quote.plan) reuse = reuse.eq("plan", quote.plan).eq("billing_cycle", quote.billingCycle!);
  const { data: existing, error: reuseErr } = await reuse;
  if (reuseErr) throw dbError("pending payment lookup", reuseErr);
  if (existing?.length) {
    return json(req, 200, { authorization_url: existing[0].authorization_url, reference: existing[0].paystack_reference });
  }

  const reference = `hn_${quote.purpose.slice(0, 4)}_${crypto.randomUUID().replace(/-/g, "")}`;
  const { data: payment, error: insErr } = await db.from("payments").insert({
    purpose: quote.purpose,
    reference_id: quote.referenceId,
    amount: quote.amountKobo,
    currency: "NGN",
    email: quote.email,
    paystack_reference: reference,
    status: "pending",
    hospital_id: quote.hospitalId,
    patient_id: quote.patientId,
    payer_user_id: user.id,
    payee_doctor_id: quote.payeeDoctorId,
    plan: quote.plan,
    billing_cycle: quote.billingCycle,
  }).select("id").single();
  if (insErr || !payment) throw dbError("payment insert", insErr);

  let authorizationUrl: string;
  try {
    ({ authorization_url: authorizationUrl } = await paystackInitialize({
      email: quote.email,
      amountKobo: quote.amountKobo,
      reference,
      callbackUrl: callback,
      paymentId: payment.id,
    }));
  } catch (e) {
    await db.from("payments").update({ status: "abandoned" }).eq("id", payment.id);
    throw e;
  }

  const { error: updErr } = await db.from("payments").update({ authorization_url: authorizationUrl }).eq("id", payment.id);
  if (updErr) console.error(`[paystack-initialize] could not store authorization_url: ${describeError(updErr)}`);

  return json(req, 200, { authorization_url: authorizationUrl, reference });
}));
