// Runs the app's main data calls against the live project as the test patient from the
// repo's .env.test (E2E_PATIENT_*). It checks the calls the screens make; it does not
// drive the app's screens. Prints only step names and counts: never names, health data,
// tokens or the test login.
//
//   cd mobile && node scripts/live-check.mjs
//
// It books one "[E2E]" appointment and cancels it, sends one "[E2E]" message, saves one
// "[E2E]" triage session, makes one "[E2E]" letter request and (when a completed "[E2E]" visit exists) rates it; what it
// created is printed for e2e/cleanup.md. The allergies field is changed and put back.
// Version 0.3 (family): it adds one "[E2E]" child, books and cancels a visit for the child,
// makes a share code for the child, changes the child's allergies, then removes the child.
// Version 0.4: the one-call screens (my_visits, my_rx_documents, patient_health_overview),
// my_profile_status (the test patient's profile is filled in once with "[E2E]" values if it
// is incomplete, because booking now needs a complete profile), one speed event named
// e2e:check, and for the child: a tiny test PDF is uploaded and submitted for verification,
// my_family must say "pending", then the child and the file are removed.
// Version 0.5: with the test hospital's staff login (E2E_HOSPITAL_*, skipped and noted when it
// is missing or is not staff): the hospital's check-in code, then as the patient
// checkin_lookup, self_check_in, my_checkin_status and cancel_my_checkin; my_care; one "[E2E]"
// surgery record and one care item made by staff, seen and ticked by the patient, then the
// item is deleted and the surgery cancelled. Maps: bookable_hospitals near Uyo must return
// lat, lng and distance_km; the test hospital gets a pin in Uyo only if it has none.
// The check-in code is never printed.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
function readEnv(file) {
  const out = {};
  let text = "";
  try { text = readFileSync(file, "utf8"); } catch { return out; }
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}
const web = readEnv(resolve(here, "../../.env"));
const app = readEnv(resolve(here, "../.env"));
const test = readEnv(resolve(here, "../../.env.test"));
const url = app.EXPO_PUBLIC_SUPABASE_URL || web.VITE_SUPABASE_URL;
const key = app.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || web.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key || !test.E2E_PATIENT_EMAIL || !test.E2E_PATIENT_PASSWORD) {
  console.error("Missing settings: need the Supabase URL and publishable key (.env) and E2E_PATIENT_* (.env.test).");
  process.exit(2);
}

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
let failed = 0;
const created = [];
async function step(name, fn) {
  try {
    const note = await fn();
    console.log(`PASS  ${name}${note ? `  (${note})` : ""}`);
  } catch (e) {
    failed++;
    // Database messages are plain English and hold no personal data.
    console.log(`FAIL  ${name}  (${String(e?.message ?? e).slice(0, 160)})`);
  }
}
const must = ({ data, error }) => { if (error) throw error; return data; };
const lagosDate = (addDays) => new Date(Date.now() + 3600_000 + addDays * 86_400_000).toISOString().slice(0, 10);

let userId, patient, appointmentId;

await step("register_push_device refuses a signed-out caller", async () => {
  const { error } = await supabase.rpc("register_push_device", { p_token: "ExponentPushToken[check]", p_platform: "android", p_app_version: "0.1.0" });
  if (!error || !/permission denied/i.test(error.message)) throw new Error("expected permission denied");
});

await step("rate_appointment refuses a signed-out caller", async () => {
  const { error } = await supabase.rpc("rate_appointment", { p_appointment_id: "00000000-0000-0000-0000-000000000000", p_rating: 5 });
  if (!error || !/permission denied/i.test(error.message)) throw new Error("expected permission denied");
});

await step("my_family refuses a signed-out caller", async () => {
  const { error } = await supabase.rpc("my_family");
  if (!error || !/permission denied/i.test(error.message)) throw new Error("expected permission denied");
});

await step("sign in with email and password", async () => {
  const { data, error } = await supabase.auth.signInWithPassword({ email: test.E2E_PATIENT_EMAIL, password: test.E2E_PATIENT_PASSWORD });
  if (error) throw new Error("sign-in failed");
  userId = data.user.id;
});

await step("role detection says patient", async () => {
  if (must(await supabase.rpc("admin_whoami")) === true) throw new Error("admin");
  const pharmacy = must(await supabase.rpc("my_pharmacy"));
  if (pharmacy?.member) throw new Error("pharmacy");
  if (must(await supabase.rpc("my_doctor_id"))) throw new Error("doctor");
  if ((must(await supabase.rpc("my_hospital_ids")) ?? []).some((r) => r.membership === "staff")) throw new Error("hospital staff");
  patient = must(await supabase.from("patients").select("*").eq("user_id", userId).maybeSingle());
  if (!patient) throw new Error("no patient profile");
  const required = ["phone", "date_of_birth", "gender", "state", "city", "address", "emergency_contact_name", "emergency_contact_phone"];
  const missing = required.filter((k) => !String(patient[k] ?? "").trim()).length;
  return missing ? `profile incomplete: ${missing} fields, the app would show Complete profile` : "profile complete";
});

// ---- Version 0.4: complete profile, one call per screen, speed data ------------------------
await step("my_profile_status: the test patient's profile is complete (filled in once if not)", async () => {
  let status = must(await supabase.rpc("my_profile_status"));
  if (!status?.is_patient) throw new Error("not a patient");
  if (status.complete) return "complete; nothing changed";
  // Booking now needs a complete profile. Only the empty fields are filled, with [E2E]-safe values.
  const fill = {
    phone: "08000000000", date_of_birth: "1990-01-01", gender: "other", state: "Lagos", city: "[E2E] City", address: "[E2E] test address",
    emergency_contact_name: "[E2E] Contact", emergency_contact_phone: "08000000001",
  };
  const patch = Object.fromEntries((status.missing ?? []).filter((k) => k in fill).map((k) => [k, fill[k]]));
  must(await supabase.from("patients").update(patch).eq("id", patient.id));
  created.push(`patients ${patient.id} (the test patient): ${Object.keys(patch).length} empty required profile field(s) filled with [E2E] values: ${Object.keys(patch).join(", ")}`);
  status = must(await supabase.rpc("my_profile_status"));
  if (!status.complete) throw new Error(`still incomplete: ${(status.missing ?? []).length} field(s)`);
  return `was incomplete; filled ${Object.keys(patch).length} field(s)`;
});

