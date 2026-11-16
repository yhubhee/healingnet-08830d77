import {
  alertsReplacedByPush, bpFlag, canDeleteCareItem, CARE_REMINDER_TITLE, CARE_TEMPLATES, careAlertText, careDateTime, careDay, eddFromLmp, fastingLine,
  gestationOn, gestationText, groupCareItems, hasActiveCare, isHighBp, lmpFromEdd, nextCareLine, parseCare, patientCanTick, planCareAlerts,
  pregnancyProgress, shareBudget, suggestFastingFrom, type CareData, type CareItem,
} from "../shared/care";
import { MAX_SCHEDULED, planSchedule, type Reminder } from "../shared/reminders";

const item = (over: Partial<CareItem>): CareItem => ({
  id: "i1", kind: "task", title: "Blood test", details: null, due_at: null, remind: true, status: "open", done_at: null, done_by_patient: false, ...over,
});
const surgery = (over: Record<string, unknown> = {}) => ({
  id: "s1", hospital_name: "City Hospital", surgeon_name: "Dr Ade Obi", procedure_name: "Hernia repair", procedure_type: "elective", anaesthesia_type: "general",
  scheduled_date: "2026-11-24", scheduled_time: "09:00:00", admit_at: null, fasting_from: null, status: "scheduled", consent_signed: false,
  patient_instructions: null, post_op_instructions: null, items: [], ...over,
});
const care = (over: Partial<Record<keyof CareData, unknown>>): CareData => parseCare({ pregnancies: [], surgeries: [], ...over });

describe("EDD and LMP", () => {
  it("fills one from the other (280 days)", () => {
    expect(eddFromLmp("2026-06-01")).toBe("2027-03-08");
    expect(lmpFromEdd("2027-03-08")).toBe("2026-06-01");
    expect(lmpFromEdd(eddFromLmp("2026-02-28"))).toBe("2026-02-28");
    expect(eddFromLmp("")).toBeNull();
    expect(eddFromLmp("not a date")).toBeNull();
    expect(lmpFromEdd(null)).toBeNull();
  });
  it("works out weeks and days today, from the LMP or from the EDD", () => {
    expect(gestationOn("2026-06-01", null, "2026-11-19")).toEqual({ weeks: 24, days: 3 });
    expect(gestationOn(null, "2027-03-08", "2026-11-19")).toEqual({ weeks: 24, days: 3 });
    expect(gestationOn("2026-06-01", "2099-01-01", "2026-06-01")).toEqual({ weeks: 0, days: 0 }); // the LMP wins
    expect(gestationOn(null, null, "2026-11-19")).toBeNull();
    expect(gestationOn("2026-12-01", null, "2026-11-19")).toBeNull(); // LMP in the future
    expect(gestationOn("2020-01-01", null, "2026-11-19")).toBeNull(); // far too long ago
  });
  it("says it in words", () => {
    expect(gestationText({ weeks: 24, days: 3 })).toBe("24 weeks 3 days");
    expect(gestationText({ weeks: 24, days: 0 })).toBe("24 weeks");
    expect(gestationText({ weeks: 1, days: 1 })).toBe("1 week 1 day");
    expect(gestationText(null)).toBe("");
    expect(pregnancyProgress({ weeks: 20, days: 0 })).toBe(0.5);
    expect(pregnancyProgress({ weeks: 42, days: 0 })).toBe(1);
  });
});

describe("the high-BP flag", () => {
  it("flags 140/90 or above, either number", () => {
    expect(isHighBp(140, 90)).toBe(true);
    expect(isHighBp(140, 70)).toBe(true);
    expect(isHighBp(120, 90)).toBe(true);
    expect(isHighBp(139, 89)).toBe(false);
    expect(isHighBp(null, null)).toBe(false);
    expect(bpFlag(150, 95)).toBe("High BP"); // in words, not colour alone
    expect(bpFlag(110, 70)).toBeNull();
  });
});

