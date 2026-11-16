import { addEventToCalendar, calendarMessage, icsFor, pickWritableCalendar, type CalendarDeps, type CalendarEvent } from "../shared/calendarPlan";
import { callMayNavigate, callPageUrl, isDailyUrl, mayUseCamera, opensInBrowser } from "../shared/callNav";

const event: CalendarEvent = {
  ref: "visit:1", title: "HealingNet visit: Dr. Ade Obi", start: new Date("2026-11-24T08:00:00Z"), end: new Date("2026-11-24T08:30:00Z"),
  location: "City Hospital, Uyo", notes: "Booked on HealingNet.",
};

function deps(over: Partial<CalendarDeps> = {}) {
  const order: string[] = [];
  const saved = new Map<string, string>();
  const d: CalendarDeps = {
    openEditor: async () => { order.push("editor"); return "saved"; },
    requestPermission: async () => { order.push("permission"); return true; },
    writableCalendarId: async () => { order.push("calendar"); return "cal-1"; },
    createEvent: async () => { order.push("create"); return "event-9"; },
    shareIcs: async () => { order.push("share"); return true; },
    recall: async (ref) => saved.get(ref) ?? null,
    remember: async (ref, id) => { order.push("remember"); saved.set(ref, id); },
    ...over,
  };
  return { d, order, saved };
}
const noEditor = { openEditor: async () => { throw Object.assign(new Error("No Activity found to handle Intent"), { code: "ERR_ACTIVITY_NOT_FOUND" }); } };

