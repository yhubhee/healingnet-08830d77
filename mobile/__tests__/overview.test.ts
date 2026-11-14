import {
  cardSpoken, labsLine, lettersLine, overviewCards, overviewIsDue, parseOverview, prescriptionsLine, recordsLine, shortDate,
  type HealthOverview,
} from "../shared/overview";

const EMPTY: HealthOverview = parseOverview(null);
const rx = (over: Partial<HealthOverview["prescriptions"]> = {}): HealthOverview["prescriptions"] => ({
  active: 2, total: 5,
  latest: { document_id: "d1", issued_at: "2026-11-10T09:00:00Z", status: "valid", hospital_name: "City Hospital", medicines: ["Amoxicillin", "Paracetamol"] },
  ...over,
});

describe("Your health: the status line on each card", () => {
  it("prescriptions", () => {
    expect(prescriptionsLine(rx())).toBe("2 active · Amoxicillin, Paracetamol");
    expect(prescriptionsLine(rx({ active: 0 }))).toBe("No active prescriptions");
    expect(prescriptionsLine(EMPTY.prescriptions)).toBe("No active prescriptions");
    // The newest document is used up: its medicines are not the active ones, so none are named.
    expect(prescriptionsLine(rx({ active: 1, latest: { ...rx().latest!, status: "used" } }))).toBe("1 active");
    expect(prescriptionsLine(rx({ latest: { ...rx().latest!, medicines: ["A", "B", "C", "D"] } }))).toBe("2 active · A, B, C");
  });

  it("lab results: new first, then in progress, then the latest test and date", () => {
    const latest = { id: "l1", status: "completed", created_at: "2026-11-12T10:00:00Z", is_new: false, tests: ["Full blood count"], hospital_name: null };
    expect(labsLine({ new: 1, in_progress: 2, total: 4, latest })).toBe("1 new result");
    expect(labsLine({ new: 3, in_progress: 0, total: 4, latest })).toBe("3 new results");
    expect(labsLine({ new: 0, in_progress: 2, total: 4, latest })).toBe("2 in progress");
    expect(labsLine({ new: 0, in_progress: 0, total: 4, latest })).toBe("Full blood count, 12 Nov");
    expect(labsLine({ new: 0, in_progress: 0, total: 1, latest: { ...latest, tests: ["Malaria", "Widal", "FBC"] } })).toBe("Malaria and 2 more, 12 Nov");
    expect(labsLine({ new: 0, in_progress: 0, total: 1, latest: { ...latest, tests: [] } })).toBe("Lab result, 12 Nov");
    expect(labsLine(EMPTY.labs)).toBe("No lab results yet");
  });

  it("records", () => {
    const latest = { id: "e1", title: "Consultation note", entry_type: "consultation", created_at: "2026-11-12T08:00:00Z", doctor_name: "Dr Ngozi Okafor", hospital_name: null };
    expect(recordsLine({ total: 3, latest })).toBe("Last: Consultation note, 12 Nov, Dr Ngozi Okafor");
    expect(recordsLine({ total: 1, latest: { ...latest, doctor_name: null } })).toBe("Last: Consultation note, 12 Nov");
    expect(recordsLine({ total: 1, latest: { ...latest, title: " ", entry_type: "vital_signs" } })).toBe("Last: vital signs, 12 Nov, Dr Ngozi Okafor");
    expect(recordsLine(EMPTY.records)).toBe("No records yet");
  });

  it("letters", () => {
    const latest = { id: "t1", title: "Sick leave", letter_type: "sick_leave", issued_at: "2026-11-01T00:00:00Z" };
    expect(lettersLine({ total: 3, latest })).toBe("3 letters · Sick leave");
    expect(lettersLine({ total: 1, latest: { ...latest, title: null } })).toBe("1 letter · sick leave");
    expect(lettersLine(EMPTY.letters)).toBe("No letters yet");
  });

  it("dates are shown in Lagos time", () => {
    expect(shortDate("2026-11-12T23:30:00Z")).toBe("13 Nov"); // 00:30 in Lagos
    expect(shortDate("2026-11-12")).toBe("12 Nov");
    expect(shortDate(null)).toBe("");
    expect(shortDate("not a date")).toBe("");
  });
});

describe("Your health: the cards", () => {
  it("are always the same four, in order, each with a badge only when there is a count", () => {
    const cards = overviewCards(EMPTY);
    expect(cards.map((c) => c.id)).toEqual(["prescriptions", "labs", "records", "letters"]);
    expect(cards.map((c) => c.count)).toEqual([null, null, null, null]);
    expect(cards.map((c) => c.status)).toEqual(["No active prescriptions", "No lab results yet", "No records yet", "No letters yet"]);
  });

  it("a new lab result is said in words, not shown by colour alone", () => {
    const o = parseOverview({ labs: { new: 1, in_progress: 0, total: 6, latest: null }, prescriptions: { active: 2, total: 2, latest: null } });
    const [prescriptions, labs] = overviewCards(o);
    expect(labs).toMatchObject({ count: 1, highlight: true, status: "1 new result" });
    expect(cardSpoken(labs)).toBe("Lab results. 1 new. 1 new result");
    expect(cardSpoken(prescriptions)).toBe("Prescriptions. 2. 2 active");
    expect(cardSpoken(overviewCards(EMPTY)[3])).toBe("Letters. No letters yet");
  });

  it("survives a response with parts missing or of the wrong type", () => {
    const o = parseOverview({ prescriptions: null, labs: { new: "3", total: -1 }, records: { total: 2.9, latest: "x" } });
    expect(o.labs).toEqual({ new: 0, in_progress: 0, total: 0, latest: null });
    expect(o.records).toEqual({ total: 2, latest: null });
    expect(overviewCards(o)).toHaveLength(4);
  });

  it("refreshes on coming into view at most every 30 seconds", () => {
    expect(overviewIsDue(1_000_000, 1_000_000 + 29_999)).toBe(false);
    expect(overviewIsDue(1_000_000, 1_000_000 + 30_000)).toBe(true);
  });
});