await step("my_visits: open visits and the latest 30 past ones in one call, then an older page", async () => {
  const v = must(await supabase.rpc("my_visits", { p_patient_id: patient.id }));
  if (!Array.isArray(v?.upcoming) || !Array.isArray(v?.past) || typeof v.has_more_past !== "boolean") throw new Error("unexpected shape");
  if (v.past.length > 30) throw new Error(`${v.past.length} past visits in the first page`);
  const first = v.upcoming[0] ?? v.past[0];
  if (first && !("doctors" in first && "hospitals" in first && "review" in first)) throw new Error("a visit is missing its doctor, hospital or review");
  let note = `${v.upcoming.length} upcoming, ${v.past.length} past, more: ${v.has_more_past}`;
  if (v.has_more_past) {
    const older = must(await supabase.rpc("my_visits", { p_patient_id: patient.id, p_past_offset: v.past.length }));
    const seen = new Set(v.past.map((a) => a.id));
    if (older.upcoming.length !== 0) throw new Error("an older page repeated the upcoming visits");
    if (older.past.some((a) => seen.has(a.id))) throw new Error("an older page repeated a visit");
    note += `; next page ${older.past.length}, no repeats`;
  }
  return note;
});

await step("my_rx_documents: every prescription document in one call, without signatures", async () => {
  const docs = must(await supabase.rpc("my_rx_documents", { p_patient_id: patient.id }));
  if (!Array.isArray(docs)) throw new Error("unexpected shape");
  if (docs.some((d) => "signature_data" in d)) throw new Error("a signature image came with the list");
  const withCode = docs.filter((d) => typeof d.code === "string" && d.code).length;
  if (docs.length && docs[0].document_id) {
    const one = must(await supabase.rpc("rx_document", { p_document_id: docs[0].document_id }));
    if (!one || one.status === "not_found") throw new Error("rx_document could not open the first document");
  }
  return `${docs.length} documents, ${withCode} with a code; rx_document still opens one`;
});

await step("patient_health_overview: prescriptions, labs, records and letters", async () => {
  const o = must(await supabase.rpc("patient_health_overview", { p_patient_id: patient.id }));
  for (const part of ["prescriptions", "labs", "records", "letters"]) {
    if (!o?.[part] || typeof o[part].total !== "number") throw new Error(`${part} is missing`);
  }
  return `prescriptions ${o.prescriptions.active} active of ${o.prescriptions.total}, labs ${o.labs.new} new of ${o.labs.total}, records ${o.records.total}, letters ${o.letters.total}`;
});

await step("log_perf_events: one [E2E] speed event is kept, bad ones are skipped", async () => {
  const event = { occurred_at: new Date().toISOString(), platform: "android", app_version: "0.4.0", kind: "screen", name: "e2e:check", duration_ms: 1, ok: true, network: "wifi" };
  const kept = must(await supabase.rpc("log_perf_events", { p_events: [event, { ...event, name: "Not A Route Name" }, { ...event, kind: "other" }] }));
  if (kept !== 1) throw new Error(`${kept} kept, expected 1`);
  created.push("perf_events: 1 row named e2e:check (no user id; removed by itself after 30 days)");
  const tooMany = await supabase.rpc("log_perf_events", { p_events: Array.from({ length: 51 }, () => event) });
  if (!tooMany.error) throw new Error("51 events at once were accepted");
  return "1 kept, 2 skipped; 51 at once refused";
});

await step("Home loads (appointments, prescriptions, updates)", async () => {
  const appts = must(await supabase.from("patient_appointments")
    .select("id, patient_id, doctor_id, hospital_id, requested_date, requested_time, status, reason, is_telemedicine, decline_reason")
    .eq("patient_id", patient.id).order("requested_date", { ascending: false }));
  const { data, error, count } = await supabase.from("user_notifications")
    .select("id, title, message, type, action_url, created_at", { count: "exact" }).eq("is_read", false).order("created_at", { ascending: false }).limit(3);
  if (error) throw error;
  return `${appts.length} appointments, ${count ?? data.length} unread updates`;
});

let hospital;
await step("booking: hospitals and doctors lists load", async () => {
  const hospitals = must(await supabase.rpc("bookable_hospitals", {}));
  if (!hospitals?.length) throw new Error("no bookable hospitals");
  hospital = hospitals[0];
  const doctors = must(await supabase.rpc("bookable_doctors", { p_hospital_id: hospital.id }));
  return `${hospitals.length} hospitals, ${doctors.length} doctors at the first one`;
});

await step('book "any available doctor" with [E2E] in the reason', async () => {
  if (!hospital) throw new Error("no hospital to book");
  const reason = `[E2E] mobile app check ${Date.now().toString(36)}`;
  must(await supabase.rpc("book_appointment", {
    p_hospital_id: hospital.id, p_doctor_id: null, p_date: lagosDate(3), p_time: "10:00", p_is_telemedicine: false, p_reason: reason,
  }));
  const row = must(await supabase.from("patient_appointments").select("id, status, doctor_id").eq("patient_id", patient.id).eq("reason", reason).maybeSingle());
  if (!row) throw new Error("the booking was not found afterwards");
  appointmentId = row.id;
  created.push(`patient_appointments ${row.id} (${reason})`);
  if (row.status !== "pending") throw new Error(`status is ${row.status}, expected pending`);
  return 'shows in Visits as "Waiting for the hospital to confirm"';
});

await step("cancel it", async () => {
  if (!appointmentId) throw new Error("nothing to cancel");
  must(await supabase.from("patient_appointments").update({ status: "cancelled" }).eq("id", appointmentId));
  const row = must(await supabase.from("patient_appointments").select("status").eq("id", appointmentId).single());
  if (row.status !== "cancelled") throw new Error(`status is ${row.status}`);
  return 'shows in Past as "Cancelled"';
});

await step("prescriptions load with a code for the QR", async () => {
  const rows = must(await supabase.from("prescriptions").select("rx_document_id, created_at")
    .eq("patient_id", patient.id).not("rx_document_id", "is", null).order("created_at", { ascending: false }).limit(500));
  const ids = [...new Set(rows.map((r) => r.rx_document_id))].slice(0, 40);
  if (ids.length === 0) return "the test patient has no prescriptions; the QR could not be checked";
  const doc = must(await supabase.rpc("rx_document", { p_document_id: ids[0] }));
  if (!doc?.code) throw new Error("the document has no code");
  must(await supabase.from("rx_pharmacy_requests").select("*, pharmacies(name)").eq("patient_id", patient.id).limit(5));
  must(await supabase.rpc("pharmacy_directory", {}));
  return `${ids.length} documents; first is "${doc.status}" with ${doc.items?.length ?? 0} medicines`;
});

