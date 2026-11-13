import {
  activeReminders, cleanTimes, dosesFor, endDate, MAX_SCHEDULED, parseDurationDays, planSchedule, pruneTaken, reminderText, suggestTimes,
  todaysDoses, topUp, type Reminder,
} from "../shared/reminders";

describe("frequency -> reminder times", () => {
  const times = (f: string | null) => suggestTimes(f).times;

  it("once daily -> 8:00", () => {
    for (const f of ["Once daily", "once a day", "OD", "1 time daily", "Daily", "1x daily", "one tablet every day", "every 24 hours"]) {
      expect(times(f)).toEqual(["08:00"]);
    }
  });
  it("twice -> 8:00 and 20:00", () => {
    for (const f of ["Twice daily", "twice a day", "BD", "b.d.", "BID", "2 times daily", "2x daily", "two times a day", "every 12 hours", "12 hourly"]) {
      expect(times(f)).toEqual(["08:00", "20:00"]);
    }
  });
  it("3 times -> 8:00, 14:00 and 20:00", () => {
    for (const f of ["3 times daily", "three times a day", "TDS", "t.d.s", "TID", "thrice daily", "3x daily"]) {
      expect(times(f)).toEqual(["08:00", "14:00", "20:00"]);
    }
  });
  it("every 8 hours -> 6:00, 14:00 and 22:00", () => {
    for (const f of ["Every 8 hours", "every 8 hrs", "8 hourly", "8-hourly", "q8h"]) {
      expect(times(f)).toEqual(["06:00", "14:00", "22:00"]);
    }
  });
  it("when needed -> no reminders", () => {
    for (const f of ["When needed", "as needed", "PRN", "Twice daily when needed", "as required for pain"]) {
      expect(suggestTimes(f)).toEqual({ kind: "as_needed", times: [] });
    }
  });
  it("unknown text -> no reminders", () => {
    for (const f of ["", null, "see the leaflet", "with food", "4 times daily", "QDS", "every 6 hours", "weekly", "stat"]) {
      expect(suggestTimes(f)).toEqual({ kind: "unknown", times: [] });
    }
  });
  it("says which suggestions are real schedules", () => {
    expect(suggestTimes("Twice daily").kind).toBe("scheduled");
    expect(suggestTimes("at night").times).toEqual(["21:00"]);
  });
});

describe("duration", () => {
  it("reads days, weeks and months", () => {
    expect(parseDurationDays("5 days")).toBe(5);
    expect(parseDurationDays("for 2 weeks")).toBe(14);
    expect(parseDurationDays("1 month")).toBe(30);
    expect(parseDurationDays("7/7")).toBe(7);
    expect(parseDurationDays("2/52")).toBe(14);
    expect(parseDurationDays("10d")).toBe(10);
  });
  it("gives nothing for text it cannot read", () => {
    expect(parseDurationDays("until finished")).toBeNull();
    expect(parseDurationDays("")).toBeNull();
    expect(parseDurationDays(null)).toBeNull();
    expect(parseDurationDays("0 days")).toBeNull();
  });
});

const reminder = (over: Partial<Reminder> = {}): Reminder => ({
  id: "rx1", documentId: "doc1", drug: "Amoxicillin", dose: "500mg", times: ["08:00", "14:00", "20:00"], startDate: "2026-11-13", days: 5, ...over,
});
const at = (date: string, time: string) => { const [y, m, d] = date.split("-").map(Number); const [h, mi] = time.split(":").map(Number); return new Date(y, m - 1, d, h, mi); };

describe("doses", () => {
  it("run from the first day until the duration ends", () => {
    const doses = dosesFor(reminder());
    expect(doses).toHaveLength(15);
    expect(doses[0].key).toBe("rx1|2026-11-13|08:00");
    expect(doses[14].key).toBe("rx1|2026-11-17|20:00");
    expect(endDate(reminder())).toBe("2026-11-17");
    expect(doses[0].at).toBe(at("2026-11-13", "08:00").getTime());
  });
  it("cross a month end correctly", () => {
    expect(endDate(reminder({ startDate: "2026-11-29", days: 4 }))).toBe("2026-12-02");
  });
  it("ignore bad or repeated times", () => {
    expect(cleanTimes(["20:00", "08:00", "08:00", "25:00", "8am"])).toEqual(["08:00", "20:00"]);
  });
  it("today's medicines are today's doses only, in order", () => {
    const list = todaysDoses([reminder(), reminder({ id: "rx2", drug: "Paracetamol", times: ["09:00"], startDate: "2026-11-10", days: 10 })], at("2026-11-14", "10:00"));
    expect(list.map((d) => `${d.time} ${d.drug}`)).toEqual(["08:00 Amoxicillin", "09:00 Paracetamol", "14:00 Amoxicillin", "20:00 Amoxicillin"]);
  });
  it("a finished course is no longer active, but its last day still is", () => {
    expect(activeReminders([reminder()], at("2026-11-17", "23:00"))).toHaveLength(1);
    expect(activeReminders([reminder()], at("2026-11-18", "00:30"))).toHaveLength(0);
  });
});

