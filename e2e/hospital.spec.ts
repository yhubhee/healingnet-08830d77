import fs from "node:fs";
import path from "node:path";
import type { Locator, Page } from "@playwright/test";
import { test, expect, visit, checkPage, db, e2e, recordCreated, RUN } from "./fixtures";
import { accounts, book, card, escapeRe, fieldAfter, toast } from "./helpers";

// The [E2E] patient this run registers; later tests use it for check-in, bills and so on.
// Desktop and mobile each register their own, so names never clash.
const suffix = () => `${RUN}${test.info().project.name === "mobile" ? "m" : "d"}`;
const P = () => ({ first: "[E2E] Ada", last: `Okafor ${suffix()}` });
const pName = () => `${P().first} ${P().last}`;
const ANY_SUCCESS = /saved|added|created|scheduled|registered|filed|success|referral/i;

test.describe("hospital", () => {
  test("dashboard numbers load", async ({ as, issues }) => {
    const page = await as("hospital");
    await visit(page, issues, "/hospital");
    await expect(page.getByRole("heading", { name: "Hospital Operations" })).toBeVisible();
    const requests = page.getByRole("link", { name: /Appointment Requests/ });
    await expect(requests).toHaveAttribute("href", "/hospital/appointments");
    await expect(requests).toContainText(/\d+/);
  });

  test("appointments page: tabs, search, date filter, sidebar badge", async ({ as, issues }) => {
    const acc = await accounts();
    const patient = await as("patient");
    const id = await book(patient, { doctor: "any", visit: "in_person", reason: e2e("Hospital spec appointments page") });

    const page = await as("hospital");
    await visit(page, issues, "/hospital/appointments");
    const c = card(page, "hospital-appointment-card", id);
    await expect(c).toBeVisible();
    await expect(c).toContainText(/Booked .* ago/);

    await page.getByLabel("Search patient name").fill(acc.patientName.split(" ")[0]);
    await expect(c).toBeVisible();
    await page.getByLabel("Search patient name").fill("zzzz-no-such-patient");
    await expect(c).toHaveCount(0);
    await page.getByLabel("Search patient name").fill("");
    await page.getByLabel("Filter by date").fill("2000-01-01");
    await expect(c).toHaveCount(0);
    await page.getByRole("button", { name: "Clear date" }).click();
    await expect(c).toBeVisible();

    for (const tab of ["Upcoming", "Past and closed", "Requests"]) {
      await page.getByRole("tab", { name: new RegExp(tab) }).click();
      await checkPage(page, issues);
    }

    // Assign without accepting keeps it a request with a doctor; then Accept appears.
    await c.getByLabel("Assign without accepting").check();
    await c.getByRole("combobox", { name: "Assign doctor" }).click();
    await page.getByRole("option", { name: new RegExp(escapeRe(acc.doctorName)) }).click();
    await toast(page, /^Assigned to/);
    await expect(c).toContainText(acc.doctorName);
    await c.getByRole("button", { name: "Accept", exact: true }).click();
    await toast(page, "Appointment accepted");

    // Upcoming: cancel asks first.
    await page.getByRole("tab", { name: /Upcoming/ }).click();
    const up = card(page, "hospital-appointment-card", id);
    await up.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("Cancel this appointment?");
    await page.getByRole("button", { name: "Yes, cancel" }).click();
    await toast(page, "Appointment cancelled");

    if ((page.viewportSize()?.width ?? 1280) >= 1024) {
      await expect(page.getByRole("link", { name: /Appointments/ }).first()).toBeVisible();
    }
  });

  test("patients: register an [E2E] patient, then search", async ({ as, issues }) => {
    const page = await as("hospital");
    await visit(page, issues, "/hospital/patients");
    await page.getByRole("button", { name: "Add Patient" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Patient" });
    await fieldAfter(dialog, "First name").fill(P().first);
    await fieldAfter(dialog, "Last name").fill(P().last);
    await fieldAfter(dialog, "Phone").fill("08031234567");
    await fieldAfter(dialog, "Gender").fill("female");
    await dialog.getByRole("button", { name: "Add Patient" }).click();
    await toast(page, "Patient added");

    const h = await db("hospital");
    const { data } = await h.from("patients").select("id").eq("first_name", P().first).eq("last_name", P().last).maybeSingle();
    recordCreated("patients", data?.id, pName());
    expect(data?.id).toBeTruthy();

    await page.locator("main").getByPlaceholder(/Search/).first().fill(P().last); // not the header search, hidden on mobile
    await expect(page.locator("main").getByText(P().last).filter({ visible: true }).first()).toBeVisible(); // cards on mobile, a table on desktop
    await checkPage(page, issues);
  });

  test("queue: check the patient in, then move them through", async ({ as, issues }) => {
    const acc = await accounts();
    const page = await as("hospital");
    await visit(page, issues, "/hospital/queue");
    await page.getByRole("button", { name: "Check In Patient" }).click();
    const dialog = page.getByRole("dialog", { name: "Check In Patient" });
    await dialog.getByPlaceholder("By name or phone...").fill(P().last);
    await dialog.getByRole("button", { name: new RegExp(escapeRe(P().last)) }).click();
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: new RegExp(escapeRe(acc.doctorName.replace(/^Dr\.\s*/, ""))) }).first().click();
    await dialog.getByRole("button", { name: "Check In" }).click();
    await toast(page, "Patient checked in");

    const h = await db("hospital");
    const { data: pt } = await h.from("patients").select("id").eq("last_name", P().last).single();
    const { data: ci } = await h.from("patient_checkins").select("id, status").eq("patient_id", pt!.id).order("created_at", { ascending: false }).limit(1).single();
    recordCreated("patient_checkins", ci?.id, `check-in for ${pName()}`);

    const row = page.locator("tr, [class*='rounded']").filter({ hasText: P().last }).first();
    await row.getByRole("button", { name: "Start" }).click();
    await expect(row.getByRole("button", { name: "Complete" })).toBeVisible();
    await row.getByRole("button", { name: "Complete" }).click();
    await expect.poll(async () => (await h.from("patient_checkins").select("status").eq("id", ci!.id).single()).data?.status).toBe("completed");
    await checkPage(page, issues);
  });

  test("EMR: add an entry", async ({ as, issues }) => {
    const page = await as("hospital");
    await visit(page, issues, "/hospital/emr");
    await page.getByRole("link", { name: "New Entry" }).click();
    await expect(page).toHaveURL(/\/hospital\/emr\/add/);
    // The default entry type uses a title and notes.
    const select = page.getByRole("combobox").first();
    if (/vitals/i.test((await select.textContent()) || "")) {
      await select.click();
      await page.getByRole("option").filter({ hasNotText: /vitals/i }).first().click();
    }
    await pickPatient(page, page.locator("form"));
    const title = e2e("EMR note");
    await fieldAfter(page, "Title").fill(title);
    await page.getByRole("button", { name: "Add Entry" }).click();
    await toast(page, "EMR entry added");
    const h = await db("hospital");
    const { data } = await h.from("emr_entries").select("id").eq("title", title).maybeSingle();
    recordCreated("emr_entries", data?.id, title);
    await checkPage(page, issues);
  });

  const addActions: { route: string; heading: RegExp | string; trigger: string; fill: (page: Page, d: Locator) => Promise<void>; table: string; note: string; submit?: string }[] = [
    {
      route: "/hospital/lab", heading: "Laboratory Management", trigger: "Order Test", table: "lab_results", note: "[E2E] lab order",
      fill: async (page, d) => { await pickPatient(page, d); await d.getByPlaceholder("Test name").first().fill("[E2E] FBC"); },
    },
    {
      route: "/hospital/pharmacy", heading: "Pharmacy", trigger: "Add Drug", table: "pharmacy_inventory", note: e2e("Test drug"),
      fill: async (_p, d) => { await fieldAfter(d, "Drug name").fill(e2e("Test drug")); await fieldAfter(d, "Quantity").fill("10"); },
    },
    {
      route: "/hospital/billing", heading: "Billing & Revenue", trigger: "Create Bill", table: "hospital_billing", note: e2e("Consultation fee"),
      fill: async (page, d) => { await pickPatient(page, d); await fieldAfter(d, "Description").fill(e2e("Consultation fee")); await fieldAfter(d, "Amount").fill("1000"); },
    },
    {
      // The page's own dialog: name, type and floor; its button isn't type="submit".
      route: "/hospital/beds", heading: "Bed Management", trigger: "Add Ward", table: "hospital_wards", note: e2e("Ward"), submit: "Add Ward",
      fill: async (_p, d) => { await fieldAfter(d, "Ward Name").fill(e2e("Ward")); },
    },
    {
      route: "/hospital/maternity", heading: "Maternity", trigger: "Register ANC", table: "anc_records", note: "[E2E] ANC record for the run's [E2E] patient",
      fill: async (page, d) => { await pickPatient(page, d); await fieldAfter(d, "LMP Date").fill(isoDaysAgo(60)); },
    },
    {
      route: "/hospital/surgery", heading: "Surgery", trigger: "Schedule", table: "surgery_records", note: e2e("Appendicectomy"),
      fill: async (page, d) => {
        await pickPatient(page, d);
        await fieldAfter(d, "Procedure").fill(e2e("Appendicectomy"));
        await fieldAfter(d, "Date").fill(isoDaysAgo(-30));
        await fieldAfter(d, "Time").fill("10:00");
        // Surgeon is required: first check the message, then pick the test doctor.
        await d.locator('button[type="submit"]').click();
        await toast(page, "Please select a surgeon");
        const acc = await accounts();
        await d.locator(`xpath=.//label[starts-with(normalize-space(), "Surgeon")]/following::*[@role="combobox"][1]`).first().click();
        await page.getByRole("option", { name: new RegExp(escapeRe(acc.doctorName)) }).first().click();
      },
    },
    {
      route: "/hospital/referrals", heading: "Referrals", trigger: "New Referral", table: "hospital_referrals", note: e2e("Referral reason"),
      fill: async (page, d) => { await pickPatient(page, d); await fieldAfter(d, "Reason").fill(e2e("Referral reason")); },
    },
    {
      route: "/hospital/insurance", heading: "Insurance & HMO", trigger: "File Claim", table: "insurance_claims", note: e2e("Test HMO"),
      fill: async (page, d) => {
        await pickPatient(page, d);
        await fieldAfter(d, "Insurance Provider").fill(e2e("Test HMO"));
        await fieldAfter(d, "Claim Amount").fill("5000");
        await fieldAfter(d, "Claim Date").fill(isoDaysAgo(0));
      },
    },
  ];

  for (const a of addActions) {
    test(`${a.route}: page loads and "${a.trigger}" works`, async ({ as, issues }) => {
      const page = await as("hospital");
      await visit(page, issues, a.route);
      await expect(page.getByRole("heading", { name: a.heading }).first()).toBeVisible();
      await page.getByRole("button", { name: a.trigger }).first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await a.fill(page, dialog);
      await (a.submit ? dialog.getByRole("button", { name: a.submit }) : dialog.locator('button[type="submit"]')).click();
      await toast(page, ANY_SUCCESS);
      await expect(dialog).toBeHidden();
      recordCreated(a.table, null, `${a.note} (find by the [E2E] text and run ${RUN})`);
      await checkPage(page, issues);
    });
  }

  test("doctors: list, pending acceptance, edit", async ({ as, issues }) => {
    const acc = await accounts();
    const page = await as("hospital");
    await visit(page, issues, "/hospital/doctors");
    await expect(page.getByRole("heading", { name: "Doctor Management" })).toBeVisible();
    const docCard = page.locator(".bg-card").filter({ hasText: acc.doctorName }).first();
    await expect(docCard).toContainText(/Active|Pending acceptance/);
    // Status labels render for every doctor (pending ones say "Pending acceptance").
    await expect(page.getByText(/Active|Pending acceptance|Inactive|Declined/).first()).toBeVisible();

    await docCard.getByRole("button", { name: "Edit" }).click();
    const dialog = page.getByRole("dialog");
    const notes = dialog.locator("#edit-notes");
    const original = await notes.inputValue();
    await notes.fill(`${original}`.trim() ? original : "");
    await dialog.locator('button[type="submit"]').click();
    await toast(page, "Doctor updated successfully");
    await checkPage(page, issues);
  });

  test("staff: invite an [E2E] email, see the seat count, cancel the invite", async ({ as, issues }) => {
    const page = await as("hospital");
    await visit(page, issues, "/hospital/settings");
    await page.getByRole("tab", { name: "Staff" }).click();
    await expect(page.getByText(/\d+ of 25 team seats used|unlimited team members/)).toBeVisible();

    const email = `e2e+${suffix()}@example.com`;
    await page.getByRole("button", { name: "Invite Staff" }).click();
    const dialog = page.getByRole("dialog", { name: "Invite Staff" });
    await fieldAfter(dialog, "First name").fill("[E2E] Staff");
    await fieldAfter(dialog, "Last name").fill(suffix());
    await fieldAfter(dialog, "Email").fill(email);
    await dialog.getByRole("button", { name: "Send Invite" }).click();
    await toast(page, "Invite saved");
    recordCreated("staff_invites", null, `${email} (cancelled by the test)`);

    const row = page.locator("tr, div").filter({ hasText: email }).last();
    await row.getByRole("button", { name: "Cancel invite" }).click();
    await expect(page.getByText(email)).toHaveCount(0);
    await checkPage(page, issues);
  });

  for (const route of ["/hospital/marketplace", "/hospital/consultations", "/hospital/notifications"]) {
    test(`page loads: ${route}`, async ({ as, issues }) => {
      const page = await as("hospital");
      await visit(page, issues, route);
      await expect(page.locator("h1").first()).toBeVisible();
    });
  }

  test("settings: general, subscription and notifications tabs", async ({ as, issues }) => {
    const page = await as("hospital");
    await visit(page, issues, "/hospital/settings");
    for (const tab of ["Subscription", "Notifications", "General"]) {
      await page.getByRole("tab", { name: tab }).click();
      await checkPage(page, issues);
    }
  });

  test("link a patient with their share code", async ({ as, issues }) => {
    const page = await as("hospital");
    const code = await freshShareCode();
    await visit(page, issues, "/hospital/patients");
    await page.getByRole("button", { name: "Add Patient" }).click();
    const dialog = page.getByRole("dialog", { name: "Add Patient" });
    await dialog.getByRole("button", { name: /Enter their code/ }).click();
    await dialog.getByPlaceholder("Code from the patient's app").fill(code);
    await dialog.getByRole("button", { name: "Link patient" }).click();
    await toast(page, "Patient linked to your hospital");
  });
});

