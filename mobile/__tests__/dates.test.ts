import {
  addDays, appointmentStart, dayOfWeek, daysFromToday, fmt12, fmtDateTime, fmtDayDate, fmtLongDate, fmtRemaining, halfHours,
  lagosNowTime, lagosToday, timeAgo,
} from "../shared/dates";

// These must hold whatever time zone the phone (or the test machine) is set to.
describe("dates in Africa/Lagos (UTC+1, no daylight saving)", () => {
  it("knows today's date in Lagos just before and after Lagos midnight", () => {
    expect(lagosToday(new Date("2026-11-12T22:59:59Z"))).toBe("2026-11-12");
    expect(lagosToday(new Date("2026-11-12T23:00:00Z"))).toBe("2026-11-13");
    expect(lagosToday(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });

  it("knows the time in Lagos", () => {
    expect(lagosNowTime(new Date("2026-11-12T13:05:00Z"))).toBe("14:05");
    expect(lagosNowTime(new Date("2026-06-12T23:45:00Z"))).toBe("00:45");
  });

  it("formats a calendar date without shifting it", () => {
    expect(fmtLongDate("2026-10-15")).toBe("15 Oct 2026");
    expect(fmtLongDate("2026-01-01")).toBe("1 Jan 2026");
    expect(fmtDayDate("2026-10-15")).toBe("Thu 15 Oct 2026");
  });

  it("formats a timestamp in Lagos time", () => {
    expect(fmtLongDate("2026-10-15T23:30:00Z")).toBe("16 Oct 2026");
    expect(fmtDateTime("2026-10-15T13:05:00Z")).toBe("15 Oct 2026, 2:05 pm");
    expect(fmtDateTime("2026-10-15T23:30:00+00:00")).toBe("16 Oct 2026, 12:30 am");
  });

  it("shows a dash for missing or broken dates", () => {
    expect(fmtLongDate(null)).toBe("—");
    expect(fmtLongDate(undefined)).toBe("—");
    expect(fmtLongDate("not a date")).toBe("—");
    expect(fmtDateTime("")).toBe("—");
  });

  it("formats clock times", () => {
    expect(fmt12("09:30")).toBe("9:30 am");
    expect(fmt12("09:30:00")).toBe("9:30 am");
    expect(fmt12("00:00")).toBe("12:00 am");
    expect(fmt12("12:00")).toBe("12:00 pm");
    expect(fmt12("17:05")).toBe("5:05 pm");
    expect(fmt12(null)).toBe("");
  });

  it("treats an appointment's date and time as Lagos time", () => {
    expect(appointmentStart("2026-11-20", "09:30:00").toISOString()).toBe("2026-11-20T08:30:00.000Z");
    expect(appointmentStart("2026-11-20", "00:30").toISOString()).toBe("2026-11-19T23:30:00.000Z");
  });

  it("does date arithmetic on calendar dates", () => {
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(dayOfWeek("2026-10-15")).toBe(4);
    expect(daysFromToday("2026-11-15", new Date("2026-11-12T23:30:00Z"))).toBe(2);
    expect(daysFromToday("2026-11-12", new Date("2026-11-12T10:00:00Z"))).toBe(0);
  });

  it("builds half-hour slots like the website", () => {
    expect(halfHours("08:00", "10:00")).toEqual(["08:00", "08:30", "09:00", "09:30"]);
    expect(halfHours("08:00", "17:00")).toHaveLength(18);
    expect(halfHours("09:15", "09:30")).toEqual([]);
  });

  it("formats countdowns and ages", () => {
    expect(fmtRemaining(15 * 60 * 1000)).toBe("15:00");
    expect(fmtRemaining(61_000)).toBe("1:01");
    expect(fmtRemaining(-5)).toBe("0:00");
    const now = new Date("2026-11-12T12:00:00Z");
    expect(timeAgo("2026-11-12T11:59:40Z", now)).toBe("Just now");
    expect(timeAgo("2026-11-12T11:15:00Z", now)).toBe("45 min ago");
    expect(timeAgo("2026-11-12T07:00:00Z", now)).toBe("5h ago");
    expect(timeAgo("2026-11-09T12:00:00Z", now)).toBe("3d ago");
  });
});
