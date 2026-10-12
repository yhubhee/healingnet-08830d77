// Triage nurse: rules-based (engine.ts + kb.ts), no paid AI service.
// Request and response are unchanged, so the app needs no changes:
//   Request:  { stage: "parse", age, sex, free_text }
//           | { stage: "next", age, sex, evidence, asked_ids }
//   Response: { new_evidence?, next_question?, should_stop, differential, severity_score,
//               triage_level, triage_label, recommended_specialty, red_flags, guidance } or { error }.
import { requireUser } from "../_shared/auth.ts";
import { handle, HttpError, json, readJson, z } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rate_limit.ts";
import { runNext, runParse } from "./engine.ts";

const Age = z.union([z.number(), z.string().regex(/^\d{1,3}$/).transform(Number)]).pipe(z.number().int().min(0).max(130));
const Sex = z.string().trim().min(1).max(20);
const EvidenceItem = z.object({ id: z.string().max(100), name: z.string().max(500), present: z.boolean() });

const Body = z.discriminatedUnion("stage", [
  z.object({ stage: z.literal("parse"), age: Age, sex: Sex, free_text: z.string().trim().min(1).max(2000) }),
  z.object({
    stage: z.literal("next"),
    age: Age,
    sex: Sex,
    evidence: z.array(EvidenceItem).max(60),
    asked_ids: z.array(z.string().max(100)).max(30).optional(),
  }),
]);

Deno.serve(handle("triage-nurse", async (req) => {
  const { user } = await requireUser(req);
  const body = await readJson(req, Body);
  // A full interview is about 9 requests, so this allows roughly a dozen interviews an hour.
  await enforceRateLimit(user.id, "triage-nurse", 120, 60);

  try {
    const result = body.stage === "parse"
      ? runParse(body.age, body.sex, body.free_text)
      : runNext(body.age, body.sex, body.evidence, body.asked_ids ?? []);
    return json(req, 200, result);
  } catch (e) {
    throw new HttpError(500, "The triage service is unavailable right now. Please try again.", `engine error: ${e instanceof Error ? e.name : "unknown"}`);
  }
}));
