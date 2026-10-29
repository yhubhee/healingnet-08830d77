import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { test, expect, visit, checkPage, db, e2e, recordCreated, watchPage } from "./fixtures";
import { creds } from "./env";
import { book, toast } from "./helpers";

// A 1×1 PNG, small enough for any upload limit.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test.describe("patient", () => {
  test("complete profile: validation messages and phone format", async ({ as, issues }) => {
    const page = await as("patient");
    await visit(page, issues, "/patient/complete-profile");
    const phone = page.getByLabel("Phone number *");
    const original = await phone.inputValue();

    await phone.fill("");
    await page.getByRole("button", { name: /Save/ }).click();
    await expect(page.getByText("Enter your phone number.")).toBeVisible();

    await phone.fill("12345");
    await expect(page.getByText(/Enter a Nigerian number/).first()).toBeVisible();

    await phone.fill(original || "0803 123 4567");
    await expect(page.locator("#phone-error")).toHaveCount(0);
    // Saving the unchanged details proves the form submits without touching real data.
    await page.getByRole("button", { name: /Save/ }).click();
    await toast(page, /Profile (saved|complete)/);
  });

  test("dashboard loads", async ({ as, issues }) => {
    const page = await as("patient");
    await visit(page, issues, "/patient");
    await expect(page.getByRole("heading", { name: /Welcome back/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Share my records with a hospital" })).toBeVisible();
  });

  test("triage: ?complaint= pre-fills the first box", async ({ as, issues }) => {
    const page = await as("patient");
    await visit(page, issues, "/patient/triage?complaint=Headache%20for%20three%20days");
    await expect(page.getByRole("textbox").first()).toHaveValue("Headache for three days");
  });

  test("triage: complete a run, see the recommendation, book from the result", async ({ as, issues }) => {
    test.setTimeout(180_000);
    const page = await as("patient");
    await visit(page, issues, "/patient/triage");
    await runTriage(page, "[E2E] Headache and mild fever for two days, no vomiting");

    await expect(page.getByText("Recommended specialty:")).toBeVisible();
    await checkPage(page, issues);
    await page.getByRole("button", { name: /Continue to doctor selection/ }).click();
    await expect(page.getByRole("heading", { name: "Choose a hospital" })).toBeVisible();

    const reason = e2e("Booked from triage");
    const id = await book(page, { doctor: "any", visit: "in_person", reason, inPlace: true });
    expect(id).toBeTruthy();
  });

  test("appointments list", async ({ as, issues }) => {
    const page = await as("patient");
    await visit(page, issues, "/patient/appointments");
    await expect(page.getByRole("heading", { name: "Appointments" })).toBeVisible();
    for (const tab of ["Past", "Cancelled and declined", "Upcoming"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      await checkPage(page, issues);
    }
  });

  for (const [route, heading] of [
    ["/patient/prescriptions", "Prescriptions"],
    ["/patient/lab-results", "Lab Results"],
    ["/patient/medical-records", "Medical Records"],
    ["/patient/letters", /My Letters/],
    ["/patient/notifications", /Notifications/],
    ["/patient/settings", "Settings"],
    ["/patient/profile", /Profile|Share my records/],
  ] as const) {
    test(`page loads: ${route}`, async ({ as, issues }) => {
      const page = await as("patient");
      await visit(page, issues, route);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
    });
  }

  test("messages", async ({ as, issues }) => {
    const page = await as("patient");
    await visit(page, issues, "/patient/messages");
    await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
  });

  test("share code: create one and see the countdown", async ({ as, issues }) => {
    const page = await as("patient");
    await visit(page, issues, "/patient");
    await page.getByRole("button", { name: /Get a (new )?code/ }).click();
    const countdown = page.getByText(/Expires in \d+:\d\d/);
    await expect(countdown).toBeVisible();
    const first = await countdown.textContent();
    await expect.poll(async () => countdown.textContent(), { timeout: 5_000 }).not.toBe(first);

    // Hand the code to the hospital test (it is single-use and expires in 15 minutes).
    const code = (await page.locator(".font-mono.tracking-\\[0\\.3em\\]").textContent())?.trim();
    expect(code).toMatch(/^\w{4,}$/);
    fs.mkdirSync(path.join("e2e", "results"), { recursive: true });
    fs.writeFileSync(path.join("e2e", "results", "share-code.json"), JSON.stringify({ code, at: Date.now() }));
    recordCreated("patient_share_codes", code, "share code shown to the patient (single use, 15 min)");
  });

  test("notifications bell and account menu", async ({ as, issues }) => {
    const page = await as("patient");
    await visit(page, issues, "/patient");
    await page.getByRole("button", { name: /^Notifications/ }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByText("Sign out")).toBeVisible();
    await checkPage(page, issues);
    await page.keyboard.press("Escape");
  });

  test("avatar upload", async ({ as, issues }) => {
    const page = await as("patient");
    await visit(page, issues, "/patient/complete-profile");
    await page.locator('input[type="file"]').first().setInputFiles({ name: "e2e-avatar.png", mimeType: "image/png", buffer: PNG });
    await toast(page, "Photo saved");
    const p = await db("patient");
    const { data: { user } } = await p.auth.getUser();
    const { data } = await p.from("patients").select("id, profile_image_url").eq("user_id", user!.id).single();
    expect(data?.profile_image_url).toBeTruthy();
    recordCreated("storage.objects (avatars)", data?.profile_image_url, "[E2E] test avatar uploaded for the test patient");
  });

  test("sign out", async ({ browser, issues }, testInfo) => {
    // Sign out of a session of its own: signing out revokes the session on the server,
    // and every later test (and the mobile project) reuses the saved one.
    const { viewport, hasTouch, baseURL, timezoneId } = testInfo.project.use;
    const ctx = await browser.newContext({ viewport, hasTouch, baseURL, timezoneId });
    const page = await ctx.newPage();
    watchPage(page, issues);
    const { email, password } = creds("patient");
    await page.goto("/login");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(/\/patient/, { timeout: 30_000 });
    // The app signs out of every device (Supabase's default). Keep it to this browser
    // so the saved test sessions stay valid for the rest of the run.
    await page.route("**/auth/v1/logout**", (route) =>
      route.continue({ url: route.request().url().replace("scope=global", "scope=local") }));
    await visit(page, issues, "/patient");
    await page.getByRole("button", { name: "Account menu" }).click();
    await page.getByText("Sign out").click();
    await expect(page).toHaveURL(/\/$/);
    await page.goto("/patient");
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });
});

/** Answers the triage questions until a recommendation shows. */
async function runTriage(page: Page, complaint: string) {
  // The test patient's profile has age and sex, so triage starts at the symptoms step.
  await expect(page.getByText(/Step 2 of 8/)).toBeVisible({ timeout: 15_000 });
  await page.getByRole("textbox").first().fill(complaint);
  await page.getByRole("button", { name: /Start interview/ }).click();

  const done = page.getByText("Recommended specialty:");
  for (let i = 0; i < 12; i++) {
    await expect(page.getByText(/Triage assistant is checking|Analysing symptoms/)).toHaveCount(0, { timeout: 45_000 });
    if (await done.isVisible()) return;
    const radio = page.getByRole("radio").first();
    const amount = page.getByPlaceholder("e.g., 3");
    if (await radio.isVisible().catch(() => false)) {
      await radio.check();
      await page.getByRole("button", { name: "Continue" }).click();
    } else if (await amount.isVisible().catch(() => false)) {
      await amount.fill("2");
      await page.getByRole("button", { name: "Continue" }).click();
    } else if (await page.getByRole("button", { name: "No", exact: true }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "No", exact: true }).click();
    } else if (await page.getByRole("button", { name: "Continue" }).isVisible().catch(() => false)) {
      await page.getByRole("button", { name: "Continue" }).click(); // scale question
    } else {
      await page.waitForTimeout(1_000);
    }
  }
  await expect(done).toBeVisible({ timeout: 45_000 });
}
