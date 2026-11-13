import { dbMessage, friendlyError } from "../shared/errors";
import { compactPhone, healthNote, isNigerianPhone, missingPatientFields, PATIENT_UPDATE_COLUMNS, validateProfile, type ProfileForm } from "../shared/patientProfile";
import { formatKobo, rxNextAction, rxStatusLabel, type PatientRequest, type RxPayload } from "../shared/pharmacy";
import { qrSvg, rxHtml } from "../shared/rxHtml";

describe("error messages (same as the website)", () => {
  it("shows the pharmacy functions' own messages", () => {
    expect(friendlyError({ message: "You can send a prescription to at most 3 pharmacies", code: "42501" })).toBe("You can send a prescription to at most 3 pharmacies");
  });
  it("maps technical errors to plain words", () => {
    expect(friendlyError({ message: "permission denied for table x" })).toBe("You don't have permission to do that.");
    expect(friendlyError({ message: "TypeError: Network request failed" })).toBe("Network problem. Check your connection and try again.");
    expect(friendlyError({ message: "JWT expired" })).toBe("Please sign in again.");
    expect(friendlyError({ message: "weird internal thing" })).toBe("Something went wrong. Please try again.");
    expect(friendlyError(null, "Fallback")).toBe("Fallback");
  });
  it("shows the database's own message for booking and appointments", () => {
    expect(dbMessage({ message: "This doctor is not available at that time" })).toBe("This doctor is not available at that time");
    expect(dbMessage({ message: "Network request failed" })).toBe("Network problem. Check your connection and try again.");
  });
});

describe("patient profile checks (same as the website)", () => {
  it("accepts Nigerian phone numbers only", () => {
    expect(isNigerianPhone("0803 123 4567")).toBe(true);
    expect(isNigerianPhone("+234 803 123 4567")).toBe(true);
    expect(isNigerianPhone("(0803) 123-4567")).toBe(true);
    expect(isNigerianPhone("803 123 4567")).toBe(false);
    expect(isNigerianPhone("0003 123 4567")).toBe(false);
    expect(isNigerianPhone("+1 415 555 0100")).toBe(false);
    expect(compactPhone("0803 123-4567")).toBe("08031234567");
  });

  it("knows which required details are missing", () => {
    expect(missingPatientFields(null)).toHaveLength(8);
    expect(missingPatientFields({ phone: "0803", date_of_birth: "1990-01-01", gender: "female", state: "Lagos", city: "Ikeja", address: " ", emergency_contact_name: "A", emergency_contact_phone: "0" })).toEqual(["address"]);
  });

  it("validates the form with the website's messages", () => {
    const form: ProfileForm = {
      phone: "12345", date_of_birth: "2999-01-01", gender: "", state: "", city: "", address: "", emergency_contact_name: "", emergency_contact_phone: "",
      blood_group: "", genotype: "", insurance_provider: "", insurance_policy_number: "",
      allergies: "x".repeat(501), medical_conditions: "Asthma",
    };
    const e = validateProfile(form, "2026-11-12");
    expect(e.phone).toBe("Enter a Nigerian number, e.g. 0803 123 4567 or +234 803 123 4567.");
    expect(e.date_of_birth).toBe("Your date of birth can't be in the future.");
    expect(e.gender).toBe("Choose your gender.");
    expect(e.allergies).toBe("Keep this under 500 characters.");
    expect(e.medical_conditions).toBeUndefined();
    expect(healthNote("  ")).toBe("None known");
    expect(healthNote(null)).toBe("None known");
    expect(healthNote("Penicillin")).toBe("Penicillin");
    expect(PATIENT_UPDATE_COLUMNS).toEqual(expect.arrayContaining(["allergies", "medical_conditions"]));
    expect(e.emergency_contact_phone).toBe("Enter a phone number.");
    expect(e.blood_group).toBeUndefined();
    const ok = validateProfile({ ...form, phone: "08031234567", date_of_birth: "1990-05-01", gender: "male", state: "Lagos", city: "Ikeja", address: "1 Road", emergency_contact_name: "Bisi", emergency_contact_phone: "+2348031234567", allergies: "Penicillin" }, "2026-11-12");
    expect(ok).toEqual({});
  });
});

describe("prescriptions", () => {
  it("labels each status in words", () => {
    expect(rxStatusLabel({ status: "valid", expires_at: "2026-12-01" })).toBe("Valid until 1 Dec 2026");
    expect(rxStatusLabel({ status: "expired", expires_at: "2026-10-01" })).toBe("Expired 1 Oct 2026");
    expect(rxStatusLabel({ status: "used" })).toBe("Dispensed");
    expect(rxStatusLabel({ status: "not_valid" })).toBe("Hospital record only");
    expect(rxStatusLabel({ status: "cancelled" })).toBe("Cancelled");
  });

  it("formats prices from kobo", () => {
    expect(formatKobo(250000)).toBe("₦2,500");
    expect(formatKobo(250050)).toBe("₦2,500.5");
    expect(formatKobo(123456789)).toBe("₦1,234,567.89");
    expect(formatKobo(0)).toBe("₦0");
    expect(formatKobo(null)).toBe("—");
  });

  it("says what to do next", () => {
    const doc: RxPayload = { status: "valid", document_id: "d1" };
    const req = (status: string) => ({ rx_document_id: "d1", status, pharmacies: { name: "Good Health" } }) as PatientRequest;
    expect(rxNextAction(doc, [])).toMatch(/Show the code/);
    expect(rxNextAction(doc, [req("sent")])).toBe("Waiting for the pharmacy to reply.");
    expect(rxNextAction(doc, [req("sent"), req("available")])).toMatch(/^Ready at Good Health/);
  });

  it("builds the PDF page safely", () => {
    const doc: RxPayload = {
      status: "valid", code: "HN-AAAAA-BBBBB", issued_at: "2026-11-01T09:00:00Z", expires_at: "2026-12-01",
      prescriber: { doctor_name: "Dr. Ada <Obi>", licence_number: "MDCN/1", hospital_name: "City & Sons Hospital" },
      patient: { name: "<script>alert(1)</script>", date_of_birth: null, gender: "female" },
      signature_data: "javascript:alert(1)",
      items: [{ prescription_id: "p", drug_name: "Amoxicillin 500mg", dosage: "1 cap", frequency: "3x daily", duration: "5 days", instructions: "After \"food\"", refills_allowed: 1, times_dispensed: 0, remaining: 2, status: "active", doctor_issued: true, dispensable: true }],
    };
    const html = rxHtml(doc, "https://example.org/", [[true, false], [false, true]]);
    expect(html).toContain("HN-AAAAA-BBBBB");
    expect(html).toContain("Amoxicillin 500mg");
    expect(html).toContain("City &amp; Sons Hospital");
    expect(html).toContain("Valid until 1 Dec 2026. Verify at https://example.org/verify");
    expect(html).toContain("HealingNet never takes payment for medicine");
    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("javascript:");
    expect(html).toContain("<svg");
  });

  it("draws the QR dark on white", () => {
    const svg = qrSvg([[true]], 100);
    expect(svg).toContain('fill="#fff"');
    expect(svg).toContain('fill="#000"');
  });
});
