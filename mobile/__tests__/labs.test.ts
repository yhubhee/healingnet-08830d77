import { isOutOfRange, labHtml, labStatusText, parseRange, rangeLabel, rangeWord, type LabResult } from "../shared/labs";
import { entryTypeLabel, letterHtml, letterStatus, vitalsList, type Letter } from "../shared/records";

const p = (flag: string | null, value: string | null, range: string | null) => ({ flag, result_value: value, ref_range_snapshot: range });

describe("the wording for a lab value", () => {
  it("uses the lab's own flag first", () => {
    expect(rangeWord(p("high", "9.1", "3.5 - 5.0"))).toBe("High");
    expect(rangeWord(p("low", "2.0", "3.5 - 5.0"))).toBe("Low");
    expect(rangeWord(p("abnormal", "Positive", null))).toBe("Outside the normal range");
    expect(rangeWord(p("normal", "4.0", "3.5 - 5.0"))).toBe("Normal");
    expect(rangeWord(p("HIGH", "9", null))).toBe("High");
    // The lab's judgement wins even where the plain numbers look fine.
    expect(rangeWord(p("high", "4.0", "3.5 - 5.0"))).toBe("High");
  });

  it("works it out from the range when the lab left no flag", () => {
    expect(rangeWord(p("unknown", "6.2", "3.5 - 5.0"))).toBe("High");
    expect(rangeWord(p("unknown", "3.0", "3.5–5.0"))).toBe("Low");
    expect(rangeWord(p(null, "4.2", "3.5 to 5.0"))).toBe("Normal");
    expect(rangeWord(p("", "3.5", "3.5 - 5.0"))).toBe("Normal"); // the limits themselves are inside
    expect(rangeWord(p("unknown", "5.0", "3.5 - 5.0"))).toBe("Normal");
    expect(rangeWord(p("unknown", "210", "< 200"))).toBe("High");
    expect(rangeWord(p("unknown", "180", "≤ 200"))).toBe("Normal");
    expect(rangeWord(p("unknown", "35", "> 40"))).toBe("Low");
    expect(rangeWord(p("unknown", "1,250", "4,000 - 11,000"))).toBe("Low");
  });

  it("says nothing when there is nothing to judge by", () => {
    expect(rangeWord(p("unknown", "Positive", "Negative"))).toBeNull();
    expect(rangeWord(p("unknown", "4.2", null))).toBeNull();
    expect(rangeWord(p(null, null, "3.5 - 5.0"))).toBeNull();
    expect(rangeWord(p("unknown", "4.2 (repeat)", "3.5 - 5.0"))).toBeNull();
  });

  it("marks out-of-range values in words, with an arrow, not by colour alone", () => {
    expect(rangeLabel("High")).toBe("▲ High");
    expect(rangeLabel("Low")).toBe("▼ Low");
    expect(rangeLabel("Outside the normal range")).toBe("Outside the normal range");
    expect(isOutOfRange("High")).toBe(true);
    expect(isOutOfRange("Low")).toBe(true);
    expect(isOutOfRange("Outside the normal range")).toBe(true);
    expect(isOutOfRange("Normal")).toBe(false);
    expect(isOutOfRange(null)).toBe(false);
  });

  it("reads the common ways a range is written", () => {
    expect(parseRange("3.5 - 5.0 mmol/L")).toEqual({ min: 3.5, max: 5 });
    expect(parseRange("up to 40")).toEqual({ min: null, max: 40 });
    expect(parseRange(">= 60")).toEqual({ min: 60, max: null });
    expect(parseRange("Negative")).toBeNull();
    expect(parseRange("")).toBeNull();
  });
});

const lab: LabResult = {
  id: "0123456789abcdef", created_at: "2026-11-02T09:00:00Z", status: "completed", notes: "Fasting <sample>", hospitals: { name: "General & Co" },
  lab_result_tests: [{
    id: "t1", test_name: "Full blood count", category_name: "Haematology",
    lab_result_parameters: [
      { id: "b", parameter_name: "WBC", result_value: "12.5", unit_snapshot: "x10^9/L", ref_range_snapshot: "4 - 11", flag: "unknown", sort_order: 2 },
      { id: "a", parameter_name: "Haemoglobin", result_value: "13.5", unit_snapshot: "g/dL", ref_range_snapshot: "12 - 16", flag: "normal", sort_order: 1 },
    ],
  }],
};

describe("a lab result", () => {
  it("says how many values are outside the range", () => {
    expect(labStatusText(lab)).toBe("Ready · 1 outside the normal range");
    expect(labStatusText({ ...lab, lab_result_tests: [] })).toBe("Ready");
    expect(labStatusText({ ...lab, status: "processing" })).toBe("In the lab");
    expect(labStatusText({ ...lab, status: "pending" })).toBe("Waiting for the lab");
  });

  it("makes a report page with the wording and escaped text", () => {
    const html = labHtml(lab, "Ada <Obi>");
    expect(html).toContain("General &amp; Co");
    expect(html).toContain("Ada &lt;Obi&gt;");
    expect(html).toContain("Fasting &lt;sample&gt;");
    expect(html).toContain('<td class="out">High</td>');
    expect(html.indexOf("Haemoglobin")).toBeLessThan(html.indexOf("WBC")); // in the lab's order
  });
});

describe("records and letters", () => {
  it("names record types in plain words", () => {
    expect(entryTypeLabel("consultation_note")).toBe("Consultation");
    expect(entryTypeLabel("discharge_summary")).toBe("Discharge summary");
    expect(entryTypeLabel("something_new")).toBe("Something new");
  });

  it("lists only the vitals that were taken", () => {
    expect(vitalsList({ systolic: 120, diastolic: 80, heart_rate: 72, weight: null })).toEqual([
      { label: "Blood pressure", value: "120/80" }, { label: "Heart rate", value: "72 bpm" },
    ]);
    expect(vitalsList(null)).toEqual([]);
  });

  const letter: Letter = {
    id: "l1", letter_type: "sick_leave", title: "Sick leave", body: "Rest for 3 days.\n<b>No work</b>", status: "issued",
    issued_at: "2026-11-01T10:00:00Z", valid_until: "2026-11-04", pdf_url: null,
    doctors: { first_name: "Ngozi", last_name: "Ade", specialty: "General Practice" }, hospitals: { name: "City Hospital", address: "1 Marina" },
  };

  it("treats a letter past its valid-until date as expired", () => {
    expect(letterStatus(letter, new Date("2026-11-02T00:00:00Z"))).toBe("issued");
    expect(letterStatus(letter, new Date("2026-11-10T00:00:00Z"))).toBe("expired");
    expect(letterStatus({ status: "pending", valid_until: null })).toBe("pending");
  });

  it("makes the letter page with the same parts as the website's PDF", () => {
    const html = letterHtml(letter);
    for (const part of ["City Hospital", "1 Marina", "Sick leave", "Issued: 1 Nov 2026", "Valid until: 4 Nov 2026", "Sincerely,", "Dr. Ngozi Ade", "General Practice"]) {
      expect(html).toContain(part);
    }
    expect(html).toContain("&lt;b&gt;No work&lt;/b&gt;");
  });
});
