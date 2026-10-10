// Transactional email: a fixed template registry, recipient looked up from
// auth.users, every value HTML-escaped, per-recipient/per-caller rate limits,
// and the recipient's email preferences respected. Sent via Gmail SMTP.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { env, serviceClient } from "./clients.ts";
import { describeError, HttpError, z } from "./http.ts";
import { checkRateLimit, checkSubjectRateLimit, recordCall } from "./rate_limit.ts";

type Category = "appointment" | "billing" | "account";

interface Rendered {
  subject: string;
  heading: string;
  paragraphs: string[];
  /** Path inside the app (joined to APP_URL); never taken from the caller. */
  actionPath?: string;
  actionLabel?: string;
}

interface Template<T> {
  /** May a signed-in user send this template to themselves? */
  userAllowed: boolean;
  category: Category;
  schema: z.ZodType<T>;
  render(data: T, recipientUserId: string): Promise<Rendered> | Rendered;
}

const short = (max: number) => z.string().trim().min(1).max(max);

const naira = (kobo: number) =>
  "₦" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const doctorInvited: Template<{ hospital_name: string }> = {
  userAllowed: false,
  category: "account",
  schema: z.object({ hospital_name: short(200) }).strict(),
  render: (d) => ({
    subject: `Invitation to join ${d.hospital_name} on HealingNet`,
    heading: "You have a new hospital invitation",
    paragraphs: [
      `${d.hospital_name} has invited you to join their team on HealingNet.`,
      "Open your invitations to accept or decline. You will only get access to the hospital's records after you accept.",
    ],
    actionPath: "/doctor/invitations",
    actionLabel: "View invitation",
  }),
};

const doctorVerificationResult: Template<{ approved: boolean; reason?: string }> = {
  userAllowed: false,
  category: "account",
  schema: z.object({ approved: z.boolean(), reason: short(1000).optional() }).strict(),
  render: (d) => ({
    subject: d.approved ? "Your HealingNet credentials are approved" : "Update on your HealingNet verification",
    heading: d.approved ? "Verification approved" : "Verification not approved",
    paragraphs: d.approved
      ? ["Your credentials have been reviewed and approved. Patients and hospitals can now find you on HealingNet."]
      : [
        "We were not able to approve your credentials yet.",
        ...(d.reason ? [`Reason: ${d.reason}`] : []),
        "You can update your documents and submit them again.",
      ],
    actionPath: "/doctor/verification",
    actionLabel: "Open verification",
  }),
};

const hospitalVerificationResult: Template<{ approved: boolean; hospital_name: string; notes?: string }> = {
  userAllowed: false,
  category: "account",
  schema: z.object({ approved: z.boolean(), hospital_name: short(200), notes: short(1000).optional() }).strict(),
  render: (d) => ({
    subject: d.approved ? `${d.hospital_name} is verified on HealingNet` : `Update on ${d.hospital_name}'s verification`,
    heading: d.approved ? "Hospital verified" : "Hospital verification not approved",
    paragraphs: d.approved
      ? [`${d.hospital_name} is now verified and visible to patients on HealingNet.`]
      : [
        `We were not able to verify ${d.hospital_name} yet. Your staff can keep using the system, but patients cannot find or book your hospital.`,
        ...(d.notes ? [`Notes: ${d.notes}`] : []),
        "Please contact HealingNet support if you have questions.",
      ],
    actionPath: "/hospital/settings",
    actionLabel: "Open settings",
  }),
};

const APPOINTMENT_STATUS = ["pending", "accepted", "rejected", "completed", "cancelled", "rescheduled"] as const;

const appointmentStatus: Template<{
  status: typeof APPOINTMENT_STATUS[number];
  date: string;
  time?: string;
  hospital_name?: string;
  doctor_name?: string;
}> = {
  userAllowed: false,
  category: "appointment",
  schema: z.object({
    status: z.enum(APPOINTMENT_STATUS),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    hospital_name: short(200).optional(),
    doctor_name: short(200).optional(),
  }).strict(),
  render: (d) => {
    const when = d.time ? `${d.date} at ${d.time.slice(0, 5)}` : d.date;
    const withWhom = [d.doctor_name && `with ${d.doctor_name}`, d.hospital_name && `at ${d.hospital_name}`]
      .filter(Boolean).join(" ");
    const label = d.status === "rescheduled" ? "rescheduled" : `now ${d.status}`;
    return {
      subject: `Your appointment on ${when} is ${label}`,
      heading: "Appointment update",
      paragraphs: [`Your appointment${withWhom ? " " + withWhom : ""} on ${when} is ${label}.`],
      actionPath: "/patient/appointments",
      actionLabel: "View appointments",
    };
  },
};

const PURPOSE_LABEL: Record<string, string> = {
  subscription: "HealingNet subscription",
  billing: "Hospital bill",
  pharmacy: "Pharmacy",
  consultation: "Specialist consultation",
};

// The receipt is built from the payments table, never from caller data, so it
// cannot be used to forge a receipt.
const paymentReceipt: Template<{ payment_id: string }> = {
  userAllowed: true,
  category: "billing",
  schema: z.object({ payment_id: z.string().uuid() }).strict(),
  render: async (d, recipientUserId) => {
    const { data: p, error } = await serviceClient()
      .from("payments")
      .select("id, amount, purpose, plan, billing_cycle, paystack_reference, paid_at, status, payer_user_id, hospitals(name)")
      .eq("id", d.payment_id)
      .maybeSingle();
    if (error) throw new HttpError(500, "Could not send email", `receipt lookup: ${describeError(error)}`);
    if (!p || p.status !== "success" || p.payer_user_id !== recipientUserId) {
      throw new HttpError(404, "Payment not found");
    }
    const hospital = (p.hospitals as { name?: string } | null)?.name;
    const what = PURPOSE_LABEL[p.purpose] ?? "Payment";
    const plan = p.purpose === "subscription" && p.plan ? ` (${p.plan.toUpperCase()}, ${p.billing_cycle})` : "";
    return {
      subject: `Payment receipt: ${naira(Number(p.amount))}`,
      heading: "Payment received",
      paragraphs: [
        `Thank you. We received your payment of ${naira(Number(p.amount))}.`,
        `For: ${what}${plan}${hospital ? ` - ${hospital}` : ""}`,
        `Reference: ${p.paystack_reference}`,
        `Date: ${new Date(p.paid_at ?? Date.now()).toUTCString()}`,
      ],
    };
  },
};