describe("Add to calendar: the order of fallbacks", () => {
  it("opens the phone's calendar screen first, and stops there when it works", async () => {
    const { d, order } = deps();
    expect(await addEventToCalendar(event, d)).toBe("saved");
    expect(order).toEqual(["editor"]);
  });
  it("backing out of the calendar screen is not an error, and nothing else is tried", async () => {
    const { d, order } = deps({ openEditor: async () => "cancelled" });
    expect(await addEventToCalendar(event, d)).toBe("cancelled");
    expect(order).toEqual([]);
    expect(calendarMessage("cancelled")).toBeNull();
  });
  it("when no app answers: asks permission, picks the calendar, creates the event and remembers it", async () => {
    const { d, order, saved } = deps(noEditor);
    expect(await addEventToCalendar(event, d)).toBe("added");
    expect(order).toEqual(["permission", "calendar", "create", "remember"]);
    expect(saved.get("visit:1")).toBe("event-9");
    expect(calendarMessage("added")).toEqual({ tone: "success", text: "Added to your calendar" });
  });
  it("does not add the same thing twice", async () => {
    const { d, order } = deps(noEditor);
    await addEventToCalendar(event, d);
    order.length = 0;
    expect(await addEventToCalendar(event, d)).toBe("already");
    expect(order).toEqual([]);
  });
  it("permission refused: shares an .ics file instead", async () => {
    const { d, order } = deps({ ...noEditor, requestPermission: async () => { order.push("permission"); return false; } });
    expect(await addEventToCalendar(event, d)).toBe("shared");
    expect(order).toEqual(["permission", "share"]);
  });
  it("no writable calendar: shares an .ics file instead", async () => {
    const { d, order } = deps({ ...noEditor, writableCalendarId: async () => { order.push("calendar"); return null; } });
    expect(await addEventToCalendar(event, d)).toBe("shared");
    expect(order).toEqual(["permission", "calendar", "share"]);
  });
  it("creating the event fails: shares an .ics file instead", async () => {
    const { d, order } = deps({ ...noEditor, createEvent: async () => { order.push("create"); throw new Error("boom"); } });
    expect(await addEventToCalendar(event, d)).toBe("shared");
    expect(order).toEqual(["permission", "calendar", "create", "share"]);
  });
  it("says \"We couldn't open your calendar\" only when everything failed", async () => {
    const codes: string[] = [];
    const { d } = deps({
      ...noEditor, requestPermission: async () => false, shareIcs: async () => false,
      onError: (step, code) => codes.push(`${step}:${code}`),
    });
    expect(await addEventToCalendar(event, d)).toBe("failed");
    expect(calendarMessage("failed")).toEqual({ tone: "error", text: "We couldn't open your calendar" });
    // Development logging gets the error's code only, never its message.
    expect(codes).toEqual(["editor:ERR_ACTIVITY_NOT_FOUND"]);
    for (const r of ["saved", "added", "already", "shared", "cancelled"] as const) expect(calendarMessage(r)?.text).not.toBe("We couldn't open your calendar");
  });
  it("picks the default writable calendar: the given default, else the primary, else the first editable", () => {
    const cals = [
      { id: "holidays", allowsModifications: false }, { id: "work", allowsModifications: true, accessLevel: "read" },
      { id: "other", allowsModifications: true, accessLevel: "owner" }, { id: "main", allowsModifications: true, accessLevel: "owner", isPrimary: true },
    ];
    expect(pickWritableCalendar(cals)).toBe("main");
    expect(pickWritableCalendar(cals, "other")).toBe("other");
    expect(pickWritableCalendar(cals, "holidays")).toBe("main"); // the default must be writable
    expect(pickWritableCalendar(cals.slice(0, 3))).toBe("other");
    expect(pickWritableCalendar(cals.slice(0, 2))).toBeNull();
    expect(pickWritableCalendar([])).toBeNull();
  });
  it("writes an .ics file with a 1-hour-before alarm", () => {
    const ics = icsFor(event, new Date("2026-11-16T10:00:00Z"));
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("DTSTART:20261124T080000Z");
    expect(ics).toContain("DTEND:20261124T083000Z");
    expect(ics).toContain("SUMMARY:HealingNet visit: Dr. Ade Obi");
    expect(ics).toContain("LOCATION:City Hospital\\, Uyo");
    expect(ics).toContain("TRIGGER:-PT1H");
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("the call screen's allowed addresses", () => {
  const WEB = "https://healingnet-08830d77.vercel.app";
  it("allows Daily and our own site", () => {
    expect(callMayNavigate("https://healingnet.daily.co/abc123?t=token", WEB)).toBe(true);
    expect(callMayNavigate("https://c.daily.co/call-machine/versioned/x.js", WEB)).toBe(true);
    expect(callMayNavigate("https://daily.co/", WEB)).toBe(true);
    expect(callMayNavigate(`${WEB}/privacy`, WEB)).toBe(true);
    expect(callMayNavigate("about:blank", WEB)).toBe(true);
  });
  it("sends everything else to the browser", () => {
    for (const url of [
      "https://example.com/", "https://daily.co.evil.example/", "https://evildaily.co/", "http://healingnet.daily.co/room",
      "https://healingnet.daily.co@evil.example/", "https://healingnet-08830d77.vercel.app.evil.example/", "http://healingnet-08830d77.vercel.app/",
      "intent://scan/#Intent;scheme=zxing;end", "javascript:alert(1)", "file:///etc/hosts", "", null,
    ]) expect(callMayNavigate(url, WEB)).toBe(false);
    expect(opensInBrowser("https://example.com/")).toBe(true);
    expect(opensInBrowser("javascript:alert(1)")).toBe(false);
    expect(opensInBrowser("intent://x")).toBe(false);
  });
  it("grants the camera and microphone to Daily only", () => {
    expect(mayUseCamera("https://healingnet.daily.co")).toBe(true);
    expect(mayUseCamera("https://healingnet.daily.co/room")).toBe(true);
    expect(mayUseCamera(WEB)).toBe(false);
    expect(mayUseCamera("https://example.com")).toBe(false);
    expect(mayUseCamera(undefined)).toBe(false);
    expect(isDailyUrl("https://x.daily.co")).toBe(true);
  });
  it("builds the call page address from the room and token", () => {
    expect(callPageUrl("https://healingnet.daily.co/room-1", "tok.en+1")).toBe("https://healingnet.daily.co/room-1?t=tok.en%2B1");
    expect(callPageUrl("https://example.com/room-1", "t")).toBeNull();
    expect(callPageUrl("https://healingnet.daily.co/room-1", "")).toBeNull();
  });
});
