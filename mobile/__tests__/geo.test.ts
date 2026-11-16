import {
  addressLine, createLimitedFetch, directionsUrl, distanceKm, distanceShort, distanceText, inNigeria, matchState, reverseUrl, roundCoord,
  roundedPosition, searchUrl, sortByDistance, toPlace, validPin,
} from "../shared/geo";
import { NIGERIAN_STATES } from "../shared/patientProfile";

describe("the Nigeria bounds check", () => {
  it("accepts pins inside Nigeria", () => {
    expect(inNigeria(5.0377, 7.9128)).toBe(true); // Uyo
    expect(inNigeria(6.5244, 3.3792)).toBe(true); // Lagos
    expect(inNigeria(12.0022, 8.592)).toBe(true); // Kano
    expect(inNigeria(4, 2.5)).toBe(true);
    expect(inNigeria(14, 14.8)).toBe(true);
  });
  it("refuses pins outside, and anything that is not a number", () => {
    expect(inNigeria(51.5, -0.12)).toBe(false); // London
    expect(inNigeria(5.6, -0.19)).toBe(false); // Accra
    expect(inNigeria(3.99, 7)).toBe(false);
    expect(inNigeria(14.01, 7)).toBe(false);
    expect(inNigeria(9, 14.81)).toBe(false);
    expect(inNigeria(7.9128, 5.0377 + 20)).toBe(false);
    expect(inNigeria(NaN, 7)).toBe(false);
    expect(inNigeria(null, null)).toBe(false);
    expect(inNigeria("5", "7")).toBe(false);
  });
  it("reads a pin from numbers or number text", () => {
    expect(validPin(5.03, 7.91)).toEqual({ lat: 5.03, lng: 7.91 });
    expect(validPin("5.03", "7.91")).toEqual({ lat: 5.03, lng: 7.91 });
    expect(validPin(null, 7.91)).toBeNull();
    expect(validPin("", "")).toBeNull();
    expect(validPin(0, 0)).toBeNull();
  });
});

describe("state names from the map service", () => {
  it("matches them to Nigeria's names", () => {
    expect(matchState("Akwa Ibom State")).toBe("Akwa Ibom");
    expect(matchState("Federal Capital Territory")).toBe("FCT");
    expect(matchState("Abuja")).toBe("FCT");
    expect(matchState("Lagos")).toBe("Lagos");
    expect(matchState("lagos state")).toBe("Lagos");
    expect(matchState("Cross River State")).toBe("Cross River");
    expect(matchState("Nassarawa")).toBe("Nasarawa");
  });
  it("works with the profile form's own list (FCT is written differently there)", () => {
    expect(matchState("Federal Capital Territory", NIGERIAN_STATES)).toBe("FCT (Abuja)");
    expect(matchState("Akwa Ibom State", NIGERIAN_STATES)).toBe("Akwa Ibom");
  });
  it("gives nothing for a name it does not know", () => {
    expect(matchState("Greater Accra Region")).toBeNull();
    expect(matchState("State")).toBeNull();
    expect(matchState("")).toBeNull();
    expect(matchState(undefined)).toBeNull();
  });
});