// ---- Version 0.2 ------------------------------------------------------------------------
const E2E_NOTE = `[E2E] mobile app check ${Date.now().toString(36)}`;
let visits = [];
let labs = [];

await step("Visits loads with the 0.2 columns, the patient's ratings and doctors' review counts", async () => {
  visits = must(await supabase.from("patient_appointments")
    .select("id, patient_id, doctor_id, hospital_id, requested_date, requested_time, status, reason, is_telemedicine, decline_reason, created_at, updated_at, call_started_at, call_ended_at")
    .eq("patient_id", patient.id).order("requested_date", { ascending: false }));
  const reviews = must(await supabase.from("appointment_reviews").select("appointment_id, rating, comment").eq("patient_id", patient.id));
  const doctorIds = [...new Set(visits.map((a) => a.doctor_id).filter(Boolean))].slice(0, 50);
  const counts = doctorIds.length ? must(await supabase.from("doctors").select("id, review_count").in("id", doctorIds)) : [];
  return `${visits.length} visits, ${reviews.length} ratings, review counts for ${counts.length} doctors`;
});

await step("lab results load (tests and parameters)", async () => {
  const rows = must(await supabase.from("lab_results")
    .select("id, created_at, status, notes, patient_viewed_at, hospitals(name), lab_result_tests(id, test_name, category_name, lab_result_parameters(id, parameter_name, result_value, unit_snapshot, ref_range_snapshot, flag, sort_order))")
    .eq("patient_id", patient.id).order("created_at", { ascending: false }));
  const params = rows.flatMap((r) => (r.lab_result_tests ?? []).flatMap((t) => t.lab_result_parameters ?? []));
  labs = rows;
  return `${rows.length} results, ${params.length} values, ${params.filter((x) => ["low", "high", "abnormal"].includes(x.flag)).length} flagged outside the range`;
});

// Writes nothing: an unseen finished result is left alone, so "New" can still be tested on a phone.
await step('lab results: "seen by the patient" is kept by the database', async () => {
  const ready = (r) => r.status === "completed" || r.status === "final";
  const unknown = await supabase.rpc("mark_lab_result_viewed", { p_lab_result_id: "00000000-0000-0000-0000-000000000000" });
  if (!unknown.error || !/not found/i.test(unknown.error.message)) throw new Error("a result that is not the patient's was not refused");
  const notes = [`${labs.filter((r) => ready(r) && !r.patient_viewed_at).length} finished and new, ${labs.filter((r) => r.patient_viewed_at).length} seen`];
  const waiting = labs.find((r) => !ready(r));
  if (waiting) {
    if (must(await supabase.rpc("mark_lab_result_viewed", { p_lab_result_id: waiting.id })) !== null) throw new Error("a result that is not finished was marked as seen");
    notes.push("one that is not finished stays unseen");
  }
  const seen = labs.find((r) => ready(r) && r.patient_viewed_at);
  if (seen) {
    const again = must(await supabase.rpc("mark_lab_result_viewed", { p_lab_result_id: seen.id }));
    if (new Date(again).getTime() !== new Date(seen.patient_viewed_at).getTime()) throw new Error("the first-seen time changed on a second look");
    notes.push("a second look keeps the first time");
  }
  const direct = waiting ?? labs[0];
  if (direct) {
    await supabase.from("lab_results").update({ patient_viewed_at: "2020-01-01T00:00:00Z" }).eq("id", direct.id);
    const after = must(await supabase.from("lab_results").select("patient_viewed_at").eq("id", direct.id).single());
    if (after.patient_viewed_at !== direct.patient_viewed_at) throw new Error("the patient could set the seen time directly");
    notes.push("setting it directly changes nothing");
  }
  return notes.join("; ");
});

await step("medical records load", async () => {
  const rows = must(await supabase.from("emr_entries")
    .select("id, entry_type, title, content, created_at, vital_data, doctors(first_name, last_name), hospitals(name)")
    .eq("patient_id", patient.id).order("created_at", { ascending: false }));
  return `${rows.length} entries`;
});

await step("letters load", async () => {
  const rows = must(await supabase.from("patient_letters")
    .select("id, letter_type, title, body, status, issued_at, valid_until, pdf_url, doctors(first_name, last_name, specialty), hospitals(name, address)")
    .eq("patient_id", patient.id).order("issued_at", { ascending: false }));
  return `${rows.length} letters`;
});

await step("letters: an [E2E] request can be made and shows as pending", async () => {
  must(await supabase.from("patient_letters").insert({
    patient_id: patient.id, doctor_id: null, hospital_id: null, letter_type: "sick_leave", title: "Request: Sick Leave Letter",
    body: E2E_NOTE, status: "pending", issued_at: new Date().toISOString().slice(0, 10),
  }));
  const row = must(await supabase.from("patient_letters").select("id, status").eq("patient_id", patient.id).eq("body", E2E_NOTE).maybeSingle());
  if (!row) throw new Error("the request was not found afterwards");
  if (row.status !== "pending") throw new Error(`status is ${row.status}, expected pending`);
  created.push(`patient_letters ${row.id} (a pending request; body is "${E2E_NOTE}")`);
  return "shows in Letters as waiting for the doctor";
});

