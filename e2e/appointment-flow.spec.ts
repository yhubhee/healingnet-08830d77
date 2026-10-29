// The bug Bhee found: "Any available doctor" requests that nobody could act on.
// Each test books its own appointment and follows it across patient, hospital and doctor.
import { test, expect, checkPage, e2e } from "./fixtures";
import { accounts, appointmentRow, book, card, toast } from "./helpers";

test.describe("appointment flow across roles", () => {
  test("1-2. any doctor, in person: hospital and doctor see it, doctor takes it, patient sees it confirmed", async ({ as, issues }) => {
    const acc = await accounts();
    const patient = await as("patient");
    const reason = e2e("Flow 1 any doctor in person");
    const id = await book(patient, { doctor: "any", visit: "in_person", reason });

    await test.step("hospital sees it under Requests", async () => {
      const hospital = await as("hospital");
      await hospital.goto("/hospital/appointments");
      await expect(hospital.getByRole("tab", { name: /Requests/ })).toHaveAttribute("aria-selected", "true");
      const c = card(hospital, "hospital-appointment-card", id);
      await expect(c).toBeVisible();
      await expect(c).toContainText("Any available doctor");
      await expect(c).toContainText("In person");
      await checkPage(hospital, issues);
    });

    const doctor = await as("doctor");
    await test.step("doctor sees it under Open requests", async () => {
      await doctor.goto("/doctor/appointments");
      const c = card(doctor, "open-request-card", id);
      await expect(c).toBeVisible();
      await expect(c).toContainText(acc.hospitalName);
      await checkPage(doctor, issues);
    });

    await test.step("doctor takes it", async () => {
      await card(doctor, "open-request-card", id).getByRole("button", { name: "Take this appointment" }).click();
      await toast(doctor, "Added to your appointments");
      await expect(card(doctor, "open-request-card", id)).toHaveCount(0);
      await expect(card(doctor, "doctor-appointment-card", id)).toContainText(/accepted/i);
      const row = await appointmentRow(id);
      expect(row.status).toBe("accepted");
      expect(row.doctor_id).toBe(acc.doctorId);
    });

    await test.step("patient sees it confirmed", async () => {
      await patient.goto("/patient/appointments");
      await expect(card(patient, "patient-appointment-card", id)).toContainText(`Confirmed with ${acc.doctorName}`);
      await checkPage(patient, issues);
    });
  });

  test("3. any doctor: hospital assigns the test doctor; doctor and patient see it", async ({ as, issues }) => {
    const acc = await accounts();
    const patient = await as("patient");
    const id = await book(patient, { doctor: "any", visit: "in_person", reason: e2e("Flow 3 hospital assigns") });

    const hospital = await as("hospital");
    await hospital.goto("/hospital/appointments");
    const c = card(hospital, "hospital-appointment-card", id);
    await c.getByRole("combobox", { name: "Assign doctor" }).click();
    await hospital.getByRole("option", { name: new RegExp(acc.doctorName.replace(/\./g, "\\.")) }).click();
    await toast(hospital, /Accepted and assigned/);
    await expect(c).toHaveCount(0); // left the Requests tab
    await hospital.getByRole("tab", { name: /Upcoming/ }).click();
    await expect(card(hospital, "hospital-appointment-card", id)).toContainText(acc.doctorName);
    await checkPage(hospital, issues);

    const row = await appointmentRow(id);
    expect(row).toMatchObject({ status: "accepted", doctor_id: acc.doctorId });

    const doctor = await as("doctor");
    await doctor.goto("/doctor/appointments");
    await expect(card(doctor, "doctor-appointment-card", id)).toContainText(/accepted/i);

    await patient.goto("/patient/appointments");
    await expect(card(patient, "patient-appointment-card", id)).toContainText(`Confirmed with ${acc.doctorName}`);
  });

  test("4. specific doctor: the doctor accepts it from their own list", async ({ as, issues }) => {
    const acc = await accounts();
    const patient = await as("patient");
    const id = await book(patient, { doctor: "test", visit: "in_person", reason: e2e("Flow 4 specific doctor") });

    await patient.goto("/patient/appointments");
    const pc = card(patient, "patient-appointment-card", id);
    await expect(pc).toContainText("Waiting for the hospital to confirm");
    await expect(pc).toContainText(acc.doctorName);

    const doctor = await as("doctor");
    await doctor.goto("/doctor/appointments");
    const dc = card(doctor, "doctor-appointment-card", id);
    await expect(dc).toContainText(/pending/i);
    await dc.getByRole("button", { name: "Accept", exact: true }).click();
    await toast(doctor, "Appointment accepted");
    await expect(dc).toContainText(/accepted/i);
    await checkPage(doctor, issues);
    expect((await appointmentRow(id)).status).toBe("accepted");

    await patient.reload();
    await expect(card(patient, "patient-appointment-card", id)).toContainText(`Confirmed with ${acc.doctorName}`);
  });

  test("5. hospital declines with a reason; the patient sees it", async ({ as, issues }) => {
    const patient = await as("patient");
    const id = await book(patient, { doctor: "any", visit: "in_person", reason: e2e("Flow 5 declined") });
    const why = e2e("Clinic closed that day, please pick another date");

    const hospital = await as("hospital");
    await hospital.goto("/hospital/appointments");
    await card(hospital, "hospital-appointment-card", id).getByRole("button", { name: "Decline", exact: true }).click();
    const dialog = hospital.getByRole("dialog", { name: "Decline appointment" });
    await expect(dialog.getByRole("button", { name: "Decline", exact: true })).toBeDisabled(); // reason is required
    await dialog.getByLabel("Reason").fill(why);
    await dialog.getByRole("button", { name: "Decline", exact: true }).click();
    await toast(hospital, "Appointment declined");
    expect(await appointmentRow(id)).toMatchObject({ status: "rejected", decline_reason: why });

    await patient.goto("/patient/appointments");
    await patient.getByRole("button", { name: "Cancelled and declined" }).click();
    const pc = card(patient, "patient-appointment-card", id);
    await expect(pc).toContainText(`Declined: ${why}`);
    await expect(pc.getByRole("link", { name: "Book again" })).toHaveAttribute("href", "/patient/book");
    await checkPage(patient, issues);
  });

  test("6. video visit: doctor accepts; both see the join button", async ({ as, issues }) => {
    const patient = await as("patient");
    const id = await book(patient, { doctor: "test", visit: "video", reason: e2e("Flow 6 video") });

    const doctor = await as("doctor");
    await doctor.goto("/doctor/appointments");
    const dc = card(doctor, "doctor-appointment-card", id);
    await expect(dc).toContainText("Video");
    await dc.getByRole("button", { name: "Accept", exact: true }).click();
    await toast(doctor, "Appointment accepted");
    // The join button lives in the appointment drawer.
    await dc.getByRole("button", { name: /Flow 6 video/ }).click();
    await expect(doctor.getByRole("button", { name: "Join video call" })).toBeVisible();
    await checkPage(doctor, issues);

    await patient.goto("/patient/appointments");
    const join = card(patient, "patient-appointment-card", id).getByRole("link", { name: /Join Consultation/ });
    await expect(join).toBeVisible();
    await expect(join).toHaveAttribute("href", `/consult/${id}?mode=appointment`);
  });

  test("7. patient cancels a pending booking; the hospital sees it cancelled", async ({ as, issues }) => {
    // Needs decision (e2e/BUGS.md #10): /patient/appointments has no Cancel action yet.
    test.fixme(true, "The patient appointments page has no Cancel button (Needs decision)");
    const patient = await as("patient");
    const id = await book(patient, { doctor: "any", visit: "in_person", reason: e2e("Flow 7 patient cancels") });

    await patient.goto("/patient/appointments");
    const pc = card(patient, "patient-appointment-card", id);
    await pc.getByRole("button", { name: /^Cancel/ }).click();
    await patient.getByRole("alertdialog").getByRole("button", { name: /Yes, cancel/ }).click();
    await toast(patient, /cancelled/i);
    expect((await appointmentRow(id)).status).toBe("cancelled");

    const hospital = await as("hospital");
    await hospital.goto("/hospital/appointments");
    await hospital.getByRole("tab", { name: "Past and closed" }).click();
    await expect(card(hospital, "hospital-appointment-card", id)).toContainText("Cancelled");
    await checkPage(hospital, issues);
  });
});
