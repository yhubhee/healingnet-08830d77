// Video calls (Daily). Only the patient and the doctor on a telemedicine
// appointment or an accepted consultation request can join, and only the
// doctor is the room owner. Rooms are private, randomly named, expire after
// about two hours, and have recording off.
//
// Request:  { kind: "appointment" | "consultation_request", id }
// Response: { url, token }
import { requireUser } from "../_shared/auth.ts";
import { env, serviceClient } from "../_shared/clients.ts";
import { describeError, handle, HttpError, json, readJson, uuid, z } from "../_shared/http.ts";
import { enforceRateLimit } from "../_shared/rate_limit.ts";

const Body = z.object({
  kind: z.enum(["appointment", "consultation_request"]),
  id: uuid(),
}).strict();

const DAILY_API = "https://api.daily.co/v1";
const CALL_SECONDS = 2 * 60 * 60;
/** Reuse an existing room only if it has at least this long left. */
const MIN_REMAINING_SECONDS = 15 * 60;

const TABLE = { appointment: "patient_appointments", consultation_request: "consultation_requests" } as const;

interface DailyRoom {
  name: string;
  url: string;
  config?: { exp?: number };
}

async function daily(path: string, init: RequestInit = {}): Promise<{ status: number; body: Record<string, unknown> }> {
  let res: Response;
  try {
    res = await fetch(`${DAILY_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env("dailyApiKey")}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    throw new HttpError(502, "Video service unavailable. Please try again.", `daily ${path.split("/")[1]}: ${describeError(e)}`);
  }
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

const nowSeconds = () => Math.floor(Date.now() / 1000);

async function getRoom(name: string): Promise<DailyRoom | null> {
  const { status, body } = await daily(`/rooms/${encodeURIComponent(name)}`);
  if (status === 404) return null;
  if (status !== 200) throw new HttpError(502, "Video service error. Please try again.", `daily get room http ${status}`);
  return body as unknown as DailyRoom;
}

async function createRoom(): Promise<DailyRoom> {
  const { status, body } = await daily("/rooms", {
    method: "POST",
    body: JSON.stringify({
      name: crypto.randomUUID(),
      privacy: "private",
      properties: {
        exp: nowSeconds() + CALL_SECONDS,
        eject_at_room_exp: true,
        enable_chat: true,
        enable_screenshare: true,
        enable_knocking: false,
        start_video_off: false,
        start_audio_off: false,
        // Recording stays off (Daily's default); there is no consent flow for it yet.
      },
    }),
  });
  if (status !== 200) throw new HttpError(502, "Video service error. Please try again.", `daily create room http ${status}`);
  return body as unknown as DailyRoom;
}

async function deleteRoom(name: string) {
  await daily(`/rooms/${encodeURIComponent(name)}`, { method: "DELETE" }).catch(() => {});
}

async function meetingToken(roomName: string, userName: string, isOwner: boolean, roomExp: number): Promise<string> {
  const { status, body } = await daily("/meeting-tokens", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        room_name: roomName,
        user_name: userName,
        is_owner: isOwner,
        exp: Math.min(roomExp, nowSeconds() + CALL_SECONDS),
        eject_at_token_exp: true,
        enable_recording: false,
      },
    }),
  });
  const token = body?.token;
  if (status !== 200 || typeof token !== "string") {
    throw new HttpError(502, "Video service error. Please try again.", `daily token http ${status}`);
  }
  return token;
}

Deno.serve(handle("daily-room", async (req) => {
  const { user, client } = await requireUser(req);
  const { kind, id } = await readJson(req, Body);

  // Authorise as the caller (RLS + auth.uid()).
  const { data: allowed, error: authErr } = await client.rpc("can_join_call", { _kind: kind, _id: id });
  if (authErr) throw new HttpError(500, "Something went wrong. Please try again.", `can_join_call: ${describeError(authErr)}`);
  if (allowed !== true) throw new HttpError(403, "You are not a participant in this call");

  await enforceRateLimit(user.id, "daily-room", 30, 60);

  const db = serviceClient();
  const table = TABLE[kind];
  const columns = kind === "consultation_request"
    ? "id, doctor_id, patient_id, daily_room_name, meeting_link, call_started_at"
    : "id, doctor_id, patient_id, daily_room_name, meeting_link";
  const { data: row, error: rowErr } = await db.from(table).select(columns).eq("id", id).maybeSingle();
  if (rowErr || !row) throw new HttpError(500, "Something went wrong. Please try again.", `call lookup: ${describeError(rowErr)}`);
  const call = row as unknown as {
    doctor_id: string | null;
    patient_id: string;
    daily_room_name: string | null;
    call_started_at?: string | null;
  };

  // Who is calling: the doctor (owner) or the patient.
  const { data: doctor } = call.doctor_id
    ? await db.from("doctors").select("user_id, first_name, last_name").eq("id", call.doctor_id).maybeSingle()
    : { data: null };
  const isDoctor = !!doctor && doctor.user_id === user.id;
  let userName: string;
  if (isDoctor) {
    userName = `Dr. ${doctor!.first_name} ${doctor!.last_name}`.trim();
  } else {
    const { data: patient } = await db
      .from("patients").select("first_name, last_name").eq("id", call.patient_id).eq("user_id", user.id).maybeSingle();
    if (!patient) throw new HttpError(403, "You are not a participant in this call");
    userName = `${patient.first_name} ${patient.last_name}`.trim();
  }

  // Reuse the room if it still has time left, otherwise create a new one.
  let room = call.daily_room_name ? await getRoom(call.daily_room_name) : null;
  if (!room || (room.config?.exp ?? 0) < nowSeconds() + MIN_REMAINING_SECONDS) {
    const created = await createRoom();
    let update = db.from(table).update({
      daily_room_name: created.name,
      meeting_link: created.url,
      ...(kind === "consultation_request" ? { video_provider: "daily" } : {}),
    }).eq("id", id);
    // Only replace the room we saw, so two people joining at once end up in the same room.
    update = call.daily_room_name ? update.eq("daily_room_name", call.daily_room_name) : update.is("daily_room_name", null);
    const { data: saved, error: saveErr } = await update.select("id");
    if (saveErr) {
      await deleteRoom(created.name);
      throw new HttpError(500, "Something went wrong. Please try again.", `save room: ${describeError(saveErr)}`);
    }
    if (saved?.length) {
      room = created;
    } else {
      // Someone else created a room first: use theirs.
      await deleteRoom(created.name);
      const { data: latest } = await db.from(table).select("daily_room_name").eq("id", id).maybeSingle();
      room = latest?.daily_room_name ? await getRoom(latest.daily_room_name) : null;
      if (!room) throw new HttpError(409, "The call is being set up. Please try again.");
    }
  }

  const token = await meetingToken(room.name, userName, isDoctor, room.config?.exp ?? nowSeconds() + CALL_SECONDS);

  // Record when the doctor first joins a consultation call (appointments have no call timestamp column).
  if (isDoctor && kind === "consultation_request" && !call.call_started_at) {
    await db.from(table).update({ call_started_at: new Date().toISOString() }).eq("id", id).is("call_started_at", null);
  }

  return json(req, 200, { url: room.url, token });
}));
