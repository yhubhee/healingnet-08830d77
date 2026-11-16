import {
  aheadText, canLeaveQueue, checkinAppLink, checkinDetail, checkinHeadline, checkinUrl, cleanCheckinToken, currentCheckin, linkNotice,
  parseCheckinNotes, parseCheckinUrl, parseLookup, parseStatuses, queueLine, visitTodayLine,
} from "../shared/checkin";

const SITES = ["https://healingnet-08830d77.vercel.app"];
const TOKEN = "abcdefghjkmnp234";

describe("check-in links", () => {
  it("takes the token from our https link", () => {
    expect(parseCheckinUrl(`https://healingnet-08830d77.vercel.app/checkin/${TOKEN}`, SITES)).toBe(TOKEN);
    expect(parseCheckinUrl(`https://healingnet-08830d77.vercel.app/checkin/${TOKEN}/`, SITES)).toBe(TOKEN);
    expect(parseCheckinUrl(`https://www.healingnet-08830d77.vercel.app/checkin/${TOKEN}?utm=1`, SITES)).toBe(TOKEN);
    expect(parseCheckinUrl(`  https://HEALINGNET-08830d77.vercel.app/checkin/${TOKEN.toUpperCase()}  `, SITES)).toBe(TOKEN);
  });
  it("takes the token from the app link", () => {
    expect(parseCheckinUrl(`healingnet://checkin/${TOKEN}`, SITES)).toBe(TOKEN);
    expect(parseCheckinUrl(`healingnet:///checkin/${TOKEN}`, SITES)).toBe(TOKEN);
  });
  it("refuses everything that is not ours", () => {
    for (const bad of [
      `https://evil.example/checkin/${TOKEN}`,
      `http://healingnet-08830d77.vercel.app/checkin/${TOKEN}`, // not https
      `https://healingnet-08830d77.vercel.app.evil.example/checkin/${TOKEN}`,
      `https://healingnet-08830d77.vercel.app@evil.example/checkin/${TOKEN}`,
      `https://healingnet-08830d77.vercel.app/verify/${TOKEN}`,
      `https://healingnet-08830d77.vercel.app/checkin/${TOKEN}/extra`,
      "https://healingnet-08830d77.vercel.app/checkin/",
      "https://healingnet-08830d77.vercel.app/checkin/a b",
      "https://healingnet-08830d77.vercel.app/checkin/<script>",
      `otherapp://checkin/${TOKEN}`,
      "WIFI:S:Hospital;T:WPA;P:secret;;",
      "A1B2C3", // a "Share my records" code is not a check-in code
      "", null, undefined, 42,
    ]) expect(parseCheckinUrl(bad as never, SITES)).toBeNull();
  });
  it("accepts a code typed by hand, with spaces, dashes or capitals", () => {
    expect(cleanCheckinToken(" ABCD-efgh jkmn p234 ")).toBe(TOKEN);
    expect(cleanCheckinToken("short")).toBeNull();
    expect(cleanCheckinToken("has/slash/in/it!")).toBeNull();
    expect(cleanCheckinToken(null)).toBeNull();
  });
  it("builds the QR address and the app link", () => {
    expect(checkinUrl("https://site.example/", TOKEN)).toBe(`https://site.example/checkin/${TOKEN}`);
    expect(checkinAppLink(TOKEN)).toBe(`healingnet://checkin/${TOKEN}`);
    expect(parseCheckinUrl(checkinUrl(SITES[0], TOKEN), SITES)).toBe(TOKEN);
  });
});