/** Picks the run's [E2E] patient in a dialog: a dropdown or a search box. */
async function pickPatient(page: Page, scope: Locator) {
  const search = scope.getByPlaceholder("Search by name or phone...");
  if (await search.isVisible().catch(() => false)) {
    await search.fill(P().last);
    await scope.getByRole("button", { name: new RegExp(escapeRe(P().last)) }).first().click();
    return;
  }
  const combo = scope.locator(`xpath=.//label[starts-with(normalize-space(), "Patient")]/following::*[@role="combobox"][1]`).first();
  await combo.click();
  await page.getByRole("option", { name: new RegExp(escapeRe(P().last)) }).first().click();
}

/** The code the patient spec created, if still fresh; otherwise one made exactly as the patient app does. */
async function freshShareCode(): Promise<string> {
  const file = path.join("e2e", "results", "share-code.json");
  if (fs.existsSync(file)) {
    const { code, at, used } = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!used && Date.now() - at < 10 * 60_000) {
      fs.writeFileSync(file, JSON.stringify({ code, at, used: true }));
      return code;
    }
  }
  const p = await db("patient");
  const { data, error } = await p.rpc("create_patient_share_code");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  recordCreated("patient_share_codes", row.code, "share code created for the hospital link test");
  return row.code;
}

function isoDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
