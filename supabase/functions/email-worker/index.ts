// Sends queued transactional emails from public.email_outbox. Called every minute by a
// scheduled job (never by the browser), authenticated by x-internal-secret.
//
// The database queues each email in the same transaction as the change that caused it.
// This worker claims a batch, sends each one with the shared template registry, and
// reports the result; the database handles retries with backoff.
//
// Response: { claimed, sent, skipped, errors }. No addresses or content are returned or logged.
import { env, serviceClient } from "../_shared/clients.ts";
import { timingSafeEqual } from "../_shared/crypto.ts";
import { sendTemplate } from "../_shared/email.ts";
import { handle, HttpError, json } from "../_shared/http.ts";

const FN = "email-worker";
const BATCH = 20;
/** Stop starting new sends after this long; the rest wait for the next run. */
const TIME_BUDGET_MS = 45_000;

interface OutboxRow {
  id: string;
  template: string;
  to_user_id: string;
  data: unknown;
}

/** A short error type for email_outbox.last_error: never the address or content. */
function errorType(e: unknown): string {
  if (e instanceof HttpError) return `http_${e.status}`;
  if (e instanceof Error) return e.name.slice(0, 60) || "error";
  return "error";
}

Deno.serve(handle(FN, async (req) => {
  const secret = req.headers.get("x-internal-secret");
  if (secret === null || !(await timingSafeEqual(secret, env("internalFunctionSecret")))) {
    throw new HttpError(401, "Unauthorized");
  }

  const started = Date.now();
  const db = serviceClient();
  const { data, error } = await db.rpc("email_outbox_claim", { p_limit: BATCH });
  if (error) throw new HttpError(500, "Could not read the email queue", `claim failed (${error.code ?? "error"})`);
  const rows = (data ?? []) as OutboxRow[];

  let sent = 0, skipped = 0, errors = 0;
  for (const row of rows) {
    // Rows claimed but not started stay 'sending' and are reclaimed after the lock expires.
    if (Date.now() - started > TIME_BUDGET_MS) break;

    let result: "sent" | "skipped" | "error";
    let errType: string | null = null;
    try {
      const r = await sendTemplate(row.template, row.to_user_id, row.data, { callerUserId: null });
      result = r.sent ? "sent" : "skipped";
    } catch (e) {
      result = "error";
      errType = errorType(e);
    }

    const { error: finishErr } = await db.rpc("email_outbox_finish", { p_id: row.id, p_result: result, p_error: errType });
    if (finishErr) console.error(`[${FN}] finish failed for ${row.id} (${finishErr.code ?? "error"})`);

    if (result === "sent") sent++;
    else if (result === "skipped") skipped++;
    else {
      errors++;
      console.error(`[${FN}] ${row.template} ${row.id}: ${errType}`);
    }
  }

  return json(req, 200, { claimed: rows.length, sent, skipped, errors });
}));
