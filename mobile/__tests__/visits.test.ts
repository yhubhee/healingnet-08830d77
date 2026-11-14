import type { Appointment } from "../shared/appointments";
import { addOlderPage, allVisits, mergePast, nextPastOffset, parseVisits, VISITS_PAGE } from "../shared/visits";

const visit = (id: string, date: string, status = "completed"): Appointment => ({
  id, patient_id: "p1", doctor_id: null, hospital_id: null, requested_date: date, requested_time: "09:00", status,
  reason: null, is_telemedicine: false, decline_reason: null, doctors: null, hospitals: null, review: null,
});
const page = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => visit(`v${from + i}`, `2026-${String(12 - Math.floor((from + i) / 28)).padStart(2, "0")}-${String(28 - ((from + i) % 28)).padStart(2, "0")}`));
const ids = (list: Appointment[]) => list.map((a) => a.id);

describe("Visits paging", () => {
  it("my_visits is read safely", () => {
    expect(parseVisits(null)).toEqual({ upcoming: [], past: [], has_more_past: false });
    expect(parseVisits({ upcoming: [visit("u", "2026-12-01", "pending")], past: "x", has_more_past: true }))
      .toEqual({ upcoming: [visit("u", "2026-12-01", "pending")], past: [], has_more_past: true });
  });

  it("Show older adds the next page after the latest one", () => {
    const latest = page(0, VISITS_PAGE);
    const older = addOlderPage([], page(30, 30));
    const merged = mergePast(latest, older);
    expect(merged).toHaveLength(60);
    expect(ids(merged).slice(0, 30)).toEqual(ids(latest));
    expect(nextPastOffset(latest, older)).toBe(60);
  });

  it("never shows a visit twice when pages overlap", () => {
    const latest = page(0, 30);
    // A visit was completed between the two requests, so the second page starts one early.
    const older = addOlderPage([], page(29, 30));
    const merged = mergePast(latest, older);
    expect(new Set(ids(merged)).size).toBe(merged.length);
    expect(merged).toHaveLength(59);
    // Loading the same page again changes nothing.
    expect(addOlderPage(older, page(29, 30))).toHaveLength(older.length);
    expect(addOlderPage(older, page(50, 30))).toHaveLength(51);
  });

  it("a refresh keeps the older pages, and the fresh copy of a visit wins", () => {
    const older = addOlderPage([], page(30, 30));
    const stale = { ...page(30, 1)[0], reason: "old copy" };
    const fresh = { ...stale, reason: "fresh copy" };
    const latest = [...page(0, 29), fresh];
    const merged = mergePast(latest, [stale, ...older]);
    expect(merged.filter((a) => a.id === fresh.id)).toEqual([fresh]);
    expect(new Set(ids(merged)).size).toBe(merged.length);
  });

  it("a visit that is open again leaves the older pages", () => {
    const reopened = visit("v40", "2026-12-20", "pending");
    const merged = mergePast(page(0, 30), page(30, 30), [reopened]);
    expect(ids(merged)).not.toContain("v40");
    const all = allVisits({ upcoming: [reopened], past: page(0, 30), has_more_past: true }, page(30, 30));
    expect(all.filter((a) => a.id === "v40")).toEqual([reopened]);
    expect(all).toHaveLength(60);
  });

  it("older pages stay newest first however they arrive", () => {
    const merged = mergePast(page(0, 5), [...page(40, 5), ...page(10, 5)]);
    const dates = merged.map((a) => a.requested_date);
    expect(dates).toEqual([...dates].sort().reverse());
  });
});
