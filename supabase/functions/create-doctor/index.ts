import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const { user_id, first_name, last_name, email, specialty } = await req.json();

    // Create doctor profile
    const { data, error } = await supabase
      .from("doctors")
      .insert({
        user_id,
        first_name,
        last_name,
        email,
        specialty,
        is_available: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Doctor creation error:", error);
      throw error;
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error creating doctor:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create doctor profile",
      }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
