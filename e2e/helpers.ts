import fs from "node:fs";
import path from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import { db, recordCreated, RUN } from "./fixtures";

// ---------------------------------------------------------------------------
// Who the test accounts are (read as each user, through RLS).
// ---------------------------------------------------------------------------
let ctxCache: Promise<{ hospitalId: string; hospitalName: string; doctorId: string; doctorName: string; doctorLast: string; patientId: string; patientName: string }> | null = null;
export function accounts() {
  ctxCache ??= (async () => {
    const h = await db("hospital");
    const { data: ids, error: e1 } = await h.rpc("my_hospital_ids");
    if (e1) throw e1;
    const hospitalId = (ids as any[]).find((r) => r.membership === "staff")?.hospital_id;
    if (!hospitalId) throw new Error("The hospital test account is not staff at any hospital");
    const { data: hosp, error: e2 } = await h.from("hospitals").select("name").eq("id", hospitalId).single();
    if (e2) throw e2;

    const d = await db("doctor");
    const { data: doc, error: e3 } = await d.from("my_doctor_profile").select("id, first_name, last_name").single();
    if (e3) throw e3;

    const p = await db("patient");
    const { data: { user } } = await p.auth.getUser();
    const { data: pat, error: e4 } = await p.from("patients").select("id, first_name, last_name").eq("user_id", user!.id).single();
    if (e4) throw e4;

    return {
      hospitalId, hospitalName: hosp.name as string,
      doctorId: doc.id as string, doctorName: `Dr. ${doc.first_name} ${doc.last_name}`, doctorLast: doc.last_name as string,
      patientId: pat.id as string, patientName: `${pat.first_name} ${pat.last_name}`,
    };
  })();
  return ctxCache;
}

// ---------------------------------------------------------------------------
// Booking dates: far enough ahead to be free, different on every run and booking.
// ---------------------------------------------------------------------------
const COUNTER = path.join("e2e", "results", `booking-counter-${RUN}.txt`);
function nextBookingIndex() {
  fs.mkdirSync(path.dirname(COUNTER), { recursive: true });
  const n = fs.existsSync(COUNTER) ? Number(fs.readFileSync(COUNTER, "utf8")) + 1 : 0;
  fs.writeFileSync(COUNTER, String(n));
  return n;
}
function runOffset() {
  let h = 0;
  for (const c of RUN) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 30 + (h % 120);
}
function lagosToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
/** "15:00:00" → "3:00 pm", as the booking time buttons show it. */
function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export type BookOptions = {
  doctor: "any" | "test"; visit: "in_person" | "video"; reason: string;
  /** The booking flow is already open (after triage). */
  inPlace?: boolean;
};

/** Books through the real flow and returns the new appointment's id. */
export async function book(page: Page, opts: BookOptions): Promise<string> {
  const acc = await accounts();
  if (!opts.inPlace) await page.goto("/patient/book");
  await page.getByLabel("Search hospitals").fill(acc.hospitalName);
  await page.getByRole("button", { name: new RegExp(escapeRe(acc.hospitalName)) }).first().click();

  await expect(page.getByRole("heading", { name: "Choose a doctor" })).toBeVisible();
  if (opts.doctor === "any") await page.getByRole("button", { name: /Any available doctor/ }).click();
  else await page.getByRole("button", { name: new RegExp(escapeRe(acc.doctorName)) }).first().click();

  await expect(page.getByRole("heading", { name: "How would you like to be seen?" })).toBeVisible();
  await page.getByRole("button", { name: opts.visit === "video" ? /^Video/ : /^In person/ }).click();

  await expect(page.getByRole("heading", { name: "Choose a date and time" })).toBeVisible();
  const index = nextBookingIndex();
  const start = addDays(lagosToday(), runOffset() + index);
  const times = page.getByRole("group", { name: "Times" });
  // The picker can't see other patients' bookings, so skip times the test doctor already
  // holds (bookings left by earlier runs); "any doctor" bookings are later given to them too.
  const d = await db("doctor");
  let picked = false;
  for (let k = 0; k < 14 && !picked; k++) {
    const date = addDays(start, k);
    await page.locator("#book-date").fill(date);
    if (!(await times.isVisible().catch(() => false))) continue;
    const { data: held } = await d.from("patient_appointments").select("requested_time")
      .eq("doctor_id", acc.doctorId).eq("requested_date", date).in("status", ["pending", "accepted"]);
    const taken = new Set((held ?? []).map((r: any) => fmt12(String(r.requested_time))));
    const free = [];
    for (const b of await times.locator("button:not([disabled])").all()) {
      if (!taken.has((await b.innerText()).trim())) free.push(b);
    }
    if (free.length > 0) {
      await free[(index * 7 + Number.parseInt(RUN, 36)) % free.length].click();
      picked = true;
    }
  }
  expect(picked, "found a free date and time").toBe(true);
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel(/Reason for the visit/).fill(opts.reason);
  await page.getByRole("button", { name: "Book appointment" }).click();
  await expect(page).toHaveURL(/\/patient\/appointments/);

  const p = await db("patient");
  const { data, error } = await p.from("patient_appointments").select("id").eq("reason", opts.reason).maybeSingle();
  if (error) throw error;
  recordCreated("patient_appointments", data?.id, opts.reason);
  expect(data?.id, "the booking was saved").toBeTruthy();
  return data!.id as string;
}

export async function appointmentRow(id: string, role: "patient" | "doctor" | "hospital" = "hospital") {
  const c = await db(role);
  const { data, error } = await c.from("patient_appointments").select("id, status, doctor_id, decline_reason, is_telemedicine").eq("id", id).single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Locators
// ---------------------------------------------------------------------------
export const card = (page: Page, testId: string, id: string): Locator =>
  page.locator(`[data-testid="${testId}"][data-appointment-id="${id}"]`);

/** The input after a <label> that isn't tied to it with htmlFor. */
export const fieldAfter = (scope: Page | Locator, label: string): Locator =>
  scope.locator(`xpath=.//label[starts-with(normalize-space(), "${label}")]/following::*[self::input or self::textarea][1]`).first();

export function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Waits for a toast with this text. */
export async function toast(page: Page, text: string | RegExp) {
  // sonner toasts, and the Radix toaster that the hospital dialogs use.
  await expect(page.locator("[data-sonner-toast], li[role='status']").filter({ hasText: text }).first()).toBeVisible();
}
