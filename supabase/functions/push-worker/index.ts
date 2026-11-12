// Sends queued push notifications from public.push_outbox through Expo's push service.
// Called every minute by a scheduled job (never by the app), authenticated by
// x-internal-secret.
//
// The database queues one row per device in the same transaction as the notification
// that caused it, and already decided the lock-screen text. This worker claims a batch,
// sends it to Expo in groups of up to 100, and reports each result; the database handles
// retries with backoff and turns off devices whose token is no longer registered.
//
// Response: { claimed, sent, invalid, errors }. Tokens, titles and bodies are never
// returned or logged; only counts and error types are.
import { env, serviceClient } from "../_shared/clients.ts";
import { timingSafeEqual } from "../_shared/crypto.ts";
import { handle, HttpError, json } from "../_shared/http.ts";

const FN = "push-worker";
const CLAIM = 100;
/** Expo accepts at most 100 messages per request. */
const EXPO_BATCH = 100;
const EXPO_URL = "https://exp.host/--/api/v2/push/send";
/** Stop starting new batches after this long; the rest wait for the next run. */
const TIME_BUDGET_MS = 45_000;
const REQUEST_TIMEOUT_MS = 15_000;

interface OutboxRow {
  id: string;
  token: string;
  title: string;
  body: string | null;
  data: unknown;
}

interface Ticket {
  status?: string;
  details?: { error?: string };
}

type Result = "sent" | "invalid_token" | "error";

/** A short error type for push_outbox.last_error: never the token or content. */
function shortType(value: unknown): string {
  const s = typeof value === "string" ? value : "";
  return /^[A-Za-z0-9_]{1,60}$/.test(s) ? s : "error";
}

/** Sends one batch to Expo. Returns one outcome per row, in order. */
async function sendBatch(rows: OutboxRow[]): Promise<{ result: Result; errType: string | null }[]> {
  const allFailed = (errType: string) => rows.map(() => ({ result: "error" as Result, errType }));
  const messages = rows.map((r) => ({
    to: r.token,
    title: r.title,
    body: r.body ?? "",
    data: r.data && typeof r.data === "object" ? r.data : {},
    sound: "default",
    priority: "high",
    channelId: "default",
  }));

  let res: Response;
  try {
    res = await fetch(EXPO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "Accept-Encoding": "gzip, deflate" },
      body: JSON.stringify(messages),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (e) {
    return allFailed(e instanceof Error && e.name === "TimeoutError" ? "timeout" : "network");
  }
  if (!res.ok) {
    await res.body?.cancel();
    return allFailed(`http_${res.status}`);
  }

  let tickets: Ticket[];
  try {
    const parsed = await res.json();
    tickets = Array.isArray(parsed?.data) ? parsed.data : [];
  } catch {
    return allFailed("bad_response");
  }

  return rows.map((_, i) => {
    const t = tickets[i];
    if (t?.status === "ok") return { result: "sent", errType: null };
    if (t?.details?.error === "DeviceNotRegistered") return { result: "invalid_token", errType: "DeviceNotRegistered" };
    return { result: "error", errType: t ? shortType(t.details?.error) : "no_ticket" };
  });
}

Deno.serve(handle(FN, async (req) => {
  const secret = req.headers.get("x-internal-secret");
  if (secret === null || !(await timingSafeEqual(secret, env("internalFunctionSecret")))) {
    throw new HttpError(401, "Unauthorized");
  }

  const started = Date.now();
  const db = serviceClient();
  const { data, error } = await db.rpc("push_outbox_claim", { p_limit: CLAIM });
  if (error) throw new HttpError(500, "Could not read the push queue", `claim failed (${error.code ?? "error"})`);
  const rows = (data ?? []) as OutboxRow[];

  let sent = 0, invalid = 0, errors = 0;
  const errorTypes: Record<string, number> = {};

  for (let i = 0; i < rows.length; i += EXPO_BATCH) {
    // Rows claimed but not started stay 'sending' and are reclaimed after the lock expires.
    if (Date.now() - started > TIME_BUDGET_MS) break;
    const batch = rows.slice(i, i + EXPO_BATCH);
    const outcomes = await sendBatch(batch);

    await Promise.all(batch.map(async (row, n) => {
      const { result, errType } = outcomes[n];
      const { error: finishErr } = await db.rpc("push_outbox_finish", { p_id: row.id, p_result: result, p_error: errType });
      if (finishErr) console.error(`[${FN}] finish failed for ${row.id} (${finishErr.code ?? "error"})`);
      if (result === "sent") sent++;
      else if (result === "invalid_token") invalid++;
      else {
        errors++;
        const key = errType ?? "error";
        errorTypes[key] = (errorTypes[key] ?? 0) + 1;
      }
    }));
  }

  if (errors > 0) {
    const summary = Object.entries(errorTypes).map(([type, n]) => `${type}=${n}`).join(", ");
    console.error(`[${FN}] ${errors} failed: ${summary}`);
  }

  return json(req, 200, { claimed: rows.length, sent, invalid, errors });
}));