// deno-lint-ignore no-explicit-any
export const TEMPLATES: Record<string, Template<any>> = {
  doctor_invited: doctorInvited,
  doctor_verification_result: doctorVerificationResult,
  hospital_verification_result: hospitalVerificationResult,
  appointment_status: appointmentStatus,
  payment_receipt: paymentReceipt,
};

export type TemplateName = keyof typeof TEMPLATES;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function actionUrl(path?: string): string | undefined {
  if (!path) return undefined;
  return new URL(path, env("appUrl")).toString();
}

function renderHtml(r: Rendered): string {
  const url = actionUrl(r.actionPath);
  const paragraphs = r.paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#334155">${escapeHtml(p)}</p>`)
    .join("");
  const button = url
    ? `<p style="margin:20px 0 0"><a href="${escapeHtml(url)}" style="display:inline-block;background:#06b6d4;color:#04212a;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:8px;font-size:14px">${escapeHtml(r.actionLabel ?? "Open HealingNet")}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:24px">
<div style="background:#0b1220;border-radius:12px 12px 0 0;padding:20px 24px"><span style="color:#22d3ee;font-size:18px;font-weight:bold">HealingNet</span></div>
<div style="background:#ffffff;border-radius:0 0 12px 12px;padding:24px">
<h1 style="margin:0 0 14px;font-size:18px;color:#0b1220">${escapeHtml(r.heading)}</h1>
${paragraphs}${button}
<p style="margin:24px 0 0;font-size:12px;color:#94a3b8">You are receiving this because of activity on your HealingNet account. You can change email preferences in your account settings.</p>
</div></div></body></html>`;
}

function renderText(r: Rendered): string {
  const url = actionUrl(r.actionPath);
  return [r.heading, "", ...r.paragraphs, ...(url ? ["", `${r.actionLabel ?? "Open HealingNet"}: ${url}`] : []), "", "- HealingNet"]
    .join("\n");
}

const PREF_COLUMN: Record<Category, string | null> = {
  appointment: "email_appointments",
  billing: "email_billing",
  account: null,
};

export interface SendOptions {
  /** The signed-in caller, or null for internal server-to-server sends. */
  callerUserId: string | null;
}

export type SendResult = { sent: true } | { sent: false; reason: "opted_out" | "no_email" };

const FN = "send-email";

/**
 * Validates, rate-limits, renders and sends one templated email to a user.
 * Throws HttpError for invalid input, unknown templates or rate limits.
 */
export async function sendTemplate(
  template: string,
  toUserId: string,
  data: unknown,
  { callerUserId }: SendOptions,
): Promise<SendResult> {
  const t = Object.hasOwn(TEMPLATES, template) ? TEMPLATES[template] : undefined;
  if (!t) throw new HttpError(400, "Invalid request", `unknown template`);
  if (callerUserId !== null && (!t.userAllowed || callerUserId !== toUserId)) {
    throw new HttpError(403, "Not allowed");
  }
  const parsed = t.schema.safeParse(data ?? {});
  if (!parsed.success) throw new HttpError(400, "Invalid request", `invalid data for template ${template}`);

  // Rate limits: internal sends 20/hour per recipient; user-initiated 5/hour per caller.
  if (callerUserId === null) {
    await checkSubjectRateLimit(toUserId, FN, 20, 60);
  } else {
    await checkRateLimit(callerUserId, FN, 5, 60);
  }

  const db = serviceClient();
  const { data: userRes, error: userErr } = await db.auth.admin.getUserById(toUserId);
  if (userErr) throw new HttpError(500, "Could not send email", `recipient lookup: ${describeError(userErr)}`);
  const to = userRes?.user?.email;
  if (!to) return { sent: false, reason: "no_email" };

  const { data: prefs, error: prefErr } = await db
    .from("notification_preferences")
    .select("email_enabled, email_appointments, email_billing")
    .eq("user_id", toUserId)
    .maybeSingle();
  if (prefErr) throw new HttpError(500, "Could not send email", `prefs lookup: ${describeError(prefErr)}`);
  if (prefs) {
    const col = PREF_COLUMN[t.category];
    const row = prefs as Record<string, unknown>;
    if (row.email_enabled === false || (col && row[col] === false)) return { sent: false, reason: "opted_out" };
  }

  const rendered = await t.render(parsed.data, toUserId);
  const from = env("gmailUser");

  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: from, password: env("gmailAppPassword") },
    },
  });
  try {
    await client.send({
      from: `HealingNet <${from}>`,
      to,
      subject: rendered.subject,
      content: renderText(rendered),
      html: renderHtml(rendered),
    });
  } catch (e) {
    // SMTP errors can echo the recipient address, so only the error type is logged.
    throw new HttpError(502, "Could not send email", `smtp send failed (${e instanceof Error ? e.name : "error"})`);
  } finally {
    await client.close().catch(() => {});
  }

  await recordCall(callerUserId, FN, toUserId);
  return { sent: true };
}
