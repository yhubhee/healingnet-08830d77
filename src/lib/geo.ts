// Copied from mobile/shared/geo.ts. Keep the two files the same.
// Hospital locations: the Nigeria bounds the database also enforces, state names, distance
// wording, the Directions link, and the two OpenStreetMap lookups (address search and
// pin -> address) behind one small rate-limited wrapper, so the provider can be swapped.
// No paid map service and no API key. The website's copy is src/lib/geo.ts.

export interface LatLng { lat: number; lng: number }

/** The same box the database checks for every pin. */
export const NIGERIA_BOUNDS = { minLat: 4, maxLat: 14, minLng: 2.5, maxLng: 14.8 } as const;
export const NIGERIA_CENTER: LatLng = { lat: 9.08, lng: 8.68 };
export const NIGERIA_ZOOM = 5.5;
export const OUTSIDE_NIGERIA = "That point is outside Nigeria. Put the pin on your hospital in Nigeria.";

export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
export const MAP_ATTRIBUTION = "OpenFreeMap © OpenMapTiles Data from OpenStreetMap";
export const SEARCH_ATTRIBUTION = "Address search by Nominatim © OpenStreetMap contributors";

const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function inNigeria(lat: unknown, lng: unknown): boolean {
  return finite(lat) && finite(lng)
    && lat >= NIGERIA_BOUNDS.minLat && lat <= NIGERIA_BOUNDS.maxLat && lng >= NIGERIA_BOUNDS.minLng && lng <= NIGERIA_BOUNDS.maxLng;
}

/** A pin the app can draw: both numbers present and inside Nigeria. */
export function validPin(lat: unknown, lng: unknown): LatLng | null {
  const a = typeof lat === "string" && lat.trim() ? Number(lat) : lat;
  const b = typeof lng === "string" && lng.trim() ? Number(lng) : lng;
  return inNigeria(a, b) ? { lat: a as number, lng: b as number } : null;
}

// ---- States -------------------------------------------------------------------------------
export const NIGERIAN_STATE_NAMES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta", "Ebonyi",
  "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos",
  "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
] as const;

const squash = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
const STATE_ALIASES: Record<string, string> = {
  federalcapitalterritory: "FCT", abuja: "FCT", abujafederalcapitalterritory: "FCT", fct: "FCT", fctabuja: "FCT",
  nassarawa: "Nasarawa", akwaibom: "Akwa Ibom", crossriver: "Cross River",
};

/**
 * A state name from a map service, matched to ours: "Akwa Ibom State" -> "Akwa Ibom",
 * "Federal Capital Territory" -> "FCT". Unknown names give null (the field stays as it is).
 */
export function matchState(name: unknown, states: readonly string[] = NIGERIAN_STATE_NAMES): string | null {
  if (typeof name !== "string" || !name.trim()) return null;
  const key = squash(name.replace(/\bstate\b/gi, ""));
  if (!key) return null;
  const wanted = STATE_ALIASES[key] ?? null;
  for (const s of states) {
    const k = squash(s.replace(/\bstate\b/gi, ""));
    if (k === key || (wanted && (s === wanted || STATE_ALIASES[k] === wanted))) return s;
  }
  return null;
}

// ---- The patient's own location -----------------------------------------------------------
/** 2 decimal places (about 1 km): all the database is ever sent. */
export const roundCoord = (n: number) => Math.round(n * 100) / 100;
export const roundedPosition = (p: LatLng): LatLng => ({ lat: roundCoord(p.lat), lng: roundCoord(p.lng) });

// ---- Distance -----------------------------------------------------------------------------
/** Straight-line distance in km. */
export function distanceKm(a: LatLng, b: LatLng): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "about 3.2 km away", "about 120 km away", "less than 1 km away"; "Distance unknown" without a pin. */
export function distanceText(km: number | string | null | undefined): string {
  const n = typeof km === "string" && km.trim() ? Number(km) : km;
  if (!finite(n) || n < 0) return "Distance unknown";
  if (n < 1) return "less than 1 km away";
  return `about ${n < 100 ? Math.round(n * 10) / 10 : Math.round(n)} km away`;
}
/** The short form for a tight card: "3.2 km away". */
export const distanceShort = (km: number | string | null | undefined) => distanceText(km).replace(/^about /, "");