describe("care-item grouping", () => {
  const list = [
    item({ id: "a", due_at: "2026-11-25T08:00:00Z" }),
    item({ id: "b" }),
    item({ id: "c", status: "done", done_at: "2026-11-10T08:00:00Z" }),
    item({ id: "d", due_at: "2026-11-20T08:00:00Z" }),
    item({ id: "e", status: "cancelled", due_at: "2026-11-21T08:00:00Z" }),
    item({ id: "f", status: "done", done_at: "2026-11-12T08:00:00Z", done_by_patient: true }),
    item({ id: "g", due_at: "2026-11-01T08:00:00Z" }), // date has passed, still open
  ];
  it("groups into Upcoming, No date and Done", () => {
    const g = groupCareItems(list);
    expect(g.upcoming.map((i) => i.id)).toEqual(["g", "d", "a"]);
    expect(g.noDate.map((i) => i.id)).toEqual(["b"]);
    expect(g.done.map((i) => i.id)).toEqual(["f", "c"]);
  });
  it("lets the patient tick everything except visits", () => {
    expect(patientCanTick(item({ kind: "task" }))).toBe(true);
    expect(patientCanTick(item({ kind: "test" }))).toBe(true);
    expect(patientCanTick(item({ kind: "medicine" }))).toBe(true);
    expect(patientCanTick(item({ kind: "instruction" }))).toBe(true);
    expect(patientCanTick(item({ kind: "visit" }))).toBe(false);
  });
  it("allows deleting only a fresh mistake", () => {
    const now = new Date("2026-11-16T10:00:00Z");
    expect(canDeleteCareItem("2026-11-16T09:55:00Z", now)).toBe(true);
    expect(canDeleteCareItem("2026-11-16T09:45:00Z", now)).toBe(false);
    expect(canDeleteCareItem(null, now)).toBe(false);
  });
  it("templates give a title only: no doses and no advice", () => {
    expect(CARE_TEMPLATES.surgery.map((t) => t.title)).toEqual(["Blood test", "Stop eating (fasting)", "Bring your medicines", "Wound check", "Remove stitches", "Clinic review"]);
    expect(CARE_TEMPLATES.maternity.map((t) => t.title)).toEqual(["Ultrasound scan", "Blood tests", "Tetanus vaccine", "Iron and folic acid"]);
    for (const t of [...CARE_TEMPLATES.surgery, ...CARE_TEMPLATES.maternity]) expect(Object.keys(t).sort()).toEqual(["kind", "title"]);
  });
});

describe("dates in Nigerian format", () => {
  it("shows Lagos time", () => {
    expect(careDateTime("2026-11-24T08:00:00Z")).toBe("Tue 24 Nov, 9:00 am");
    expect(careDateTime("2026-11-23T23:30:00Z")).toBe("Tue 24 Nov, 12:30 am");
    expect(careDay("2026-11-24")).toBe("Tue 24 Nov");
    expect(fastingLine("2026-11-23T21:00:00Z")).toBe("Fasting from 10:00 pm, Mon 23 Nov");
    expect(careDateTime(null)).toBe("");
  });
  it("suggests fasting from 6 hours before the start", () => {
    expect(suggestFastingFrom("2026-11-24", "09:00")!.toISOString()).toBe("2026-11-24T02:00:00.000Z"); // 03:00 Lagos
    expect(suggestFastingFrom("nope", "09:00")).toBeNull();
  });
});

describe("Home's Care plan card", () => {
  const now = new Date("2026-11-16T10:00:00Z");
  it("shows only for an active pregnancy or an upcoming procedure", () => {
    expect(hasActiveCare(care({}))).toBe(false);
    expect(hasActiveCare(care({ pregnancies: [{ id: "p", status: "delivered", items: [] }] }))).toBe(false);
    expect(hasActiveCare(care({ pregnancies: [{ id: "p", status: "active_anc", items: [] }] }))).toBe(true);
    expect(hasActiveCare(care({ surgeries: [surgery({ status: "completed" })] }))).toBe(false);
    expect(hasActiveCare(care({ surgeries: [surgery()] }))).toBe(true);
    expect(hasActiveCare(null)).toBe(false);
  });
  it("names the next thing and its day", () => {
    const c = care({ pregnancies: [{ id: "p", status: "active_anc", weeks_today: 24, days_extra: 3, items: [
      item({ id: "v", kind: "visit", title: "Antenatal visit", due_at: "2026-11-24T08:00:00Z" }),
      item({ id: "old", title: "Past thing", due_at: "2026-11-01T08:00:00Z" }),
    ] }] });
    expect(nextCareLine(c, now)).toBe("Next: Antenatal visit · Tue 24 Nov");
    expect(nextCareLine(care({ pregnancies: [{ id: "p", status: "active_anc", weeks_today: 24, days_extra: 3, items: [] }] }), now)).toBe("24 weeks 3 days");
    expect(nextCareLine(care({ surgeries: [surgery()] }), now)).toBe("Next: Hernia repair · Tue 24 Nov");
  });
});

