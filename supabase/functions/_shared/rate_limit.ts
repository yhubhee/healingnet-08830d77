// Simple sliding-window rate limits backed by public.function_calls
// (service-role-only table). Small overshoot under concurrency is acceptable.
import { serviceClient } from "./clients.ts";
import { describeError, HttpError } from "./http.ts";

const TOO_MANY = "Too many requests. Please try again later.";

async function countSince(column: "user_id" | "subject_user_id", id: string, fn: string, windowMinutes: number) {
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();
  const { count, error } = await serviceClient()
    .from("function_calls")
    .select("id", { count: "exact", head: true })
    .eq(column, id)
    .eq("fn", fn)
    .gte("created_at", since);
  if (error) throw new HttpError(500, "Something went wrong. Please try again.", `rate limit count: ${describeError(error)}`);
  return count ?? 0;
}

/** Throws 429 if userId already made `max` calls to `fn` in the window. */
export async function checkRateLimit(userId: string, fn: string, max: number, windowMinutes: number): Promise<void> {
  if ((await countSince("user_id", userId, fn, windowMinutes)) >= max) throw new HttpError(429, TOO_MANY);
}

/** Same as checkRateLimit, keyed on who the call is about (e.g. an email recipient). */
export async function checkSubjectRateLimit(subjectUserId: string, fn: string, max: number, windowMinutes: number): Promise<void> {
  if ((await countSince("subject_user_id", subjectUserId, fn, windowMinutes)) >= max) throw new HttpError(429, TOO_MANY);
}

/** Records a call. userId is null for internal (server-to-server) calls. */
export async function recordCall(userId: string | null, fn: string, subjectUserId: string | null = null): Promise<void> {
  const db = serviceClient();
  const { error } = await db.from("function_calls").insert({ user_id: userId, fn, subject_user_id: subjectUserId });
  if (error) console.error(`[rate_limit] record failed: ${describeError(error)}`);

  // Occasional housekeeping: rows older than two days are never counted.
  if (Math.random() < 0.01) {
    const cutoff = new Date(Date.now() - 2 * 24 * 60 * 60_000).toISOString();
    const { error: delError } = await db.from("function_calls").delete().lt("created_at", cutoff);
    if (delError) console.error(`[rate_limit] cleanup failed: ${describeError(delError)}`);
  }
}

/** Check, then record. Convenience for the common single-key case. */
export async function enforceRateLimit(userId: string, fn: string, max: number, windowMinutes: number): Promise<void> {
  await checkRateLimit(userId, fn, max, windowMinutes);
  await recordCall(userId, fn);
}
