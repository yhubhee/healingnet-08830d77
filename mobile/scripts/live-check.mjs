// Runs the app's main data calls against the live project as the test patient from the
// repo's .env.test (E2E_PATIENT_*). It checks the calls the screens make; it does not
// drive the app's screens. Prints only step names and counts: never names, health data,
// tokens or the test login.
//
//   cd mobile && node scripts/live-check.mjs
//
// It books one "[E2E]" appointment and cancels it, sends one "[E2E]" message, saves one
// "[E2E]" triage session and (when a completed "[E2E]" visit exists) rates it; what it
// created is printed for e2e/cleanup.md. The allergies field is changed and put back.
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
    .select("id, created_at, status, notes, hospitals(name), lab_result_tests(id, test_name, category_name, lab_result_parameters(id, parameter_name, result_value, unit_snapshot, ref_range_snapshot, flag, sort_order))")
    .eq("patient_id", patient.id).order("created_at", { ascending: false }));
  const params = rows.flatMap((r) => (r.lab_result_tests ?? []).flatMap((t) => t.lab_result_parameters ?? []));
  return `${rows.length} results, ${params.length} values, ${params.filter((x) => ["low", "high", "abnormal"].includes(x.flag)).length} flagged outside the range`;
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
  return `${rows.length} messages in ${others.length} conversations; one [E2E] message sent`;
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
