// Pharmacy network: prescription documents, verify, dispense, send-to-pharmacy, fees,
// medicine checks, and the pharmacy / admin / hospital screens around them.
import type { Browser, Page, TestInfo } from "@playwright/test";
import { test, expect, visit, checkPage, db, e2e, recordCreated, watchPage } from "./fixtures";
import { accounts, escapeRe, fieldAfter, toast } from "./helpers";
import { creds } from "./env";

// ---------------------------------------------------------------------------
// Shared state for the cross-role chain, kept per project (desktop and mobile run
// in the same worker and each makes its own [E2E] prescriptions).
// ---------------------------------------------------------------------------
type Rx = { drug: string; code: string; docId: string; rxId: string };
type State = { rx1?: Rx; rx2?: Rx; rx3?: Rx; rx4?: Rx; requestId?: string; note3?: string; note4?: string };
const STATES: Record<string, State> = {};
const st = () => (STATES[test.info().project.name] ??= {});

async function pharmacyInfo() {
  const c = await db("pharmacy");
  const { data, error } = await c.rpc("my_pharmacy");
  if (error) throw error;
  const d = data as any;
  return {
    id: d.pharmacy.id as string, name: d.pharmacy.name as string, state: d.pharmacy.state as string, city: d.pharmacy.city as string,
    memberName: `${d.member.first_name} ${d.member.last_name}`.trim(), pcn: d.member.pcn_reg_no as string,
  };
}

/** Reads a prescription's document (id and code) as the given role. */
async function docFor(role: "doctor" | "hospital", rxId: string) {
  const c = await db(role);
  const { data, error } = await c.from("prescriptions").select("id, rx_document_id, rx_documents(code)").eq("id", rxId).single();
  if (error) throw error;
  return { docId: data.rx_document_id as string, code: (data as any).rx_documents.code as string };
}

/** Writes a prescription as the doctor through the API (what NewPrescriptionDialog sends). */
async function writeRx(drugLabel: string, refills = 0): Promise<Rx> {
  const acc = await accounts();
  const drug = e2e(drugLabel);
  const c = await db("doctor");
  const { data, error } = await c.from("prescriptions").insert({
    patient_id: acc.patientId, doctor_id: acc.doctorId, hospital_id: acc.hospitalId, drug_name: drug,
    dosage: "1 tab", frequency: "BD", duration: "5 days", instructions: "[E2E] after meals", refills_allowed: refills, status: "active",
  }).select("id").single();
  if (error) throw error;
  const d = await docFor("doctor", data.id);
  recordCreated("prescriptions", data.id, drug);
  recordCreated("rx_documents", d.docId, `${drug} (${d.code})`);
  return { drug, rxId: data.id, ...d };
}

/** A signed-out page in a fresh context, with the page checks attached. */
async function anonPage(browser: Browser, testInfo: TestInfo, issues: any[]): Promise<Page> {
  const u = testInfo.project.use;
  const ctx = await browser.newContext({ viewport: u.viewport, hasTouch: u.hasTouch, baseURL: u.baseURL, timezoneId: u.timezoneId });
  const page = await ctx.newPage();
  watchPage(page, issues);
  return page;
}

/** Drop issues a test causes on purpose (e.g. a refused call's 400), so the page checks don't flag them. */
function allowExpected(issues: { detail: string }[], re: RegExp) {
  for (let i = issues.length - 1; i >= 0; i--) if (re.test(issues[i].detail)) issues.splice(i, 1);
}

const rxCard = (page: Page, code: string) => page.locator(`[data-testid="rx-card"][data-code="${code}"]`);

async function dispenseAll(page: Page, patientName: string) {
  await page.getByLabel(`Confirm the patient's ID matches ${patientName}`).check();
  await page.getByRole("button", { name: /^Dispense \d+ medicine/ }).click();
}

async function recordDispenses(rx: Rx) {
  const c = await db("pharmacy");
  const { data } = await c.from("rx_dispenses").select("id").eq("prescription_id", rx.rxId);
  for (const r of data ?? []) recordCreated("rx_dispenses", r.id, `${rx.drug} (${rx.code})`);
}

