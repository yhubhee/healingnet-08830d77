// Runs the app's main data calls against the live project as the test patient from the
// repo's .env.test (E2E_PATIENT_*). It checks the calls the screens make; it does not
// drive the app's screens. Prints only step names and counts: never names, health data,
// tokens or the test login.
//
//   cd mobile && node scripts/live-check.mjs
//
// It books one "[E2E]" appointment and cancels it; the id is printed for e2e/cleanup.md.
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
  must(await supabase.rpc("register_push_device", { p_token: token, p_platform: "android", p_app_version: "0.1.0" }));
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
