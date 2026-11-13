import { canRateVisit, ratingLabel, ratingSpoken, stars } from "../shared/reviews";

const now = new Date("2026-11-13T12:00:00Z");
const visit = (over: Record<string, unknown> = {}) => ({ status: "completed", doctor_id: "d1", updated_at: "2026-11-10T09:00:00Z", created_at: "2026-10-01T09:00:00Z", ...over });

describe("which visits can be rated", () => {
  it("completed visits with a doctor, for 30 days", () => {
    expect(canRateVisit(visit(), now)).toBe(true);
    expect(canRateVisit(visit({ updated_at: "2026-10-14T12:00:00Z" }), now)).toBe(true); // exactly 30 days
    expect(canRateVisit(visit({ updated_at: "2026-10-13T11:00:00Z" }), now)).toBe(false);
  });
  it("counts from when the visit was made if it was never updated", () => {
    expect(canRateVisit(visit({ updated_at: null, created_at: "2026-11-01T09:00:00Z" }), now)).toBe(true);
    expect(canRateVisit(visit({ updated_at: null, created_at: "2026-09-01T09:00:00Z" }), now)).toBe(false);
    expect(canRateVisit(visit({ updated_at: null, created_at: null }), now)).toBe(false);
  });
  it("nothing else", () => {
    for (const status of ["pending", "accepted", "confirmed", "rejected", "cancelled", "done"]) {
      expect(canRateVisit(visit({ status }), now)).toBe(false);
    }
    expect(canRateVisit(visit({ doctor_id: null }), now)).toBe(false);
  });
});

describe("a doctor's rating", () => {
  it("shows the average and how many reviews", () => {
    expect(ratingLabel(4.6, 12)).toBe("4.6 ★ (12 reviews)");
    expect(ratingLabel("5", 1)).toBe("5.0 ★ (1 review)");
    expect(ratingSpoken(4.6, 12)).toBe("Rated 4.6 out of 5 from 12 reviews");
  });
  it("shows New when nobody has rated the doctor", () => {
    expect(ratingLabel(0, 0)).toBe("New");
    expect(ratingLabel(4.8, 0)).toBe("New"); // an old rating with no reviews behind it
    expect(ratingLabel(null, null)).toBe("New");
    expect(ratingLabel(undefined, undefined)).toBe("New");
    expect(ratingSpoken(null, 0)).toBe("New, no ratings yet");
  });
  it("draws stars", () => {
    expect(stars(4)).toBe("★★★★☆");
    expect(stars(5)).toBe("★★★★★");
    expect(stars(1)).toBe("★☆☆☆☆");
  });
});
