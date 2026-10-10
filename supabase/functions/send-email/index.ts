// Sends one templated email. Two kinds of caller:
//  (a) internal, server-to-server: header x-internal-secret = INTERNAL_FUNCTION_SECRET
//      (the gateway still needs a valid JWT in Authorization, e.g. the service key);
//  (b) a signed-in user, only for templates marked userAllowed and only to themselves.
// Subject, HTML and recipient address are never taken from the caller.
//
// Request:  { template, to_user_id, data }
// Response: { sent: true } | { sent: false, reason: "opted_out" | "no_email" }
import { requireUser } from "../_shared/auth.ts";
import { env } from "../_shared/clients.ts";
import { timingSafeEqual } from "../_shared/crypto.ts";
import { sendTemplate } from "../_shared/email.ts";
import { handle, HttpError, json, readJson, uuid, z } from "../_shared/http.ts";

const Body = z.object({
  template: z.string().regex(/^[a-z_]{1,64}$/),
  to_user_id: uuid(),
  data: z.record(z.unknown()).optional(),
}).strict();

Deno.serve(handle("send-email", async (req) => {
  const internalHeader = req.headers.get("x-internal-secret");
  let callerUserId: string | null;
  if (internalHeader !== null) {
    if (!(await timingSafeEqual(internalHeader, env("internalFunctionSecret")))) {
      throw new HttpError(401, "Unauthorized");
    }
    callerUserId = null;
  } else {
    callerUserId = (await requireUser(req)).user.id;
  }

  const body = await readJson(req, Body);
  const result = await sendTemplate(body.template, body.to_user_id, body.data ?? {}, { callerUserId });
  return json(req, 200, result);
}));
