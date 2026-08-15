import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { user_id, email, name, address, phone, first_name, last_name, plan } = await req.json();
    if (!user_id || !email || !name) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify user exists and matches the email + role
    const { data: userRes, error: uErr } = await admin.auth.admin.getUserById(user_id);
    if (uErr || !userRes.user || userRes.user.email !== email) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if ((userRes.user.user_metadata as any)?.role !== "hospital") {
      return new Response(JSON.stringify({ error: "User is not a hospital admin" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hospital, error: hErr } = await admin
      .from("hospitals")
      .insert({ name, address, phone, email, active_plan: "none", subscription_status: "pending" })
      .select("id").single();
    if (hErr) throw hErr;

    const { error: sErr } = await admin.from("hospital_staff").insert({
      user_id, hospital_id: hospital.id, first_name, last_name, email,
      role: "admin", is_active: true,
    });
    if (sErr) throw sErr;

    const { error: subErr } = await admin.from("hospital_subscriptions").insert({
      hospital_id: hospital.id, plan: plan || "emr", status: "pending", billing_cycle: "monthly",
    });
    if (subErr) throw subErr;

    return new Response(JSON.stringify({ hospital_id: hospital.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-hospital error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