await step("messages load, and an [E2E] message can be sent", async () => {
  const cols = "id, from_user_id, to_user_id, body, created_at, is_read";
  const rows = must(await supabase.from("patient_messages").select(cols).or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`).order("created_at", { ascending: false }).limit(500));
  const others = [...new Set(rows.map((m) => (m.from_user_id === userId ? m.to_user_id : m.from_user_id)))];
  // The database lets a patient write to a doctor they have a visit with. Prefer someone
  // already in a conversation; otherwise a doctor from the patient's visits.
  let to = others[0];
  if (!to) {
    const doctorIds = [...new Set(visits.map((a) => a.doctor_id).filter(Boolean))].slice(0, 20);
    const doctors = doctorIds.length ? must(await supabase.from("doctors").select("id, user_id").in("id", doctorIds)) : [];
    to = doctors.find((d) => d.user_id)?.user_id;
  }
  if (!to) return `${rows.length} messages in ${others.length} conversations; NOT SENT: the test patient has no doctor to write to`;
  must(await supabase.from("patient_messages").insert({ from_user_id: userId, to_user_id: to, body: E2E_NOTE }));
  const sent = must(await supabase.from("patient_messages").select("id").eq("from_user_id", userId).eq("body", E2E_NOTE).maybeSingle());
  if (!sent) throw new Error("the message was not found afterwards");
  created.push(`patient_messages ${sent.id} (${E2E_NOTE})`);
  // Mark-as-read is the recipient's update; check it runs without error on messages sent to the patient.
  const unread = rows.filter((m) => m.to_user_id === userId && !m.is_read).slice(0, 1).map((m) => m.id);
  if (unread.length) {
    must(await supabase.from("patient_messages").update({ is_read: true }).in("id", unread));
    must(await supabase.from("patient_messages").update({ is_read: false }).in("id", unread)); // put back; may be refused silently by the column grant
  }
  const alert = must(await supabase.from("user_notifications").select("id, type, action_url").eq("type", "message").order("created_at", { ascending: false }).limit(1));
  return `${rows.length} messages in ${others.length} conversations; one [E2E] message sent; the patient has ${alert.length ? "a" : "no"} "New message" notification of their own`;
});

await step("health card: allergies save, then the original value is restored", async () => {
  const before = must(await supabase.from("patients").select("allergies, medical_conditions").eq("id", patient.id).single());
  const probe = "[E2E] Penicillin";
  must(await supabase.from("patients").update({ allergies: probe }).eq("id", patient.id));
  const during = must(await supabase.from("patients").select("allergies").eq("id", patient.id).single());
  must(await supabase.from("patients").update({ allergies: before.allergies }).eq("id", patient.id));
  const after = must(await supabase.from("patients").select("allergies, medical_conditions").eq("id", patient.id).single());
  if (during.allergies !== probe) throw new Error("the value did not save");
  if (after.allergies !== before.allergies || after.medical_conditions !== before.medical_conditions) throw new Error("the original value was not restored");
  return "saved, read back, restored";
});

await step("health card: more than 500 characters is refused by the database", async () => {
  const { error } = await supabase.from("patients").update({ allergies: "x".repeat(501) }).eq("id", patient.id);
  if (!error) {
    await supabase.from("patients").update({ allergies: patient.allergies ?? null }).eq("id", patient.id);
    throw new Error("a 501-character value was accepted");
  }
});

await step("Check symptoms: the triage function answers, and an [E2E] session saves", async () => {
  const { data, error } = await supabase.functions.invoke("triage-nurse", { body: { stage: "parse", age: 30, sex: "male", free_text: "headache and a mild fever since yesterday" } });
  if (error || !data || data.error) throw new Error("triage-nurse did not answer");
  if (typeof data.triage_level !== "string" || typeof data.recommended_specialty !== "string") throw new Error("the answer has no triage level or specialty");
  const map = { self_care: "routine", consultation: "soon", consultation_24: "soon", emergency_ambulance: "emergency", emergency: "emergency" };
  must(await supabase.from("triage_sessions").insert({
    patient_id: patient.id, symptoms: [E2E_NOTE], severity_self: null,
    severity_score: data.severity_score || Math.round((data.differential?.[0]?.probability || 0.3) * 10),
    recommended_specialty: data.recommended_specialty, urgency: map[data.triage_level] || "soon", recommended_hospitals: data, lat: null, lng: null,
  }));
  created.push(`triage_sessions: one row for the test patient whose symptoms are ["${E2E_NOTE}"]`);
  const danger = await supabase.functions.invoke("triage-nurse", { body: { stage: "parse", age: 58, sex: "male", free_text: "crushing chest pain spreading to my left arm, sweating and short of breath" } });
  const level = danger.data?.triage_level ?? "no answer";
  return `first question ${data.next_question ? `is a "${data.next_question.type ?? "boolean"}" one` : "not needed"}; a chest-pain description gives "${level}"`;
});

await step("Rate your visit: rate a completed [E2E] visit", async () => {
  const cutoff = Date.now() - 30 * 86_400_000;
  const mine = must(await supabase.from("appointment_reviews").select("appointment_id, rating, comment").eq("patient_id", patient.id));
  const target = visits.find((a) => a.status === "completed" && a.doctor_id && String(a.reason ?? "").includes("[E2E]") && +new Date(a.updated_at ?? a.created_at) > cutoff);
  if (!target) {
    // Still prove the rule: a visit that is not completed is refused with the database's own words.
    const other = visits.find((a) => a.status !== "completed");
    if (other) {
      const { error } = await supabase.rpc("rate_appointment", { p_appointment_id: other.id, p_rating: 5 });
      if (!error) throw new Error("a visit that is not completed was rated");
      return `NOT RUN: no completed [E2E] visit from the last 30 days. A ${other.status} visit is refused: "${error.message}"`;
    }
    return "NOT RUN: no completed [E2E] visit from the last 30 days";
  }
  const old = mine.find((r) => r.appointment_id === target.id);
  must(await supabase.rpc("rate_appointment", { p_appointment_id: target.id, p_rating: 4, p_comment: E2E_NOTE }));
  const saved = must(await supabase.from("appointment_reviews").select("rating, comment").eq("appointment_id", target.id).single());
  if (saved.rating !== 4) throw new Error("the rating did not save");
  const { error: bad } = await supabase.rpc("rate_appointment", { p_appointment_id: target.id, p_rating: 6 });
  if (!bad) throw new Error("6 stars was accepted");
  if (old) {
    must(await supabase.rpc("rate_appointment", { p_appointment_id: target.id, p_rating: old.rating, p_comment: old.comment ?? undefined }));
    return "rated 4 stars, read back, then the earlier rating was put back; 6 stars is refused";
  }
  created.push(`appointment_reviews: a 4-star rating on appointment ${target.id} (${E2E_NOTE}); the doctor's rating and review_count include it`);
  return "rated 4 stars and read back; 6 stars is refused";
});

await step("Settings notification switches save", async () => {
  const cols = "push_enabled, push_appointments, push_prescriptions, push_lab_results, push_other, push_show_details";
  const before = must(await supabase.from("notification_preferences").select(cols).eq("user_id", userId).maybeSingle());
  const original = before?.push_lab_results ?? true;
  must(await supabase.from("notification_preferences").upsert({ user_id: userId, push_lab_results: !original }, { onConflict: "user_id" }));
  const after = must(await supabase.from("notification_preferences").select(cols).eq("user_id", userId).single());
  if (after.push_lab_results !== !original) throw new Error("the switch did not save");
  if (after.push_show_details !== (before?.push_show_details ?? false)) throw new Error("another switch changed");
  must(await supabase.from("notification_preferences").upsert({ user_id: userId, push_lab_results: original }, { onConflict: "user_id" }));
  return before ? "saved, then put back" : "row created, saved, then put back";
});

await step("push device: register and unregister", async () => {
  const token = `ExponentPushToken[e2e-check-${Date.now().toString(36)}]`;
  must(await supabase.rpc("register_push_device", { p_token: token, p_platform: "android", p_app_version: "0.2.0" }));
  const mine = must(await supabase.from("push_devices").select("id"));
  must(await supabase.rpc("unregister_push_device", { p_token: token }));
  const left = must(await supabase.from("push_devices").select("id"));
  if (left.length !== mine.length - 1) throw new Error("the device was not removed");
});

await step("share code can be created", async () => {
  const data = must(await supabase.rpc("create_patient_share_code"));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.code) throw new Error("no code returned");
  created.push("patient_share_codes: one code (expires by itself after 15 minutes)");
});