describe("the address-search rate limit", () => {
  function setup() {
    let clock = 0;
    const calls: { url: string; at: number }[] = [];
    const fetcher = jest.fn(async (url: string) => { calls.push({ url, at: clock }); return [{ url }]; });
    const limited = createLimitedFetch({ fetcher, now: () => clock, sleep: async (ms) => { clock += ms; } });
    return { limited, calls, fetcher, tick: (ms: number) => { clock += ms; } };
  }
  it("never sends more than one request a second", async () => {
    const { limited, calls } = setup();
    await Promise.all([limited("a"), limited("b"), limited("c"), limited("d")]);
    expect(calls.map((c) => c.url)).toEqual(["a", "b", "c", "d"]);
    for (let i = 1; i < calls.length; i++) expect(calls[i].at - calls[i - 1].at).toBeGreaterThanOrEqual(1000);
  });
  it("does not wait when a second has already passed", async () => {
    const { limited, calls, tick } = setup();
    await limited("a");
    tick(5000);
    await limited("b");
    expect(calls[1].at).toBe(5000);
  });
  it("answers a repeated search from memory", async () => {
    const { limited, fetcher } = setup();
    const first = await limited("uyo");
    const again = await limited("uyo");
    expect(again).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("lets a failed search be tried again, and keeps going after it", async () => {
    let clock = 0; let fail = true;
    const fetcher = jest.fn(async () => { if (fail) { fail = false; throw new Error("down"); } return "ok"; });
    const limited = createLimitedFetch({ fetcher, now: () => clock, sleep: async (ms) => { clock += ms; } });
    await expect(limited("a")).rejects.toThrow("down");
    await expect(limited("a")).resolves.toBe("ok");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it("asks only for Nigeria, at most 5 results", () => {
    expect(searchUrl(" Ikot Ekpene Road, Uyo ")).toBe("https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ng&accept-language=en&q=Ikot%20Ekpene%20Road%2C%20Uyo");
    expect(reverseUrl({ lat: 5.03771234, lng: 7.9128 })).toContain("lat=5.03771&lon=7.91280");
  });
  it("turns a result into an address, city and state", () => {
    const p = toPlace({ lat: "5.0377", lon: "7.9128", display_name: "Ikot Ekpene Road, Uyo, Akwa Ibom State, Nigeria", address: { road: "Ikot Ekpene Road", city: "Uyo", state: "Akwa Ibom State", country: "Nigeria" } });
    expect(p).toEqual({ label: "Ikot Ekpene Road, Uyo, Akwa Ibom State, Nigeria", lat: 5.0377, lng: 7.9128, address: "Ikot Ekpene Road", city: "Uyo", state: "Akwa Ibom" });
    expect(toPlace({ lat: "51.5", lon: "-0.12", address: {} })).toBeNull(); // outside Nigeria
    expect(toPlace(null)).toBeNull();
  });
});

describe("the patient's own location", () => {
  it("is rounded to 2 decimal places (about 1 km) before it is sent", () => {
    expect(roundCoord(5.037712)).toBe(5.04);
    expect(roundCoord(7.912849)).toBe(7.91);
    expect(roundCoord(6.5)).toBe(6.5);
    expect(roundedPosition({ lat: 5.037712, lng: 7.912849 })).toEqual({ lat: 5.04, lng: 7.91 });
    // Never more precise than about 1.1 km.
    expect(String(roundCoord(9.123456789)).split(".")[1].length).toBeLessThanOrEqual(2);
  });
});

describe("directions and distance", () => {
  it("builds the Google Maps directions link", () => {
    expect(directionsUrl(5.0377, 7.9128)).toBe("https://www.google.com/maps/dir/?api=1&destination=5.0377,7.9128");
  });
  it("says the distance in words", () => {
    expect(distanceText(3.2)).toBe("about 3.2 km away");
    expect(distanceText("3.24")).toBe("about 3.2 km away");
    expect(distanceText(0.4)).toBe("less than 1 km away");
    expect(distanceText(123.4)).toBe("about 123 km away");
    expect(distanceText(null)).toBe("Distance unknown");
    expect(distanceText(undefined)).toBe("Distance unknown");
    expect(distanceShort(3.2)).toBe("3.2 km away");
    expect(distanceShort(null)).toBe("Distance unknown");
  });
  it("measures a straight line", () => {
    expect(distanceKm({ lat: 5.0377, lng: 7.9128 }, { lat: 5.0377, lng: 7.9128 })).toBe(0);
    const uyoToCalabar = distanceKm({ lat: 5.0377, lng: 7.9128 }, { lat: 4.9757, lng: 8.3417 });
    expect(uyoToCalabar).toBeGreaterThan(45);
    expect(uyoToCalabar).toBeLessThan(52);
  });
  it("sorts nearest first, with \"Distance unknown\" last", () => {
    const list = [
      { name: "No Pin B", distance_km: null }, { name: "Far", distance_km: 40 }, { name: "No Pin A", distance_km: undefined },
      { name: "Near", distance_km: 1.2 }, { name: "Text", distance_km: "7.5" },
    ];
    expect(sortByDistance(list).map((h) => h.name)).toEqual(["Near", "Text", "Far", "No Pin A", "No Pin B"]);
    expect(list[0].name).toBe("No Pin B"); // the original list is left alone
  });
  it("joins the address parts that exist", () => {
    expect(addressLine({ address: "12 Aka Road", city: "Uyo", state: "Akwa Ibom" })).toBe("12 Aka Road, Uyo, Akwa Ibom");
    expect(addressLine({ address: " ", city: "Uyo", state: null })).toBe("Uyo");
  });
});
