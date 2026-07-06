import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "get_my_profile",
  title: "Get my profile",
  description:
    "Return the signed-in user's HealingNet profile. Detects whether the user is a patient, doctor, or hospital staff member and returns the matching profile row.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId();

    const [patientRes, doctorRes, staffRes] = await Promise.all([
      sb.from("patients").select("id, first_name, last_name, email, phone, gender, blood_group, genotype, city, state").eq("user_id", userId).maybeSingle(),
      sb.rpc("get_user_doctor_id", { _user_id: userId }),
      sb.from("hospital_staff").select("hospital_id, role, is_active").eq("user_id", userId).eq("is_active", true).maybeSingle(),
    ]);

    const profile = {
      user_id: userId,
      email: ctx.getUserEmail(),
      patient: patientRes.data ?? null,
      doctor_id: doctorRes.data ?? null,
      hospital_staff: staffRes.data ?? null,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(profile, null, 2) }],
      structuredContent: { profile },
    };
  },
});
