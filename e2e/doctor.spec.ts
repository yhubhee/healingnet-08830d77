import type { Page } from "@playwright/test";
import { test, expect, visit, checkPage, db, e2e, recordCreated } from "./fixtures";
import { accounts, appointmentRow, book, card, escapeRe, fieldAfter, toast } from "./helpers";

test.describe("doctor", () => {
  test("dashboard", async ({ as, issues }) => {
    const page = await as("doctor");
    await visit(page, issues, "/doctor");
    await expect(page.getByRole("heading", { name: /Welcome/ })).toBeVisible();
    await expect(page.getByText("Pending Appointments")).toBeVisible();
    await expect(page.getByText(/\d+ Open requests/)).toBeVisible();
  });

  test("verification page shows the approved state", async ({ as, issues }) => {
    const page = await as("doctor");
    await visit(page, issues, "/doctor/verification");
    await expect(page.getByText(/✓ Verified on/)).toBeVisible();
  });

  test("onboarding is complete", async ({ as, issues }) => {
    const page = await as("doctor");
    await visit(page, issues, "/doctor/onboarding");
    await expect(page.getByRole("heading", { name: "Your profile is complete" })).toBeVisible();
  });

  test("My hospitals lists the test hospital", async ({ as, issues }) => {
    const acc = await accounts();
    const page = await as("doctor");
    await visit(page, issues, "/doctor/hospitals");
    await expect(page.getByRole("heading", { name: "My hospitals" })).toBeVisible();
    await expect(page.getByRole("heading", { name: acc.hospitalName })).toBeVisible();
  });

  test("availability: save and reload", async ({ as, issues }) => {
    const page = await as("doctor");
    await visit(page, issues, "/doctor/settings");
    // Save the schedule as it is (changing it would move other tests' slots), then check it persisted.
    const before = await scheduleSnapshot(page);
    await page.getByRole("button", { name: "Save changes" }).click();
    await toast(page, "Settings saved");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(await scheduleSnapshot(page)).toEqual(before);
    await checkPage(page, issues);
  });

  test("appointments: take an open request, accept one, decline one", async ({ as, issues }) => {
    test.setTimeout(180_000);
    const acc = await accounts();
    const patient = await as("patient");
    const openId = await book(patient, { doctor: "any", visit: "in_person", reason: e2e("Doctor spec open request") });
    const acceptId = await book(patient, { doctor: "test", visit: "in_person", reason: e2e("Doctor spec accept") });
    const declineId = await book(patient, { doctor: "test", visit: "in_person", reason: e2e("Doctor spec decline") });

    const page = await as("doctor");
    await visit(page, issues, "/doctor/appointments");

    await card(page, "open-request-card", openId).getByRole("button", { name: "Take this appointment" }).click();
    await toast(page, "Added to your appointments");
    await expect(card(page, "open-request-card", openId)).toHaveCount(0);
    expect(await appointmentRow(openId, "doctor")).toMatchObject({ status: "accepted", doctor_id: acc.doctorId });

    await card(page, "doctor-appointment-card", acceptId).getByRole("button", { name: "Accept", exact: true }).click();
    await toast(page, "Appointment accepted");
    expect((await appointmentRow(acceptId, "doctor")).status).toBe("accepted");

    await card(page, "doctor-appointment-card", declineId).getByRole("button", { name: "Decline", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Decline appointment" });
    await dialog.getByLabel("Reason").fill(e2e("Fully booked that day"));
    await dialog.getByRole("button", { name: "Decline", exact: true }).click();
    await toast(page, "Appointment declined");
    expect(await appointmentRow(declineId, "doctor")).toMatchObject({ status: "rejected" });
    await checkPage(page, issues);
  });

  test("consultation: history, examination, diagnosis, lab request, prescription, submit", async ({ as, issues }) => {
    test.setTimeout(240_000);
    const patient = await as("patient");
    const id = await book(patient, { doctor: "test", visit: "in_person", reason: e2e("Doctor spec consultation") });

    const page = await as("doctor");
    await page.goto("/doctor/appointments");
    const c = card(page, "doctor-appointment-card", id);
    await c.getByRole("button", { name: "Accept", exact: true }).click();
    await toast(page, "Appointment accepted");
    await c.getByRole("button", { name: /Start consultation/ }).click();
    await expect(page).toHaveURL(/\/doctor\/consultation\//);
    const consultationId = page.url().split("/doctor/consultation/")[1]?.split(/[?#]/)[0];
    recordCreated("consultations", consultationId, `for appointment ${id}`);
    await checkPage(page, issues);

    // History
    const history = section(page, "History");
    if (await history.getByRole("button", { name: "Edit" }).isVisible().catch(() => false)) await history.getByRole("button", { name: "Edit" }).click();
    await history.getByPlaceholder("Type a complaint and press Enter").fill("[E2E] headache");
    await history.getByPlaceholder("Type a complaint and press Enter").press("Enter");
    await history.getByRole("button", { name: "Save" }).click();
    await toast(page, "History saved");

    // Examination
    const exam = section(page, "Examination");
    await fieldAfter(exam, "General examination").fill("[E2E] Alert, not pale, not febrile");
    await exam.getByRole("button", { name: "Save" }).click();
    await toast(page, "Examination saved");

    // Lab request
    await page.getByRole("button", { name: "Add Lab" }).click();
    const picker = page.getByRole("dialog");
    await picker.getByPlaceholder(/Search by name or alias/).fill("FBC");
    // The list loads after the dialog opens; until then the only checkbox is "Fasting required".
    await picker.getByRole("listitem").filter({ hasText: "Full Blood Count (FBC)" }).getByRole("checkbox").check();
    await picker.getByRole("button", { name: "Send order" }).click();
    await expect(picker).toBeHidden();

    // Prescription
    await page.getByRole("button", { name: "Add Drugs" }).click();
    const rx = page.getByRole("dialog", { name: "Add treatment line" });
    await rx.getByPlaceholder("Search pharmacy or type a name").fill("[E2E] Paracetamol");
    await rx.getByPlaceholder("100 mg").fill("500 mg");
    await rx.getByPlaceholder("1 tab").fill("2 tabs");
    await fieldAfter(rx, "Duration").fill("3");
    await rx.getByRole("button", { name: "Add line" }).click();
    await expect(rx).toBeHidden();
    await expect(page.getByText("[E2E] Paracetamol")).toBeVisible();

    // Diagnosis (autosaves)
    await fieldAfter(section(page, "Diagnosis & plan"), "Provisional diagnosis").fill("[E2E] Tension headache");
    await expect(page.getByText(/^Saved \d|All changes saved/)).toBeVisible({ timeout: 20_000 });

    // On mobile the toasts sit over the Submit bar (BUGS.md #23), and they don't close while
    // the pointer rests on them; move it away and let them go, as a person would.
    await page.mouse.move(0, 0);
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
    await page.getByRole("button", { name: "Submit consultation" }).click();
    const confirm = page.getByRole("alertdialog");
    await confirm.getByRole("button", { name: "Submit" }).click();
    await toast(page, /Consultation submitted/);

    const d = await db("doctor");
    const { data } = await d.from("consultations").select("submitted_at, provisional_diagnosis").eq("id", consultationId!).single();
    expect(data?.submitted_at).toBeTruthy();
    expect(data?.provisional_diagnosis).toBe("[E2E] Tension headache");
  });

  test("refer a patient from an accepted appointment", async ({ as, issues }) => {
    test.setTimeout(180_000);
    const patient = await as("patient");
    const id = await book(patient, { doctor: "test", visit: "in_person", reason: e2e("Doctor spec referral") });

    const page = await as("doctor");
    await page.goto("/doctor/appointments");
    const c = card(page, "doctor-appointment-card", id);
    await c.getByRole("button", { name: "Accept", exact: true }).click();
    await toast(page, "Appointment accepted");
    await c.getByRole("button", { name: /Doctor spec referral/ }).click();
    await page.getByRole("button", { name: "Refer", exact: true }).click();

    const dialog = page.getByRole("dialog", { name: "Create Patient Referral" });
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option", { name: /External/ }).click();
    await dialog.getByPlaceholder("Enter hospital name").fill(e2e("Referral hospital"));
    const reason = e2e("Doctor referral reason");
    await dialog.getByPlaceholder("Describe why the patient needs referral").fill(reason);
    await dialog.getByRole("button", { name: "Create Referral" }).click();
    await toast(page, "Referral created successfully");

    const d = await db("doctor");
    const { data } = await d.from("hospital_referrals").select("id, referral_type").eq("reason", reason).maybeSingle();
    recordCreated("hospital_referrals", (data as any)?.id, reason);
    expect(data).toMatchObject({ referral_type: "external_outgoing" });
    await checkPage(page, issues);
  });

  test("patient detail and issue a letter", async ({ as, issues }) => {
    const acc = await accounts();
    const page = await as("doctor");
    await visit(page, issues, `/doctor/patients/${acc.patientId}`);
    await expect(page.getByRole("heading", { name: new RegExp(escapeRe(acc.patientName)) })).toBeVisible();
    for (const tab of ["Triage", "History", "EMR", "Prescriptions", "Labs", "Overview"]) {
      await page.getByRole("tab", { name: tab }).click();
      await checkPage(page, issues);
    }

    await page.getByRole("button", { name: "Letter" }).click();
    const dialog = page.getByRole("dialog", { name: "Issue medical letter" });
    await dialog.getByRole("combobox").first().click();
    await page.getByRole("option").first().click();
    const title = e2e("Fitness letter");
    await dialog.getByPlaceholder("Defaults to letter type").fill(title);
    await dialog.getByPlaceholder("To whom it may concern, ...").fill("[E2E] This is a test letter. Please ignore.");
    await dialog.getByRole("button", { name: "Issue letter" }).click();
    await toast(page, "Letter issued");

    const d = await db("doctor");
    const { data } = await d.from("patient_letters").select("id").eq("title", title).maybeSingle();
    recordCreated("patient_letters", (data as any)?.id, title);
    expect((data as any)?.id).toBeTruthy();
  });

  test("notifications", async ({ as, issues }) => {
    const page = await as("doctor");
    await visit(page, issues, "/doctor/notifications");
    await expect(page.getByRole("heading", { name: /Notifications/ }).first()).toBeVisible();
  });
});

const section = (page: Page, title: string) =>
  page.locator("section").filter({ has: page.getByRole("heading", { name: title, exact: true }) }).first();

async function scheduleSnapshot(page: Page) {
  return page.locator('input[type="time"], [role="switch"]').evaluateAll((els) =>
    els.map((e) => (e instanceof HTMLInputElement ? e.value : e.getAttribute("aria-checked"))));
}