describe("queue wording", () => {
  it("says how many people are ahead", () => {
    expect(aheadText(3)).toBe("3 people ahead of you");
    expect(aheadText(1)).toBe("1 person ahead of you");
    expect(aheadText(0)).toBe("You're next");
    expect(aheadText(-2)).toBe("You're next");
  });
  it("says \"It's your turn\" when called", () => {
    expect(checkinHeadline("called")).toBe("It's your turn");
    expect(checkinHeadline("checked_in")).toBe("You're checked in");
    expect(checkinHeadline("waiting")).toBe("You're checked in");
    expect(checkinHeadline("in_consultation")).toBe("You're with the doctor");
    expect(checkinDetail({ status: "checked_in", ahead: 3 })).toBe("3 people ahead of you. We'll notify you when it's your turn. Stay nearby.");
    expect(checkinDetail({ status: "called", ahead: 0 })).toBe("Please go to the front desk now.");
  });
  it("writes the Home card line", () => {
    const c = { status: "checked_in", ahead: 3, queue_number: 12, hospital_name: "City Hospital" };
    expect(queueLine(c)).toBe("Queue #12 at City Hospital · 3 ahead");
    expect(queueLine({ ...c, ahead: 0 })).toBe("Queue #12 at City Hospital · you're next");
    expect(queueLine({ ...c, status: "called" })).toBe("It's your turn at City Hospital");
  });
  it("only lets the patient leave before being called", () => {
    expect(canLeaveQueue({ status: "checked_in" })).toBe(true);
    expect(canLeaveQueue({ status: "waiting" })).toBe(true);
    expect(canLeaveQueue({ status: "called" })).toBe(false);
    expect(canLeaveQueue({ status: "in_consultation" })).toBe(false);
  });
  it("shows a called check-in first, and none when all are finished", () => {
    expect(currentCheckin([{ status: "waiting", id: 1 }, { status: "called", id: 2 }])).toEqual({ status: "called", id: 2 });
    expect(currentCheckin([{ status: "completed" }])).toBeNull();
    expect(currentCheckin([])).toBeNull();
  });
  it("words the confirm screen", () => {
    expect(visitTodayLine({ id: "a", requested_time: "10:30:00", doctor_name: "Dr Ade Obi" }, () => "10:30 am")).toBe("You have a visit today at 10:30 am with Dr Ade Obi.");
    expect(visitTodayLine({ id: "a", requested_time: null, doctor_name: null }, () => "")).toBe("You have a visit today.");
    expect(visitTodayLine(null, () => "")).toBeNull();
    expect(linkNotice("City Hospital")).toBe("City Hospital will be able to see your profile and health card so they can care for you.");
  });
});

describe("what the database returns", () => {
  it("reads a lookup safely", () => {
    expect(parseLookup(null)).toBeNull();
    expect(parseLookup({})).toBeNull();
    const l = parseLookup({ hospital_id: "h1", name: "City Hospital", city: "Uyo", state: "Akwa Ibom", logo_url: null, appointment_today: null, already_checked_in: { id: "c1", queue_number: 4, status: "waiting" }, already_linked: false });
    expect(l).toMatchObject({ hospital_id: "h1", name: "City Hospital", city: "Uyo", appointment_today: null, already_linked: false });
    expect(l!.already_checked_in).toEqual({ id: "c1", queue_number: 4, status: "waiting" });
  });
  it("reads today's check-ins safely", () => {
    expect(parseStatuses(null)).toEqual([]);
    expect(parseStatuses([{ checkin_id: "c1", hospital_name: "City", queue_number: 2, status: "called", ahead: 0, doctor_name: null, checkin_time: "2026-11-16T09:00:00Z" }, { nothing: 1 }])).toHaveLength(1);
  });
});

describe("the front desk's queue list", () => {
  it("tags app check-ins and shows the patient's reason", () => {
    expect(parseCheckinNotes("Checked in with the HealingNet app")).toEqual({ viaApp: true, reason: null });
    expect(parseCheckinNotes("Checked in with the HealingNet app. Reason: Fever since Monday. Also a cough")).toEqual({ viaApp: true, reason: "Fever since Monday. Also a cough" });
    expect(parseCheckinNotes("Walk-in, Reason: staff typed this")).toEqual({ viaApp: false, reason: null });
    expect(parseCheckinNotes(null)).toEqual({ viaApp: false, reason: null });
  });
});