// ---- Version 0.3: family profiles ---------------------------------------------------------
const CHILD_LAST = `[E2E] ${Date.now().toString(36)}`;
const yearsAgo = (n) => { const d = new Date(Date.now() + 3600_000); d.setUTCFullYear(d.getUTCFullYear() - n); return d.toISOString().slice(0, 10); };
let childId, childAppointmentId, childRemoved = false, childDocPath = null;
// The smallest valid PDF: one empty page. It says nothing and proves nothing.
const TINY_PDF = new TextEncoder().encode("%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 3 3]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

await step("family: an adult cannot be added without their permission", async () => {
  const { data, error } = await supabase.rpc("add_family_member", {
    p_first_name: "E2E-Adult", p_last_name: CHILD_LAST, p_date_of_birth: yearsAgo(40), p_gender: "female", p_relationship: "parent",
  });
  if (!error) {
    if (data) { created.push(`patients ${data} (an [E2E] adult family member that should have been refused)`); await supabase.rpc("remove_family_member", { p_patient_id: data }); }
    throw new Error("an adult was added without the permission tick");
  }
  return `refused: "${error.message}"`;
});

await step("family: add an [E2E] child", async () => {
  childId = must(await supabase.rpc("add_family_member", {
    p_first_name: "E2E-Child", p_last_name: CHILD_LAST, p_date_of_birth: yearsAgo(6), p_gender: "male", p_relationship: "child",
  }));
  if (!childId) throw new Error("no patient id returned");
  created.push(`patients ${childId} (family member "E2E-Child ${CHILD_LAST}", with its patient_guardians row; removed again by the script unless a later step failed)`);
});

await step("family: the child appears in my_family", async () => {
  if (!childId) throw new Error("no child was added");
  const family = must(await supabase.rpc("my_family"));
  const row = (family ?? []).find((m) => m.patient_id === childId);
  if (!row) throw new Error("the child is not in my_family");
  if (row.age !== 6 || row.is_adult !== false || row.relationship !== "child") throw new Error(`age ${row.age}, adult ${row.is_adult}, relationship ${row.relationship}`);
  const profile = must(await supabase.from("patients").select("id, user_id, date_of_birth").eq("id", childId).maybeSingle());
  if (!profile) throw new Error("the guardian cannot read the child's profile");
  const link = must(await supabase.from("patient_guardians").select("patient_id, consent_confirmed_at").eq("patient_id", childId).maybeSingle());
  if (!link) throw new Error("the guardian cannot read the family link");
  return `${family.length} family member(s); age 6, not an adult, no account of their own: ${profile.user_id === null}`;
});

await step("family 0.4: the new child is unverified, usable, and due in 3 days", async () => {
  if (!childId) throw new Error("no child was added");
  const row = (must(await supabase.rpc("my_family")) ?? []).find((m) => m.patient_id === childId);
  if (!row) throw new Error("the child is not in my_family");
  const days = (Date.parse(row.verification_due_at) - Date.now()) / 86_400_000;
  if (row.verification_status !== "unverified" || row.access_ok !== true || !(days > 2.9 && days <= 3)) {
    throw new Error(`status ${row.verification_status}, access ${row.access_ok}, due in ${days.toFixed(2)} days`);
  }
  return "unverified, access ok, due in 3 days";
});

await step("family 0.4: a document type that does not fit the relationship is refused", async () => {
  if (!childId) throw new Error("no child was added");
  const { error } = await supabase.rpc("submit_family_document", { p_patient_id: childId, p_document_type: "marriage_certificate", p_storage_path: `${userId}/${childId}/x.pdf` });
  if (!error || !/does not prove this relationship/i.test(error.message)) throw new Error("expected a refusal about the relationship");
  return "marriage certificate refused for a child";
});

await step("family 0.4: upload a tiny [E2E] test PDF, submit it, and my_family says pending", async () => {
  if (!childId) throw new Error("no child was added");
  const path = `${userId}/${childId}/${crypto.randomUUID()}.pdf`;
  const upload = await supabase.storage.from("family-documents").upload(path, TINY_PDF, { contentType: "application/pdf", upsert: false });
  if (upload.error) throw new Error(`upload refused: ${upload.error.message}`);
  childDocPath = path;
  created.push("storage family-documents: 1 tiny test PDF in the test patient's folder for the [E2E] child (deleted again by the script unless a later step failed)");
  // Another person's folder is refused.
  const other = await supabase.storage.from("family-documents").upload(`00000000-0000-4000-8000-000000000000/${childId}/${crypto.randomUUID()}.pdf`, TINY_PDF, { contentType: "application/pdf" });
  if (!other.error) throw new Error("an upload into someone else's folder was accepted");
  const docId = must(await supabase.rpc("submit_family_document", { p_patient_id: childId, p_document_type: "birth_certificate", p_storage_path: path }));
  if (!docId) throw new Error("no document id returned");
  created.push(`family_documents ${docId} (birth_certificate for the [E2E] child; withdrawn or deleted when the child is removed)`);
  const row = (must(await supabase.rpc("my_family")) ?? []).find((m) => m.patient_id === childId);
  if (row?.verification_status !== "pending" || row.access_ok !== true) throw new Error(`status ${row?.verification_status}, access ${row?.access_ok}`);
  // A file under review cannot be deleted by the guardian.
  await supabase.storage.from("family-documents").remove([path]);
  const still = must(await supabase.storage.from("family-documents").list(`${userId}/${childId}`));
  if (!(still ?? []).length) throw new Error("a file under review was deleted");
  return "uploaded, submitted, pending, still usable; someone else's folder refused; the file under review could not be deleted";
});

await step("family: book for the child with p_patient_id, then cancel", async () => {
  if (!childId || !hospital) throw new Error("no child or no hospital");
  const reason = `[E2E] mobile app check, family ${Date.now().toString(36)}`;
  must(await supabase.rpc("book_appointment", {
    p_hospital_id: hospital.id, p_doctor_id: null, p_date: lagosDate(4), p_time: "11:00", p_is_telemedicine: false, p_reason: reason, p_patient_id: childId,
  }));
  const row = must(await supabase.from("patient_appointments").select("id, status, patient_id").eq("patient_id", childId).eq("reason", reason).maybeSingle());
  if (!row) throw new Error("the booking was not found under the child");
  childAppointmentId = row.id;
  created.push(`patient_appointments ${row.id} (for the [E2E] child; ${reason})`);
  const own = must(await supabase.from("patient_appointments").select("id").eq("patient_id", patient.id).eq("reason", reason));
  if (own.length) throw new Error("the booking was also saved under the guardian");
  must(await supabase.from("patient_appointments").update({ status: "cancelled" }).eq("id", row.id));
  const after = must(await supabase.from("patient_appointments").select("status").eq("id", row.id).single());
  if (after.status !== "cancelled") throw new Error(`status is ${after.status}`);
  // Notifications about the child come to the guardian, naming the child.
  const notes = must(await supabase.from("user_notifications").select("id, title").eq("subject_patient_id", childId));
  const named = notes.filter((n) => String(n.title).startsWith("E2E-Child: ")).length;
  if (notes.length) created.push(`user_notifications: ${notes.length} for the guardian about the [E2E] child`);
  return `booked as pending under the child only, then cancelled; ${notes.length} notification(s) about the child, ${named} with the name in front`;
});

await step("family: a share code for the child", async () => {
  if (!childId) throw new Error("no child was added");
  const data = must(await supabase.rpc("create_patient_share_code", { p_patient_id: childId }));
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.code) throw new Error("no code returned");
  created.push("patient_share_codes: one code for the [E2E] child (expires by itself after 15 minutes; cancelled when the child is removed)");
  const stranger = await supabase.rpc("create_patient_share_code", { p_patient_id: "00000000-0000-0000-0000-000000000000" });
  if (!stranger.error) throw new Error("a code was created for someone who is not in the family");
  return "created; a patient who is not in the family is refused";
});

