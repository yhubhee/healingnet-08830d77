import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DAILY_API = "https://api.daily.co/v1";

async function daily(path: string, init: RequestInit = {}) {
  const key = Deno.env.get("DAILY_API_KEY");
  if (!key) throw new Error("DAILY_API_KEY not configured");
  const res = await fetch(`${DAILY_API}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.info || data?.error || `Daily ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: cErr } = await supabase.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub;

    const body = await req.json();
    const action = body?.action;

    if (action === "create") {
      const { consultation_id, appointment_id, doctor_name, patient_name } = body;
      const roomName = `visit-${(consultation_id || appointment_id || crypto.randomUUID()).slice(0, 16).replace(/[^a-z0-9-]/gi, "")}`.toLowerCase();
      const expiry = Math.floor(Date.now() / 1000) + 60 * 60 * 4; // 4h
      let room: any;
      try {
        room = await daily(`/rooms`, {
          method: "POST",
          body: JSON.stringify({
            name: roomName,
            privacy: "private",
            properties: {
              exp: expiry,
              enable_chat: true,
              enable_screenshare: true,
              enable_recording: "cloud",
              enable_knocking: true,
              start_video_off: false,
              start_audio_off: false,
            },
          }),
        });
      } catch (e: any) {
        if (String(e.message).includes("already exists")) {
          room = await daily(`/rooms/${roomName}`);
        } else throw e;
      }

      if (consultation_id) {
        await supabase.from("consultation_requests").update({
          meeting_link: room.url,
          daily_room_name: room.name,
          video_provider: "daily",
        }).eq("id", consultation_id);
      }
      if (appointment_id) {
        await supabase.from("patient_appointments").update({
          meeting_link: room.url,
          daily_room_name: room.name,
          is_telemedicine: true,
        }).eq("id", appointment_id);
      }
      return new Response(JSON.stringify({ room_url: room.url, room_name: room.name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "token") {
      const { room_name, user_name, is_owner } = body;
      const token = await daily(`/meeting-tokens`, {
        method: "POST",
        body: JSON.stringify({
          properties: {
            room_name,
            user_name: user_name || "Guest",
            is_owner: !!is_owner,
            exp: Math.floor(Date.now() / 1000) + 60 * 60 * 2,
          },
        }),
      });
      return new Response(JSON.stringify({ token: token.token }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "start_recording") {
      const { room_name } = body;
      // Daily auto-records when a participant with start_cloud_recording perm joins; trigger via REST:
      const r = await daily(`/recordings/start`, {
        method: "POST",
        body: JSON.stringify({ room_name }),
      }).catch(() => null);
      return new Response(JSON.stringify({ ok: true, r }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_recordings") {
      const { room_name } = body;
      const r = await daily(`/recordings?room_name=${encodeURIComponent(room_name)}`);
      return new Response(JSON.stringify(r), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "recording_link") {
      const { recording_id } = body;
      const r = await daily(`/recordings/${recording_id}/access-link`);
      return new Response(JSON.stringify(r), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("daily-room error", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
