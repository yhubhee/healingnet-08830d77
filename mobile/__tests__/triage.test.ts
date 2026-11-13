import {
  addAnswer, ageFromDob, bookingReason, DURATION_CHOICES, interviewDone, isEmergency, MAX_QUESTIONS, needsAmbulance, sessionRow,
  triageErrorText, urgencyTone, urgencyWords, type NurseResponse, type Question,
} from "../shared/triage";

const response = (over: Partial<NurseResponse> = {}): NurseResponse => ({
  should_stop: false, differential: [{ name: "Malaria", probability: 0.62 }], severity_score: 5, triage_level: "consultation",
  triage_label: "See a doctor in the next few days", recommended_specialty: "General Practice", red_flags: [], guidance: "Book a consultation.", ...over,
});

describe("the emergency triggers", () => {
  it("shows the emergency card for either emergency level", () => {
    expect(isEmergency(response({ triage_level: "emergency" }))).toBe(true);
    expect(isEmergency(response({ triage_level: "emergency_ambulance" }))).toBe(true);
  });
  it("does not for the other levels, or before there is a result", () => {
    for (const level of ["self_care", "consultation", "consultation_24", "something_else"]) {
      expect(isEmergency(response({ triage_level: level }))).toBe(false);
    }
    expect(isEmergency(null)).toBe(false);
    expect(isEmergency(undefined)).toBe(false);
  });
  it("triggers on the level even when the service lists no red flags or has more questions", () => {
    expect(isEmergency(response({ triage_level: "emergency", red_flags: [], should_stop: false, next_question: { id: "x", text: "?" } }))).toBe(true);
  });
  it("red flags alone, at a lower level, are a warning and not the emergency card", () => {
    expect(isEmergency(response({ triage_level: "consultation_24", red_flags: ["Fever in pregnancy"] }))).toBe(false);
  });
  it("says to call an ambulance only for the ambulance level", () => {
    expect(needsAmbulance(response({ triage_level: "emergency_ambulance" }))).toBe(true);
    expect(needsAmbulance(response({ triage_level: "emergency" }))).toBe(false);
  });
  it("words the urgency, never by colour alone", () => {
    expect(urgencyWords("emergency_ambulance")).toBe("Emergency: call an ambulance");
    expect(urgencyWords("emergency")).toBe("Emergency: go to a hospital now");
    expect(urgencyWords("consultation_24")).toBe("See a doctor within 24 hours");
    expect(urgencyWords("consultation")).toBe("See a doctor soon");
    expect(urgencyWords("self_care")).toBe("Self-care");
    expect(urgencyTone("emergency")).toBe("danger");
    expect(urgencyTone("self_care")).toBe("success");
  });
});

describe("answers", () => {
  const yesNo: Question = { id: "fever", text: "Do you have a fever?", type: "boolean" };
  it("records yes and no, and nothing for I don't know", () => {
    expect(addAnswer([], yesNo, "yes")).toEqual([{ id: "fever", name: "Do you have a fever?", present: true }]);
    expect(addAnswer([], yesNo, "no")).toEqual([{ id: "fever", name: "Do you have a fever?", present: false }]);
    expect(addAnswer([], yesNo, "unknown")).toEqual([]);
    expect(addAnswer([], { id: "q", text: "No type means yes/no" }, "yes")[0].present).toBe(true);
  });
  it("records the other kinds as question: answer", () => {
    expect(addAnswer([], { id: "severity", text: "How bad?", type: "scale" }, 7)).toEqual([{ id: "severity", name: "How bad?: 7", present: true }]);
    expect(addAnswer([], { id: "duration", text: "How long?", type: "duration" }, "2 days")[0].name).toBe("How long?: 2 days");
  });
  it("offers how-long choices in the amount-and-unit form the service reads", () => {
    for (const c of DURATION_CHOICES) expect(c.value).toMatch(/^\d+ (hours|days|weeks|months)$/);
  });
  it("ends the interview when told to, when out of questions, or at the limit", () => {
    const next = { id: "n", text: "?" };
    expect(interviewDone({ should_stop: false, next_question: next }, 3)).toBe(false);
    expect(interviewDone({ should_stop: true, next_question: next }, 3)).toBe(true);
    expect(interviewDone({ should_stop: false, next_question: undefined }, 3)).toBe(true);
    expect(interviewDone({ should_stop: false, next_question: next }, MAX_QUESTIONS)).toBe(true);
  });
});

describe("the saved session", () => {
  const evidence = [{ id: "fever", name: "Fever", present: true }, { id: "cough", name: "Cough", present: false }];
  it("is the same row the website saves, with severity_self left empty", () => {
    const row = sessionRow({ patientId: "p1", evidence, freeText: "hot and tired", response: response({ triage_level: "emergency" }), coords: { lat: 6.5, lng: 3.4 } });
    expect(row).toMatchObject({
      patient_id: "p1", symptoms: ["Fever:yes", "Cough:no", "hot and tired"], severity_self: null, severity_score: 5,
      recommended_specialty: "General Practice", urgency: "emergency", lat: 6.5, lng: 3.4,
    });
  });
  it("maps every level to an urgency the database accepts", () => {
    const urgency = (level: string) => sessionRow({ patientId: "p", evidence: [], freeText: "", response: response({ triage_level: level }), coords: null }).urgency;
    expect(urgency("self_care")).toBe("routine");
    expect(urgency("consultation")).toBe("soon");
    expect(urgency("consultation_24")).toBe("soon");
    expect(urgency("emergency_ambulance")).toBe("emergency");
    expect(urgency("unknown")).toBe("soon");
  });
  it("falls back to the top condition when the service sends no score, and saves no location when there is none", () => {
    const row = sessionRow({ patientId: "p", evidence: [], freeText: "", response: response({ severity_score: undefined }), coords: null });
    expect(row.severity_score).toBe(6);
    expect(row.lat).toBeNull();
    expect(row.symptoms).toEqual([]);
  });
});

describe("small helpers", () => {
  it("works out age from the date of birth", () => {
    expect(ageFromDob("1990-06-15", new Date("2026-11-13T00:00:00Z"))).toBe(36);
    expect(ageFromDob(null)).toBeNull();
    expect(ageFromDob("not a date")).toBeNull();
  });
  it("uses the website's error wording", () => {
    expect(triageErrorText(429)).toBe("Too many requests. Wait a minute.");
    expect(triageErrorText(500)).toBe("The triage service is unavailable right now.");
  });
  it("pre-fills the booking reason like the website, within 500 characters", () => {
    expect(bookingReason(response(), "hot and tired")).toBe("Triage: See a doctor in the next few days (General Practice). hot and tired");
    expect(bookingReason(response(), "x".repeat(900)).length).toBe(500);
  });
});