await step("family: update the child's allergies", async () => {
  if (!childId) throw new Error("no child was added");
  const probe = "[E2E] Peanuts";
  must(await supabase.from("patients").update({ allergies: probe, blood_group: "O+" }).eq("id", childId));
  const after = must(await supabase.from("patients").select("allergies, blood_group").eq("id", childId).single());
  if (after.allergies !== probe || after.blood_group !== "O+") throw new Error("the health card did not save");
  return "saved and read back";
});

await step("family: remove the child", async () => {
  if (!childId) throw new Error("no child was added");
  const result = must(await supabase.rpc("remove_family_member", { p_patient_id: childId }));
  childRemoved = true;
  const family = must(await supabase.rpc("my_family"));
  if ((family ?? []).some((m) => m.patient_id === childId)) throw new Error("the child is still in my_family");
  const row = must(await supabase.from("patients").select("id").eq("id", childId).maybeSingle());
  if (row) throw new Error("the guardian can still read the child's profile");
  const again = await supabase.rpc("remove_family_member", { p_patient_id: childId });
  if (!again.error) throw new Error("removing twice was accepted");
  if (result?.held_by_hospitals) created.push(`patients ${childId}: KEPT for a hospital after removal (held_by_hospitals = true), no longer linked to the account`);
  return result?.held_by_hospitals
    ? "removed from the account; a hospital holds the record, so the row stays with that hospital"
    : "removed and deleted; no longer readable; a second removal is refused";
});

await step("family 0.4: the child's test PDF is deleted after removal", async () => {
  if (!childDocPath) throw new Error("no file was uploaded");
  if (!childRemoved) throw new Error("the child was not removed");
  await supabase.storage.from("family-documents").remove([childDocPath]);
  const left = must(await supabase.storage.from("family-documents").list(`${userId}/${childId}`));
  if ((left ?? []).length) throw new Error(`${left.length} file(s) still in the child's folder`);
  return "folder empty";
});

// ---- Version 0.5: scan to check in, care plans, hospital locations --------------------------
await step("my_care refuses a signed-out caller", async () => {
  const anon = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { error } = await anon.rpc("my_care");
  if (!error || !/permission denied/i.test(error.message)) throw new Error("expected permission denied");
});

const staff = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
let staffHospitalId = null;
let checkinToken = null;
let checkedIn = null;
let surgeryId = null;
let careItemId = null;
const skip = (why) => `SKIPPED: ${why}`;

await step("0.5 staff: sign in as the test hospital", async () => {
  if (!test.E2E_HOSPITAL_EMAIL || !test.E2E_HOSPITAL_PASSWORD) return skip("no E2E_HOSPITAL_* in .env.test");
  const { error } = await staff.auth.signInWithPassword({ email: test.E2E_HOSPITAL_EMAIL, password: test.E2E_HOSPITAL_PASSWORD });
  if (error) throw new Error("staff sign-in failed");
  const mine = must(await staff.rpc("my_hospital_ids")) ?? [];
  staffHospitalId = mine.find((r) => r.membership === "staff")?.hospital_id ?? null;
  if (!staffHospitalId) return skip("the test hospital account is not hospital staff");
  return "signed in as hospital staff";
});

await step("0.5 staff: the hospital's check-in code (made on first use)", async () => {
  if (!staffHospitalId) return skip("no staff hospital");
  const token = must(await staff.rpc("hospital_checkin_code", { p_hospital_id: staffHospitalId }));
  if (typeof token !== "string" || !/^[a-z0-9]{8,64}$/.test(token)) throw new Error("the code does not look like a check-in code");
  const again = must(await staff.rpc("hospital_checkin_code", { p_hospital_id: staffHospitalId }));
  if (again !== token) throw new Error("the code changed on a second call");
  checkinToken = token;
  const asPatient = await supabase.rpc("hospital_checkin_code", { p_hospital_id: staffHospitalId });
  if (!asPatient.error) throw new Error("a patient could read the hospital's check-in code");
  return `${token.length} characters, the same on a second call; a patient is refused`;
});