describe("the 60-reminder cap and top-up", () => {
  // Three medicines, three times a day for 30 days: 270 doses.
  const many = ["a", "b", "c"].map((id) => reminder({ id, drug: `Drug ${id}`, days: 30 }));

  it("never schedules more than 60, and picks the soonest", () => {
    const plan = planSchedule(many, at("2026-11-13", "07:00"));
    expect(plan).toHaveLength(MAX_SCHEDULED);
    expect(plan[0].date).toBe("2026-11-13");
    expect(plan[0].time).toBe("08:00");
    // 9 doses a day: 60 doses reach into the 7th day and no further.
    expect(plan[59].date).toBe("2026-11-19");
    expect(plan.every((d, i) => i === 0 || plan[i - 1].at <= d.at)).toBe(true);
  });
  it("leaves out doses already past and doses ticked as taken", () => {
    const now = at("2026-11-13", "15:00");
    const plan = planSchedule(many, now, { "a|2026-11-13|20:00": 1 });
    expect(plan.every((d) => d.at > now.getTime())).toBe(true);
    expect(plan.find((d) => d.key === "a|2026-11-13|20:00")).toBeUndefined();
    expect(plan[0].key).toBe("b|2026-11-13|20:00");
  });
  it("tops up when the app opens later: passed doses go, new ones are added, the total stays at 60", () => {
    const first = planSchedule(many, at("2026-11-13", "07:00"));
    const later = planSchedule(many, at("2026-11-15", "07:00"));
    const { cancel, add } = topUp(first.map((d) => d.key), later);
    expect(later).toHaveLength(MAX_SCHEDULED);
    expect(add).toHaveLength(18); // two days' worth (9 a day) have passed
    expect(add.every((d) => d.date >= "2026-11-19")).toBe(true);
    // The phone has already fired the passed ones; the plan no longer wants them.
    expect(cancel).toHaveLength(18);
    expect(cancel.every((k) => k.split("|")[1] < "2026-11-15")).toBe(true);
  });
  it("changes nothing when the phone already holds the plan", () => {
    const plan = planSchedule(many, at("2026-11-13", "07:00"));
    expect(topUp(plan.map((d) => d.key), plan)).toEqual({ cancel: [], add: [] });
  });
  it("schedules everything for a short course, and nothing once it is over", () => {
    expect(planSchedule([reminder()], at("2026-11-13", "07:00"))).toHaveLength(15);
    expect(planSchedule([reminder()], at("2026-11-18", "07:00"))).toHaveLength(0);
    expect(planSchedule([], at("2026-11-13", "07:00"))).toEqual([]);
  });
  it("removing a reminder cancels its doses", () => {
    const plan = planSchedule([reminder(), reminder({ id: "rx2", days: 2 })], at("2026-11-13", "07:00"));
    const { cancel, add } = topUp(plan.map((d) => d.key), planSchedule([reminder()], at("2026-11-13", "07:00")));
    expect(add).toEqual([]);
    expect(cancel).toHaveLength(6);
    expect(cancel.every((k) => k.startsWith("rx2|"))).toBe(true);
  });
});

describe("what the lock screen says", () => {
  it("never names the medicine unless Show details is on", () => {
    expect(reminderText({ drug: "Amoxicillin", dose: "500mg" }, false)).toEqual({ title: "Time for your medicine", body: "Open HealingNet to see which one." });
    expect(reminderText({ drug: "Amoxicillin", dose: "500mg" }, true)).toEqual({ title: "Time for your medicine", body: "Amoxicillin · 500mg" });
    expect(reminderText({ drug: "Amoxicillin", dose: null }, true).body).toBe("Amoxicillin");
  });
  it("forgets old Taken ticks after a week", () => {
    const kept = pruneTaken({ "a|2026-11-01|08:00": 1, "a|2026-11-12|08:00": 1 }, at("2026-11-13", "09:00"));
    expect(Object.keys(kept)).toEqual(["a|2026-11-12|08:00"]);
  });
});