// ---------------------------------------------------------------------------
// Cross-role flow
// ---------------------------------------------------------------------------
test.describe.serial("pharmacy network: cross-role flow", () => {
  test("doctor saves practice address and signature", async ({ as, issues }) => {
    const page = await as("doctor");
    await visit(page, issues, "/doctor/profile");
    const card = page.locator("#prescription-details");
    await expect(card.getByRole("heading", { name: "Prescription details" })).toBeVisible();

    await card.getByLabel("Practice address").fill(e2e("12 Ikot Ekpene Road, Uyo"));
    await card.getByRole("button", { name: "Save address" }).click();
    await toast(page, "Practice address saved");

    await card.getByRole("button", { name: /Add your signature|Draw a new signature/ }).click();
    const pad = card.getByTestId("signature-pad");
    await expect(pad).toBeVisible();
    // On desktop the pad opens below the fold; mouse events only land inside the viewport.
    await pad.scrollIntoViewIfNeeded();
    const box = (await pad.boundingBox())!;
    await page.mouse.move(box.x + 20, box.y + 100);
    await page.mouse.down();
    for (const [x, y] of [[60, 40], [100, 110], [140, 50], [180, 100], [230, 60]]) await page.mouse.move(box.x + x, box.y + y, { steps: 5 });
    await page.mouse.up();
    await card.getByRole("button", { name: "Save signature" }).click();
    await toast(page, "Signature saved");
    await expect(card.getByRole("img", { name: "Your saved signature" })).toBeVisible();
    await expect(card.getByText("Ready: pharmacies can accept your prescriptions")).toBeVisible();
    recordCreated("doctors (updated)", (await accounts()).doctorId, "practice_address and signature_data set by the pharmacy spec");
  });

  test("doctor writes two prescriptions (0 and 1 refill)", async ({ as, issues }) => {
    const acc = await accounts();
    const page = await as("doctor");
    await visit(page, issues, "/doctor/prescriptions");
    await expect(page.getByTestId("prescriber-not-ready")).toHaveCount(0);

    const made: Rx[] = [];
    for (const [label, refills] of [["Amoxicillin 500mg", 0], ["Lisinopril 10mg", 1]] as const) {
      const drug = e2e(label);
      await page.getByRole("button", { name: "New prescription" }).click();
      const dlg = page.getByRole("dialog", { name: "New Prescription" });
      await dlg.getByPlaceholder("Search patients...").fill(acc.patientName.split(" ")[0]);
      await dlg.getByRole("button", { name: acc.patientName, exact: true }).first().click();
      await fieldAfter(dlg, "Drug name").fill(drug);
      await fieldAfter(dlg, "Dosage").fill("1 tab");
      await fieldAfter(dlg, "Frequency").fill("BD");
      await fieldAfter(dlg, "Duration").fill("7 days");
      await fieldAfter(dlg, "Refills allowed").fill(String(refills));
      await dlg.getByRole("button", { name: "Issue prescription" }).click();
      await toast(page, "Prescription issued");
      await expect(dlg).toBeHidden();

      const c = await db("doctor");
      const { data, error } = await c.from("prescriptions").select("id").eq("drug_name", drug).single();
      if (error) throw error;
      const d = await docFor("doctor", data.id);
      recordCreated("prescriptions", data.id, drug);
      recordCreated("rx_documents", d.docId, `${drug} (${d.code})`);
      made.push({ drug, rxId: data.id, ...d });
    }
    st().rx1 = made[0];
    st().rx2 = made[1];

    // Each row shows its code and a View / print link.
    await page.getByPlaceholder("Search drug, patient or code...").fill(made[0].code);
    await expect(page.getByText(made[0].code).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "View / print" }).filter({ visible: true }).first()).toBeVisible();
    await checkPage(page, issues);
  });

  test("patient sees both with code, Valid and QR; the print page has licence and signature", async ({ as, issues }) => {
    const { rx1, rx2 } = st();
    test.skip(!rx1 || !rx2, "needs the prescriptions from the previous test");
    const page = await as("patient");
    await visit(page, issues, "/patient/prescriptions");
    for (const rx of [rx1!, rx2!]) {
      const card = rxCard(page, rx.code);
      await expect(card).toBeVisible();
      await expect(card.getByText(/^Valid until/)).toBeVisible();
      await expect(card.getByText(rx.drug)).toBeVisible();
    }
    await rxCard(page, rx1!.code).getByRole("button", { name: "Show QR" }).click();
    await expect(page.getByRole("dialog").getByTestId("rx-qr")).toBeVisible();
    await page.keyboard.press("Escape");

    const p = await db("patient");
    const { data: doc } = await p.rpc("rx_document", { p_document_id: rx1!.docId });
    const licence = (doc as any).prescriber.licence_number as string;
    await rxCard(page, rx1!.code).getByRole("link", { name: "View / print" }).click();
    await expect(page).toHaveURL(new RegExp(`/patient/prescriptions/${rx1!.docId}/print`));
    const sheet = page.getByTestId("rx-print");
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText(new RegExp(escapeRe(licence)))).toBeVisible();
    await expect(sheet.getByTestId("rx-print-signature")).toBeVisible();
    await expect(sheet.getByText(rx1!.code).first()).toBeVisible();
    await checkPage(page, issues);
  });

  test("signed out: verify shows Valid, the doctor and licence, and no drugs or patient", async ({ browser, issues }, testInfo) => {
    const { rx1 } = st();
    test.skip(!rx1, "needs the prescription");
    const acc = await accounts();
    const page = await anonPage(browser, testInfo, issues);
    await visit(page, issues, `/verify/${rx1!.code}`);
    await expect(page.getByTestId("rx-verdict")).toContainText("Valid");
    await expect(page.getByText(acc.doctorLast).first()).toBeVisible();
    const p = await db("patient");
    const { data: doc } = await p.rpc("rx_document", { p_document_id: rx1!.docId });
    await expect(page.getByText(new RegExp(escapeRe((doc as any).prescriber.licence_number))).first()).toBeVisible();
    const text = await page.locator("body").innerText();
    expect(text).not.toContain(rx1!.drug);
    expect(text).not.toContain(acc.patientName);
    await expect(page.getByRole("link", { name: "Sign in to see the medicines and dispense" })).toBeVisible();
    await page.context().close();
  });

  test("pharmacy sees the drugs and patient and dispenses; name and PCN recorded automatically", async ({ as, issues }) => {
    const { rx1 } = st();
    test.skip(!rx1, "needs the prescription");
    const acc = await accounts();
    const ph = await pharmacyInfo();
    const page = await as("pharmacy");
    await visit(page, issues, `/verify/${rx1!.code}`);
    await expect(page.getByTestId("rx-patient-name")).toHaveText(acc.patientName);
    await expect(page.getByText(rx1!.drug).first()).toBeVisible();
    await dispenseAll(page, acc.patientName);
    await expect(page.getByTestId("dispense-success")).toContainText(`Dispensed. Recorded under ${ph.memberName}, PCN ${ph.pcn}.`);
    await expect(page.getByTestId("rx-verdict")).toContainText("Already dispensed");
    await recordDispenses(rx1!);
  });

  test("patient sees Dispensed at and a notification; signed-out verify says Already dispensed", async ({ as, browser, issues }, testInfo) => {
    const { rx1 } = st();
    test.skip(!rx1, "needs the prescription");
    const ph = await pharmacyInfo();
    const page = await as("patient");
    await visit(page, issues, "/patient/prescriptions");
    const card = rxCard(page, rx1!.code);
    await expect(card.getByTestId("rx-dispensed-line")).toContainText(`Dispensed at ${ph.name} by ${ph.memberName}`);
    await expect(card.getByText("Dispensed", { exact: true })).toBeVisible();
    await visit(page, issues, "/patient/notifications");
    await expect(page.getByText(new RegExp(`${escapeRe(rx1!.code)} was dispensed at ${escapeRe(ph.name)}`))).toBeVisible();

    const anon = await anonPage(browser, testInfo, issues);
    await visit(anon, issues, `/verify/${rx1!.code}`);
    await expect(anon.getByTestId("rx-verdict")).toContainText("Already dispensed");
    await anon.context().close();
  });

  test("refills: the second prescription dispenses twice; a third attempt shows the database message", async ({ as, issues }) => {
    const { rx2 } = st();
    test.skip(!rx2, "needs the prescription");
    const acc = await accounts();
    const page = await as("pharmacy");
    await visit(page, issues, `/verify/${rx2!.code}`);
    await dispenseAll(page, acc.patientName);
    await expect(page.getByTestId("dispense-success")).toBeVisible();

    // A second screen opened now still offers the refill...
    const stale = await page.context().newPage();
    watchPage(stale, issues);
    await visit(stale, issues, `/verify/${rx2!.code}`);
    await expect(stale.getByText(`${rx2!.drug} (refill)`)).toBeVisible();

    // ...the refill is dispensed on the first screen...
    await page.reload();
    await expect(page.getByText(`${rx2!.drug} (refill)`)).toBeVisible();
    await dispenseAll(page, acc.patientName);
    await expect(page.getByTestId("dispense-success")).toBeVisible();
    await expect(page.getByTestId("rx-verdict")).toContainText("Already dispensed");

    // ...so the stale screen's third attempt is refused with the database's own message
    // (the prescription is now completed, which rx_dispense checks first).
    await dispenseAll(stale, acc.patientName);
    await expect(stale.locator("section p[role=alert]")).toHaveText(`${rx2!.drug} is completed`);
    allowExpected(issues, /rpc\/rx_dispense|status of 400/);
    await stale.close();
    await recordDispenses(rx2!);
  });

  test("send to pharmacy: reply with price, patient sees it, dispense, Done, rate, fee row", async ({ as, issues }) => {
    const acc = await accounts();
    const ph = await pharmacyInfo();
    const rx3 = (st().rx3 = await writeRx("Metformin 500mg"));
    const note = (st().note3 = e2e("I will pick up after work"));

    // Patient sends it.
    const patient = await as("patient");
    await visit(patient, issues, "/patient/prescriptions");
    await rxCard(patient, rx3.code).getByRole("button", { name: "Get it from a pharmacy" }).click();
    const dlg = patient.getByRole("dialog", { name: "Get it from a pharmacy" });
    await dlg.getByLabel("State").selectOption(ph.state);
    await dlg.getByLabel("City or town").fill(ph.city);
    await dlg.getByRole("button", { name: "Search" }).click();
    await dlg.locator("label").filter({ hasText: ph.name }).first().click();
    await dlg.getByLabel("Note for the pharmacy (optional)").fill(note);
    await dlg.getByRole("button", { name: "Send prescription" }).click();
    await toast(patient, /^Sent\./);
    const reqRow = rxCard(patient, rx3.code).getByTestId("rx-request").filter({ hasText: ph.name });
    await expect(reqRow).toContainText("Waiting for reply");

    const p = await db("patient");
    const { data: req } = await p.from("rx_pharmacy_requests").select("id").eq("rx_document_id", rx3.docId).eq("patient_note", note).single();
    st().requestId = req!.id;
    recordCreated("rx_pharmacy_requests", req!.id, note);

    // Pharmacy answers under New.
    const pharm = await as("pharmacy");
    await visit(pharm, issues, "/pharmacy/requests");
    await expect(pharm.getByRole("tab", { name: /^New/ })).toHaveAttribute("aria-selected", "true");
    await pharm.getByTestId("pharmacy-request-row").filter({ hasText: note }).click();
    await expect(pharm.getByTestId("rx-patient-name")).toHaveText(acc.patientName);
    await expect(pharm.getByText(rx3.drug).first()).toBeVisible();
    await expect(pharm.getByText(note)).toBeVisible();
    await pharm.getByLabel("Available", { exact: true }).check();
    await pharm.getByLabel(/Price the patient pays/).fill("2,500");
    await pharm.getByRole("button", { name: "In 2 hours" }).click();
    await pharm.getByLabel("Note for the patient (optional)").fill(e2e("Ready at the front counter"));
    await pharm.getByRole("button", { name: "Send reply" }).click();
    await toast(pharm, "Reply sent to the patient");
    await expect(pharm.getByTestId("request-status")).toHaveText("Available");

    // Patient sees the price.
    await patient.reload();
    await expect(reqRow).toContainText("Available");
    await expect(reqRow).toContainText("₦2,500");
    await expect(reqRow).toContainText("ready");

    // Pharmacy dispenses it: the request is collected and moves to Done.
    await pharm.getByRole("button", { name: "Dispense now" }).click();
    await dispenseAll(pharm, acc.patientName);
    await expect(pharm.getByTestId("dispense-success")).toContainText(`PCN ${ph.pcn}`);
    await expect(pharm.getByTestId("request-status")).toHaveText("Collected");
    await visit(pharm, issues, "/pharmacy/requests?tab=done");
    await expect(pharm.getByTestId("pharmacy-request-row").filter({ hasText: note })).toContainText("Collected");
    await recordDispenses(rx3);

    // Patient rates it 4 stars.
    await patient.reload();
    await expect(reqRow).toContainText("Collected");
    await reqRow.getByRole("button", { name: "Rate this pharmacy" }).click();
    const rate = patient.getByRole("dialog", { name: `Rate ${ph.name}` });
    await rate.getByRole("radio", { name: "4 stars" }).click();
    await rate.getByRole("button", { name: "Submit rating" }).click();
    await toast(patient, "Thanks for your rating");
    await expect(reqRow).toContainText("You rated 4");
    recordCreated("pharmacy_reviews", req!.id, "4-star rating (row keyed by request_id)");

    // One fee row: waived, ₦0.
    const c = await db("pharmacy");
    const { data: fee, error } = await c.from("pharmacy_fees").select("id, amount_kobo, status").eq("request_id", req!.id).single();
    if (error) throw error;
    expect(fee).toMatchObject({ amount_kobo: 0, status: "waived" });
    recordCreated("pharmacy_fees", fee.id, `fee for request ${req!.id}`);
    await visit(pharm, issues, "/pharmacy/fees");
    await expect(pharm.getByTestId("fee-rows").first()).toContainText("₦0");
    await expect(pharm.getByTestId("fee-rows").first()).toContainText("Waived");
  });

  test("cancel: the patient cancels a sent request; the pharmacy sees it under Done", async ({ as, issues }) => {
    const ph = await pharmacyInfo();
    const rx4 = (st().rx4 = await writeRx("Omeprazole 20mg"));
    const note = (st().note4 = e2e("Please hold until Friday"));
    const patient = await as("patient");
    await visit(patient, issues, "/patient/prescriptions");
    await rxCard(patient, rx4.code).getByRole("button", { name: "Get it from a pharmacy" }).click();
    const dlg = patient.getByRole("dialog", { name: "Get it from a pharmacy" });
    await dlg.getByLabel("State").selectOption(ph.state);
    await dlg.getByLabel("City or town").fill(ph.city);
    await dlg.getByRole("button", { name: "Search" }).click();
    await dlg.locator("label").filter({ hasText: ph.name }).first().click();
    await dlg.getByLabel("Note for the pharmacy (optional)").fill(note);
    await dlg.getByRole("button", { name: "Send prescription" }).click();
    await toast(patient, /^Sent\./);
    const row = rxCard(patient, rx4.code).getByTestId("rx-request").filter({ hasText: ph.name });
    await row.getByRole("button", { name: "Cancel" }).click();
    await toast(patient, "Request cancelled");
    await expect(row).toContainText("Cancelled");

    const p = await db("patient");
    const { data: req } = await p.from("rx_pharmacy_requests").select("id, status").eq("patient_note", note).single();
    expect(req!.status).toBe("cancelled");
    recordCreated("rx_pharmacy_requests", req!.id, note);

    const pharm = await as("pharmacy");
    await visit(pharm, issues, "/pharmacy/requests?tab=done");
    await expect(pharm.getByTestId("pharmacy-request-row").filter({ hasText: note })).toContainText("Cancelled");
  });

  test("medicine check: Genuine on one drug, Not found on another; the admin sees the Not found report", async ({ as, issues }) => {
    const { rx1, rx2 } = st();
    test.skip(!rx1 || !rx2, "needs the dispensed prescriptions");
    const page = await as("patient");
    await visit(page, issues, "/patient/prescriptions");
    for (const [rx, button, saved] of [[rx1!, "Genuine", "Saved: Genuine. Thank you."], [rx2!, "Not found", "Saved: Not found. Thank you."]] as const) {
      const card = rxCard(page, rx.code);
      await card.getByRole("button", { name: /^Check your medicine/ }).first().click();
      const panel = card.getByTestId("medicine-check");
      await expect(panel).toContainText("greenbook.nafdac.gov.ng");
      await panel.getByRole("button", { name: button, exact: true }).click();
      await expect(panel.getByRole("status")).toHaveText(saved);
    }
    const p = await db("patient");
    const { data: checks } = await p.from("medicine_checks").select("id, prescription_id, result").in("prescription_id", [rx1!.rxId, rx2!.rxId]);
    for (const c of checks ?? []) recordCreated("medicine_checks", c.id, `${c.result} for prescription ${c.prescription_id}`);

    const admin = await as("admin");
    await visit(admin, issues, "/admin/medicine-reports");
    const report = admin.getByTestId("medicine-reports").locator("li").filter({ hasText: rx2!.drug });
    await expect(report).toContainText("Not found");
    await expect(admin.getByTestId("medicine-reports").locator("li").filter({ hasText: rx1!.drug })).toHaveCount(0);
  });

  test("hospital record only: staff-entered prescription is not valid outside and can't be dispensed", async ({ as, issues }) => {
    const acc = await accounts();
    const drug = e2e("Ibuprofen 400mg");
    // No hospital screen writes prescriptions, so staff write it through the API, with the doctor selected.
    const h = await db("hospital");
    const { data, error } = await h.from("prescriptions").insert({
      patient_id: acc.patientId, doctor_id: acc.doctorId, hospital_id: acc.hospitalId, drug_name: drug,
      dosage: "1 tab", frequency: "TDS", duration: "3 days", refills_allowed: 0, status: "active",
    }).select("id").single();
    if (error) throw error;
    const d = await docFor("hospital", data.id);
    recordCreated("prescriptions", data.id, `${drug} (entered by hospital staff)`);
    recordCreated("rx_documents", d.docId, `${drug} (${d.code})`);

    const page = await as("pharmacy");
    await visit(page, issues, `/verify/${d.code}`);
    await expect(page.getByTestId("rx-verdict")).toContainText("Not valid outside the hospital");
    await expect(page.getByText("Hospital record only: not valid at outside pharmacies").first()).toBeVisible();
    await expect(page.getByRole("checkbox", { name: new RegExp(escapeRe(drug)) })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Nothing to dispense" })).toBeDisabled();

    // The database refuses it too.
    const c = await db("pharmacy");
    const { error: e2 } = await c.rpc("rx_dispense", { p_code: d.code, p_items: [{ prescription_id: data.id, quantity: null }] });
    expect(e2?.message).toBe(`${drug} was not written by the prescribing doctor and cannot be dispensed here`);
  });
});