await step("0.5 check-in: a wrong code is refused with the database's message", async () => {
  const { error } = await supabase.rpc("checkin_lookup", { p_token: "zzzzzzzzzzzzzzzz", p_patient_id: patient.id });
  if (!error || !/check-in code is not valid/i.test(error.message)) throw new Error("expected 'This check-in code is not valid…'");
});

await step("0.5 check-in: checkin_lookup as the test patient", async () => {
  if (!checkinToken) return skip("no check-in code");
  const l = must(await supabase.rpc("checkin_lookup", { p_token: checkinToken, p_patient_id: patient.id }));
  if (l?.hospital_id !== staffHospitalId || !l?.name) throw new Error("the lookup did not return the test hospital");
  for (const k of ["city", "state", "logo_url", "appointment_today", "already_checked_in", "already_linked"]) if (!(k in l)) throw new Error(`missing ${k}`);
  return `hospital found; already linked: ${l.already_linked}; visit today: ${l.appointment_today ? "yes" : "no"}; already in the queue: ${l.already_checked_in ? "yes" : "no"}`;
});

await step("0.5 check-in: self_check_in, the same place on a second scan", async () => {
  if (!checkinToken) return skip("no check-in code");
  const r = must(await supabase.rpc("self_check_in", { p_token: checkinToken, p_patient_id: patient.id, p_reason: E2E_NOTE }));
  if (!r?.checkin_id || typeof r.queue_number !== "number" || r.queue_number < 1) throw new Error("no queue number came back");
  checkedIn = r;
  if (!r.already) created.push(`patient_checkins ${r.checkin_id} (app check-in, notes end "Reason: ${E2E_NOTE}"; left the queue below). The test patient is now linked to hospital ${staffHospitalId} (patient_hospital link) and the front desk got a "New patient check-in" notification`);
  const again = must(await supabase.rpc("self_check_in", { p_token: checkinToken, p_patient_id: patient.id }));
  if (again.checkin_id !== r.checkin_id || again.already !== true || again.queue_number !== r.queue_number) throw new Error("a second scan did not return the same place");
  return `queue number given by the database, ${r.ahead} ahead, type and status "${r.status}"; second scan says already: true`;
});

await step("0.5 check-in: the front desk sees it, tagged as an app check-in with the reason", async () => {
  if (!checkedIn) return skip("not checked in");
  const row = must(await staff.from("patient_checkins").select("id, queue_number, notes, checkin_type, status, patients(first_name)").eq("id", checkedIn.checkin_id).maybeSingle());
  if (!row) throw new Error("staff cannot see the check-in");
  if (!String(row.notes ?? "").startsWith("Checked in with the HealingNet app")) throw new Error("the notes do not start with the app's tag");
  if (!String(row.notes).includes(`Reason: ${E2E_NOTE}`)) throw new Error("the reason is not in the notes");
  if (!row.patients) throw new Error("staff cannot read the patient's profile after check-in");
  return `staff see it (${row.checkin_type}), and can read the patient's profile`;
});

await step("0.5 check-in: my_checkin_status, then cancel_my_checkin", async () => {
  if (!checkedIn) return skip("not checked in");
  const list = must(await supabase.rpc("my_checkin_status", { p_patient_id: patient.id })) ?? [];
  const mine = list.find((c) => c.checkin_id === checkedIn.checkin_id);
  if (!mine) throw new Error("today's check-in is not in my_checkin_status");
  for (const k of ["hospital_name", "queue_number", "status", "ahead", "doctor_name", "checkin_time"]) if (!(k in mine)) throw new Error(`missing ${k}`);
  must(await supabase.rpc("cancel_my_checkin", { p_checkin_id: checkedIn.checkin_id }));
  const after = must(await supabase.rpc("my_checkin_status", { p_patient_id: patient.id })) ?? [];
  if (after.some((c) => c.checkin_id === checkedIn.checkin_id)) throw new Error("the cancelled check-in is still listed");
  const twice = await supabase.rpc("cancel_my_checkin", { p_checkin_id: checkedIn.checkin_id });
  if (!twice.error) throw new Error("leaving the queue twice was accepted");
  return `${list.length} check-in(s) today; left the queue; a second leave is refused`;
});

await step("0.5 care: my_care as the test patient", async () => {
  const c = must(await supabase.rpc("my_care", { p_patient_id: patient.id }));
  if (!Array.isArray(c?.pregnancies) || !Array.isArray(c?.surgeries)) throw new Error("my_care did not return pregnancies and surgeries");
  return `${c.pregnancies.length} pregnancies, ${c.surgeries.length} procedures`;
});

await step("0.5 care: staff make an [E2E] surgery record and one care item", async () => {
  if (!staffHospitalId) return skip("no staff hospital");
  const docs = must(await staff.from("hospital_doctors").select("doctor_id, status, is_active").eq("hospital_id", staffHospitalId).limit(20)) ?? [];
  const surgeon = docs.find((d) => d.status === "active" && d.is_active !== false)?.doctor_id ?? docs[0]?.doctor_id;
  if (!surgeon) return skip("the test hospital has no doctor to name as surgeon");
  const made = await staff.from("surgery_records").insert({
    hospital_id: staffHospitalId, patient_id: patient.id, surgeon_id: surgeon, procedure_name: `[E2E] check ${E2E_NOTE.slice(-8)}`, procedure_type: "day_case",
    scheduled_date: lagosDate(7), scheduled_time: "09:00", status: "scheduled", patient_instructions: "[E2E] instructions",
  }).select("id").single();
  if (made.error) {
    if (/row-level security|permission/i.test(made.error.message)) return skip("staff may not create a surgery record for the test patient (not linked to this hospital: check-in was skipped)");
    throw made.error;
  }
  surgeryId = made.data.id;
  created.push(`surgery_records ${surgeryId} (procedure "[E2E] check …"; set to cancelled below, it cannot be deleted by the app). The patient got a "Procedure booked" notification`);
  const due = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const item = must(await staff.from("care_plan_items").insert({ source_type: "surgery", source_id: surgeryId, kind: "test", title: "[E2E] Blood test", details: "[E2E] check", due_at: due, remind: false }).select("id, hospital_id, patient_id").single());
  careItemId = item.id;
  if (item.hospital_id !== staffHospitalId || item.patient_id !== patient.id) throw new Error("the database did not fill in the hospital and patient");
  return "surgery and care item created; hospital and patient filled in by the database";
});