describe("the reminder schedule", () => {
  const now = new Date("2026-11-16T10:00:00Z");
  const times = (c: CareData) => planCareAlerts(c, now).map((a) => `${a.key} ${new Date(a.at).toISOString()}`);

  it("a visit: the day before at 18:00, and 2 hours before", () => {
    const c = care({ pregnancies: [{ id: "p", status: "active_anc", items: [item({ id: "v", kind: "visit", title: "Antenatal visit", due_at: "2026-11-24T08:00:00Z" })] }] });
    expect(times(c)).toEqual(["v|day 2026-11-23T17:00:00.000Z", "v|due 2026-11-24T06:00:00.000Z"]); // 18:00 and 07:00 Lagos
  });
  it("a test, medicine, task or instruction: the day before at 18:00, and at the time", () => {
    for (const kind of ["test", "medicine", "task", "instruction"] as const) {
      const c = care({ surgeries: [surgery({ status: "completed", items: [item({ id: "t", kind, due_at: "2026-11-24T08:00:00Z" })] })] });
      expect(times(c)).toEqual(["t|day 2026-11-23T17:00:00.000Z", "t|due 2026-11-24T08:00:00.000Z"]);
    }
  });
  it("the procedure: the day before at 18:00, 2 hours before admission, and 1 hour before fasting", () => {
    const c = care({ surgeries: [surgery({ admit_at: "2026-11-24T06:00:00Z", fasting_from: "2026-11-23T21:00:00Z" })] });
    expect(times(c)).toEqual(["s1|day 2026-11-23T17:00:00.000Z", "s1|fast 2026-11-23T20:00:00.000Z", "s1|due 2026-11-24T04:00:00.000Z"]);
    // Without an admission time, the operation's own time is used.
    expect(times(care({ surgeries: [surgery()] }))).toEqual(["s1|day 2026-11-23T17:00:00.000Z", "s1|due 2026-11-24T06:00:00.000Z"]);
  });
  it("nothing for items that are done, cancelled, undated, past, or have remind off", () => {
    const c = care({ pregnancies: [{ id: "p", status: "active_anc", items: [
      item({ id: "a", status: "done", due_at: "2026-11-24T08:00:00Z" }),
      item({ id: "b", status: "cancelled", due_at: "2026-11-24T08:00:00Z" }),
      item({ id: "c" }),
      item({ id: "d", due_at: "2026-11-10T08:00:00Z" }),
      item({ id: "e", remind: false, due_at: "2026-11-24T08:00:00Z" }),
    ] }], surgeries: [surgery({ status: "cancelled", fasting_from: "2026-11-23T21:00:00Z" })] });
    expect(planCareAlerts(c, now)).toEqual([]);
  });
  it("leaves out a reminder whose moment has already passed", () => {
    const c = care({ pregnancies: [{ id: "p", status: "active_anc", items: [item({ id: "v", kind: "visit", due_at: "2026-11-16T15:00:00Z" })] }] });
    expect(times(c)).toEqual(["v|due 2026-11-16T13:00:00.000Z"]); // yesterday 18:00 is gone
  });
  it("carries whose it is, for a family member", () => {
    const c = care({ surgeries: [surgery()] });
    expect(planCareAlerts(c, now, { patientId: "kid", person: "Tobi" })[0]).toMatchObject({ patientId: "kid", person: "Tobi", ref: "s1" });
  });

  it("shares one budget of 60 with medicine reminders, nearest first", () => {
    const med: Reminder = { id: "rx1", documentId: "d1", drug: "Amoxicillin", dose: null, times: ["08:00", "14:00", "20:00"], startDate: "2026-11-16", days: 30 };
    const doses = planSchedule([med], now, {}, MAX_SCHEDULED);
    expect(doses).toHaveLength(60);
    const c = care({ pregnancies: [{ id: "p", status: "active_anc", items: [
      item({ id: "soon", kind: "visit", due_at: "2026-11-18T08:00:00Z" }),
      item({ id: "far", kind: "visit", due_at: "2027-02-01T08:00:00Z" }),
    ] }] });
    const alerts = planCareAlerts(c, now);
    const shared = shareBudget(doses, alerts, MAX_SCHEDULED);
    expect(shared.doses.length + shared.alerts.length).toBe(60);
    expect(shared.alerts.map((a) => a.key)).toEqual(["soon|day", "soon|due"]); // the far-off visit waits its turn
    expect(shared.doses).toHaveLength(58);
    const latest = Math.max(...shared.doses.map((d) => d.at), ...shared.alerts.map((a) => a.at));
    expect(doses.filter((d) => d.at > latest)).toHaveLength(2); // the two furthest doses made room
    // With no medicines, care alerts still stop at the cap.
    const many = Array.from({ length: 80 }, (_, i) => ({ at: i, key: `k${i}` }));
    expect(shareBudget([], many, 60).alerts).toHaveLength(60);
    expect(shareBudget(many, [], 60).doses).toHaveLength(60);
  });

  it("keeps the lock screen generic unless details are on", () => {
    expect(careAlertText({ text: "Antenatal visit · tomorrow, 9:00 am" }, false)).toEqual({ title: CARE_REMINDER_TITLE, body: "Open HealingNet to see it." });
    expect(careAlertText({ text: "Antenatal visit · tomorrow, 9:00 am", person: "Tobi" }, false).title).toBe("Care plan reminder");
    expect(careAlertText({ text: "Antenatal visit · tomorrow, 9:00 am" }, true)).toEqual({ title: "Care plan reminder", body: "Antenatal visit · tomorrow, 9:00 am" });
    expect(careAlertText({ text: "Wound check · today, 9:00 am", person: "Tobi" }, true).title).toBe("Tobi: care plan reminder");
  });

  it("drops the local alert a server push has already covered", () => {
    const c = care({ surgeries: [surgery({ admit_at: "2026-11-24T06:00:00Z", fasting_from: "2026-11-23T21:00:00Z", items: [item({ id: "v", kind: "visit", due_at: "2026-11-24T08:00:00Z" })] })] });
    const plan = planCareAlerts(c, now);
    // The day before: the server's "Tomorrow at…" replaces the 18:00 one.
    expect(alertsReplacedByPush(plan, "v", new Date("2026-11-23T08:00:00Z"))).toEqual(["v|day"]);
    // Two hours before: the server's "Today at…" replaces the on-the-day one.
    expect(alertsReplacedByPush(plan, "v", new Date("2026-11-24T06:01:00Z"))).toEqual(["v|due"]);
    // An hour before fasting: only the fasting alert.
    expect(alertsReplacedByPush(plan, "s1", new Date("2026-11-23T20:02:00Z"))).toEqual(["s1|fast"]);
    expect(alertsReplacedByPush(plan, "s1", new Date("2026-11-23T06:05:00Z"))).toEqual(["s1|day"]);
    expect(alertsReplacedByPush(plan, "someone-else", now)).toEqual([]);
  });
});

describe("what my_care returns", () => {
  it("is read safely", () => {
    expect(parseCare(null)).toEqual({ pregnancies: [], surgeries: [] });
    const c = parseCare({ pregnancies: [{ id: "p", hospital_name: "City", status: "active_anc", edd: "2027-03-08", weeks_today: 24, days_extra: 3, visits: [{ visit_date: "2026-11-01", bp: "120/80", weight_kg: "70.5" }, {}], items: [{ id: "i", title: "Scan", kind: "weird" }, { id: "no-title" }] }], surgeries: [{ id: "x" }] });
    expect(c.pregnancies[0].visits).toEqual([{ visit_date: "2026-11-01", gestational_weeks: null, bp: "120/80", weight_kg: 70.5, fetal_heart_rate: null, next_visit_date: null }]);
    expect(c.pregnancies[0].items).toHaveLength(1);
    expect(c.pregnancies[0].items[0].kind).toBe("task");
    expect(c.surgeries).toEqual([]); // no date: not shown
  });
});