// ---------------------------------------------------------------------------
// Pharmacy pages
// ---------------------------------------------------------------------------
test.describe("pharmacy pages", () => {
  test("dashboard, requests tabs, history, notifications", async ({ as, issues }) => {
    const page = await as("pharmacy");
    await visit(page, issues, "/pharmacy");
    await expect(page.getByRole("heading", { name: /^Hello/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Scan or enter a prescription code" })).toBeVisible();
    await expect(page.getByText("Open requests")).toBeVisible();

    await visit(page, issues, "/pharmacy/requests");
    for (const tab of ["Answered", "Done", "New"]) {
      await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
      await expect(page.getByRole("tab", { name: new RegExp(`^${tab}`) })).toHaveAttribute("aria-selected", "true");
      await checkPage(page, issues);
    }

    await visit(page, issues, "/pharmacy/history");
    await expect(page.getByRole("heading", { name: "Dispensing history" })).toBeVisible();

    await visit(page, issues, "/pharmacy/notifications");
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  });

  test("team: join code visible and copyable", async ({ as, issues }) => {
    const page = await as("pharmacy");
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await visit(page, issues, "/pharmacy/team");
    await expect(page.getByText("Share this code with your pharmacists")).toBeVisible();
    const code = (await page.getByTestId("join-code").innerText()).trim();
    expect(code).toMatch(/^[0-9A-Z]{8}$/);
    await page.getByRole("button", { name: "Copy" }).click();
    await toast(page, "Code copied");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(code);
  });

  test("fees page", async ({ as, issues }) => {
    const page = await as("pharmacy");
    await visit(page, issues, "/pharmacy/fees");
    await expect(page.getByRole("heading", { name: "Fees" })).toBeVisible();
  });

  test("settings: changing the PCN number warns; cancelling saves nothing", async ({ as, issues }) => {
    const page = await as("pharmacy");
    await visit(page, issues, "/pharmacy/settings");
    const pcn = page.getByLabel("PCN registration number");
    const before = await pcn.inputValue();
    await pcn.fill(`${before}9`);
    await expect(page.getByText("Changing your PCN number or licence expiry sends you back for verification.")).toBeVisible();
    await page.getByRole("button", { name: "Save your details" }).click();
    const dlg = page.getByRole("alertdialog", { name: "Send your details back for checking?" });
    await expect(dlg).toBeVisible();
    await dlg.getByRole("button", { name: "Cancel" }).click();
    await expect(dlg).toBeHidden();
    const c = await db("pharmacy");
    const { data } = await c.rpc("my_pharmacy");
    expect((data as any).member.pcn_reg_no).toBe(before);
    expect((data as any).member.can_dispense).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
test.describe("admin: pharmacy network", () => {
  test("verifications, pharmacies drawer, fee settings (billing confirm cancelled), medicine reports", async ({ as, issues }) => {
    const ph = await pharmacyInfo();
    const page = await as("admin");
    await visit(page, issues, "/admin/verifications");
    for (const t of ["Pharmacies", "Pharmacists"]) {
      await page.getByRole("tab", { name: new RegExp(`^${t}`) }).click();
      await expect(page.getByRole("tab", { name: new RegExp(`^${t}`) })).toHaveAttribute("aria-selected", "true");
      await expect(page.getByRole("tabpanel")).toBeVisible();
      await checkPage(page, issues);
    }

    await visit(page, issues, "/admin/pharmacies");
    await expect(page.getByTestId("fee-settings")).toBeVisible();
    await page.getByLabel("Search pharmacies").fill(ph.name);
    await page.getByText(ph.name, { exact: true }).filter({ visible: true }).first().click();
    const drawer = page.getByTestId("pharmacy-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Fees" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();

    const billing = page.getByRole("switch", { name: "Billing on" });
    await expect(billing).not.toBeChecked();
    await billing.click();
    const confirm = page.getByRole("alertdialog", { name: "Turn billing on?" });
    await expect(confirm).toContainText("Only turn this on after legal review.");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(confirm).toBeHidden();
    await expect(billing).not.toBeChecked();
    const a = await db("admin");
    const { data: s } = await a.rpc("admin_pharmacy_fee_settings");
    expect((s as any).billing_enabled).toBe(false);

    await visit(page, issues, "/admin/medicine-reports");
    await expect(page.getByRole("combobox", { name: "Status" })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Hospital
// ---------------------------------------------------------------------------
test.describe("hospital: stock", () => {
  test("add an [E2E] stock item with a NAFDAC number; expiring in 30 days shows the warning", async ({ as, issues }) => {
    const page = await as("hospital");
    await visit(page, issues, "/hospital/pharmacy");
    const drug = e2e("Paracetamol syrup");
    const nafdac = `A4-${Date.now().toString().slice(-6)}`;
    const expiry = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await page.getByRole("button", { name: "Add Drug" }).click();
    const dlg = page.getByRole("dialog", { name: "Add Drug to Inventory" });
    await dlg.getByLabel("Drug name").fill(drug);
    await dlg.getByLabel("Quantity").fill("10");
    await dlg.getByLabel("Expiry date").fill(expiry);
    await dlg.getByLabel("NAFDAC no.").fill(nafdac);
    await dlg.getByRole("button", { name: "Add to Inventory" }).click();
    await toast(page, "Drug added");

    const h = await db("hospital");
    const { data } = await h.from("pharmacy_inventory").select("id, nafdac_reg_no").eq("drug_name", drug).single();
    expect(data?.nafdac_reg_no).toBe(nafdac);
    recordCreated("pharmacy_inventory", data?.id, drug);

    await expect(page.getByTestId("expiry-warning")).toContainText(/\d+ items? expires? within 90 days/);
    await page.getByRole("button", { name: /^Expiring soon \(/ }).click();
    await expect(page.getByText(drug).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(nafdac).filter({ visible: true }).first()).toBeVisible();
    await checkPage(page, issues);
  });
});

// ---------------------------------------------------------------------------
// Signed out: sign-up roles, sign-in from /verify, password reset entry
// ---------------------------------------------------------------------------
test.describe("public: pharmacy sign-up and sign-in", () => {
  test("pharmacist sign-up checks the join code live; pharmacy sign-up has its fields", async ({ browser, issues }, testInfo) => {
    const c = await db("pharmacy");
    const { data } = await c.rpc("my_pharmacy");
    const code = (data as any).pharmacy.join_code as string;
    const ph = await pharmacyInfo();
    const page = await anonPage(browser, testInfo, issues);

    await visit(page, issues, "/signup?role=pharmacist");
    await page.getByLabel("Pharmacy code").fill("ZZZZZZZZ");
    await expect(page.getByText("That code doesn't match a pharmacy.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Account" })).toBeDisabled();
    await page.getByLabel("Pharmacy code").fill(code.toLowerCase());
    await expect(page.getByText(`You are joining ${ph.name}, ${ph.city}`)).toBeVisible();
    await expect(page.getByRole("button", { name: "Create Account" })).toBeEnabled();
    await page.getByLabel("Assistant (no PCN)").check();
    await expect(page.getByLabel("PCN registration number")).toHaveCount(0);

    await visit(page, issues, "/signup?role=pharmacy");
    for (const label of ["Pharmacy name", "Street address", "City or town", "State", "Premises licence number"]) {
      await expect(page.getByLabel(label)).toBeVisible();
    }
    await page.getByLabel("I am also a pharmacist").check();
    await expect(page.getByLabel("PCN registration number")).toBeVisible();
    await expect(page.getByLabel("Licence expiry")).toBeVisible();
    await page.context().close();
  });

  test("signing in from /verify/<code> comes back to the same code", async ({ browser, issues }, testInfo) => {
    const acc = await accounts();
    const rx = await writeRx("Cetirizine 10mg");
    const page = await anonPage(browser, testInfo, issues);
    await visit(page, issues, `/verify/${rx.code}`);
    await page.getByRole("link", { name: "Sign in to see the medicines and dispense" }).click();
    await expect(page).toHaveURL(/\/login\?next=/);
    const { email, password } = creds("pharmacy");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page).toHaveURL(new RegExp(`/verify/${escapeRe(rx.code)}$`));
    await expect(page.getByTestId("rx-patient-name")).toHaveText(acc.patientName);
    await page.context().close();
  });

  test("login: Forgot password? opens the reset request page", async ({ browser, issues }, testInfo) => {
    const page = await anonPage(browser, testInfo, issues);
    await visit(page, issues, "/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Forgot your password?" })).toBeVisible();
    await checkPage(page, issues);
    // A reset page opened without a valid link explains itself instead of failing on submit.
    await visit(page, issues, "/reset-password");
    await expect(page.getByRole("heading", { name: "This link doesn't work" })).toBeVisible();
    await page.context().close();
  });
});