await step("0.5 care: the patient sees them, and ticks the item", async () => {
  if (!surgeryId || !careItemId) return skip("nothing was created");
  const c = must(await supabase.rpc("my_care", { p_patient_id: patient.id }));
  const s = (c.surgeries ?? []).find((x) => x.id === surgeryId);
  if (!s) throw new Error("the patient does not see the surgery");
  for (const k of ["procedure_name", "scheduled_date", "scheduled_time", "admit_at", "fasting_from", "consent_signed", "patient_instructions", "post_op_instructions", "items"]) if (!(k in s)) throw new Error(`missing ${k}`);
  for (const hidden of ["complications", "operative_findings", "pre_op_diagnosis", "post_op_diagnosis", "notes", "blood_loss_ml"]) if (hidden in s) throw new Error(`${hidden} must not be sent to the patient`);
  if (!(s.items ?? []).some((i) => i.id === careItemId && i.status === "open")) throw new Error("the patient does not see the care item");
  must(await supabase.rpc("set_care_item_done", { p_item_id: careItemId, p_done: true }));
  const row = must(await staff.from("care_plan_items").select("status, done_by_patient").eq("id", careItemId).single());
  if (row.status !== "done" || row.done_by_patient !== true) throw new Error("staff do not see it as done by the patient");
  const direct = await supabase.from("care_plan_items").update({ title: "changed by the patient" }).eq("id", careItemId).select("id");
  if (!direct.error && (direct.data ?? []).length) throw new Error("the patient could edit a care item directly");
  return "seen with the patient's fields only; ticked; staff see \"Done by patient\"; the patient cannot edit it";
});

await step("0.5 care: clean up (delete the item, cancel the surgery)", async () => {
  if (!surgeryId) return skip("nothing was created");
  if (careItemId) {
    must(await staff.from("care_plan_items").delete().eq("id", careItemId));
    const left = must(await staff.from("care_plan_items").select("id").eq("id", careItemId));
    if (left.length) created.push(`care_plan_items ${careItemId} ([E2E] Blood test): could NOT be deleted`);
  }
  must(await staff.from("surgery_records").update({ status: "cancelled" }).eq("id", surgeryId));
  return "item deleted; surgery set to cancelled";
});

await step("0.5 maps: bookable_hospitals near Uyo returns lat, lng and distance_km", async () => {
  const UYO = { p_lat: 5.04, p_lng: 7.91 }; // already rounded to 2 decimal places, as the app sends it
  let rows = must(await supabase.rpc("bookable_hospitals", UYO)) ?? [];
  if (!rows.length) throw new Error("no bookable hospitals");
  for (const k of ["lat", "lng", "distance_km"]) if (!(k in rows[0])) throw new Error(`bookable_hospitals has no ${k} column`);
  const notes = [`${rows.length} hospital(s), ${rows.filter((h) => h.lat != null && h.lng != null).length} with a pin`];
  let mine = staffHospitalId ? rows.find((h) => h.id === staffHospitalId) : null;
  if (mine && (mine.lat == null || mine.lng == null)) {
    // The test hospital has no pin: set one in Uyo as staff, if this account may.
    const set = await staff.from("hospitals").update({ lat: 5.0377, lng: 7.9128 }).eq("id", staffHospitalId).select("lat, lng");
    if (set.error || !(set.data ?? []).length) notes.push("the test hospital has no pin and this staff account may not set it (only a hospital admin can): set it in Settings");
    else {
      created.push(`hospitals ${staffHospitalId}: the test hospital had no map pin; set to 5.0377, 7.9128 (Uyo). Move it in Hospital Settings if that is wrong`);
      rows = must(await supabase.rpc("bookable_hospitals", UYO)) ?? [];
      mine = rows.find((h) => h.id === staffHospitalId);
    }
  }
  if (mine && mine.lat != null) {
    if (mine.distance_km == null) throw new Error("the test hospital has a pin but no distance_km");
    notes.push(`the test hospital has a pin and is ${mine.distance_km} km from the centre of Uyo`);
    const outside = await staff.from("hospitals").update({ lat: 51.5, lng: -0.12 }).eq("id", staffHospitalId).select("id");
    if (!outside.error && (outside.data ?? []).length) throw new Error("a pin outside Nigeria was accepted");
    notes.push("a pin outside Nigeria is refused");
  } else if (!mine) notes.push("the test hospital is not in the bookable list (not approved, or no plan), so its pin could not be checked");
  const unknownLast = rows.map((h) => h.distance_km == null);
  if (unknownLast.some((u, i) => u && unknownLast.slice(i + 1).some((v) => !v) && rows[i].doctors_in_specialty === rows[i + 1]?.doctors_in_specialty)) notes.push("note: a hospital without a distance is listed before one with a distance");
  return notes.join("; ");
});

await step("0.5 maps: my_visits includes the hospital's address and pin", async () => {
  const v = must(await supabase.rpc("my_visits", { p_patient_id: patient.id }));
  const one = [...(v.upcoming ?? []), ...(v.past ?? [])].find((a) => a.hospitals);
  if (!one) return "no visit with a hospital to check";
  for (const k of ["address", "city", "state", "lat", "lng"]) if (!(k in one.hospitals)) throw new Error(`a visit's hospital has no ${k}`);
  return "address, city, state, lat and lng are there";
});

await staff.auth.signOut().catch(() => {});

if (childId && !childRemoved) console.log(`NOTE  the [E2E] child ${childId} was NOT removed: remove it in the app (Me, Family) or add it to e2e/cleanup.md`);

await step("sign out", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error("sign-out failed");
  const { data } = await supabase.from("patients").select("id").limit(1);
  if ((data ?? []).length) throw new Error("data is still readable after sign-out");
  return "no data readable afterwards";
});

console.log("");
console.log(failed ? `${failed} step(s) failed.` : "All steps passed.");
if (created.length) {
  console.log("Records created (add to e2e/cleanup.md):");
  for (const c of created) console.log(`  - ${c}`);
}
process.exit(failed ? 1 : 0);