/** Nearest first; hospitals whose distance is unknown go last, in name order. */
export function sortByDistance<T extends { distance_km?: number | string | null; name?: string | null }>(list: readonly T[]): T[] {
  const d = (h: T) => { const n = typeof h.distance_km === "string" ? Number(h.distance_km) : h.distance_km; return finite(n) ? n : null; };
  return [...list].sort((a, b) => {
    const x = d(a); const y = d(b);
    if (x === null && y === null) return (a.name ?? "").localeCompare(b.name ?? "");
    if (x === null) return 1;
    if (y === null) return -1;
    return x - y || (a.name ?? "").localeCompare(b.name ?? "");
  });
}

// ---- Directions ---------------------------------------------------------------------------
/** Opens Google Maps (or the phone's maps app) with directions to the pin. Free, no key. */
export const directionsUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/** "12 Aka Road, Uyo, Akwa Ibom" from whatever parts there are. */
export const addressLine = (h: { address?: string | null; city?: string | null; state?: string | null }) =>
  [h.address, h.city, h.state].map((p) => (p ?? "").trim()).filter(Boolean).join(", ");

// ---- Address search (Nominatim) -----------------------------------------------------------
export interface Place { label: string; lat: number; lng: number; address: string; city: string; state: string | null }

type Fetcher = (url: string) => Promise<unknown>;
export interface LimiterDeps { fetcher: Fetcher; now?: () => number; sleep?: (ms: number) => Promise<void>; minGapMs?: number; maxCache?: number }

/**
 * Wraps a fetch so it follows Nominatim's usage policy: at most one request a second (calls
 * queue up and wait their turn), and the same address is never asked for twice (answers are
 * kept in memory).
 */
export function createLimitedFetch({ fetcher, now = Date.now, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), minGapMs = 1000, maxCache = 200 }: LimiterDeps) {
  const cache = new Map<string, Promise<unknown>>();
  let last = -Infinity;
  let chain: Promise<unknown> = Promise.resolve();
  return (url: string): Promise<unknown> => {
    const hit = cache.get(url);
    if (hit) return hit;
    const run = chain.then(async () => {
      const wait = last + minGapMs - now();
      if (wait > 0) await sleep(wait);
      last = now();
      return fetcher(url);
    });
    chain = run.catch(() => {});
    cache.set(url, run);
    run.catch(() => cache.delete(url)); // a failure may be tried again
    if (cache.size > maxCache) cache.delete(cache.keys().next().value as string);
    return run;
  };
}

const NOMINATIM = "https://nominatim.openstreetmap.org";
const pickCity = (a: Record<string, unknown>) =>
  [a.city, a.town, a.village, a.municipality, a.suburb, a.county].find((v): v is string => typeof v === "string" && !!v.trim()) ?? "";
const pickStreet = (a: Record<string, unknown>) =>
  [[a.house_number, a.road].filter((v) => typeof v === "string" && v).join(" "), a.neighbourhood, a.suburb]
    .filter((v): v is string => typeof v === "string" && !!v.trim()).slice(0, 2).join(", ");

/** One Nominatim result -> a place, or null when it has no usable position in Nigeria. */
export function toPlace(raw: unknown): Place | null {
  const r = (raw && typeof raw === "object" ? raw : null) as Record<string, unknown> | null;
  if (!r) return null;
  const pin = validPin(r.lat, r.lon);
  if (!pin) return null;
  const a = (r.address && typeof r.address === "object" ? r.address : {}) as Record<string, unknown>;
  return {
    label: typeof r.display_name === "string" ? r.display_name : "", ...pin,
    address: pickStreet(a), city: pickCity(a), state: matchState(a.state) ?? matchState(a.city),
  };
}

export const searchUrl = (query: string) =>
  `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=5&countrycodes=ng&accept-language=en&q=${encodeURIComponent(query.trim())}`;
export const reverseUrl = (p: LatLng) =>
  `${NOMINATIM}/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=en&lat=${p.lat.toFixed(5)}&lon=${p.lng.toFixed(5)}`;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`map lookup failed (${res.status})`);
  return res.json();
}
let limited: ((url: string) => Promise<unknown>) | null = null;
const lookup = (url: string) => (limited ??= createLimitedFetch({ fetcher: getJson }))(url);

/** Up to 5 places in Nigeria for an address or area. Call it from a Search button or after a 1 s pause, never per key press. */
export async function searchPlaces(query: string): Promise<Place[]> {
  if (query.trim().length < 3) return [];
  const data = await lookup(searchUrl(query));
  return (Array.isArray(data) ? data : []).map(toPlace).filter((p): p is Place => !!p).slice(0, 5);
}

/** The street, city and state at a pin; null when the service has nothing there. */
export async function reversePlace(p: LatLng): Promise<Place | null> {
  const data = await lookup(reverseUrl(p));
  return toPlace({ ...(data as object), lat: p.lat, lon: p.lng });
}
