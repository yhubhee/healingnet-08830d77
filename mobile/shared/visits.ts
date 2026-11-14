// Visits from my_visits(): every open visit plus the latest past ones, each already
// carrying its doctor, hospital and the patient's rating. Older past visits are loaded a
// page at a time by "Show older visits".
import type { Appointment } from "./appointments";

export const VISITS_PAGE = 30;

export interface VisitsData {
  upcoming: Appointment[];
  past: Appointment[];
  has_more_past: boolean;
}

export const EMPTY_VISITS: VisitsData = { upcoming: [], past: [], has_more_past: false };

/** What my_visits() returned, made safe to use (a missing list is an empty one). */
export function parseVisits(raw: unknown): VisitsData {
  const v = (raw ?? {}) as Partial<VisitsData>;
  return {
    upcoming: Array.isArray(v.upcoming) ? v.upcoming : [],
    past: Array.isArray(v.past) ? v.past : [],
    has_more_past: v.has_more_past === true,
  };
}

const newestFirst = (a: Appointment, b: Appointment) =>
  `${b.requested_date} ${b.requested_time ?? ""}`.localeCompare(`${a.requested_date} ${a.requested_time ?? ""}`) || b.id.localeCompare(a.id);

/**
 * The Past list: the latest page (always fresh from the server) followed by the older
 * pages loaded so far. A visit never appears twice: if one is in both, the fresh copy
 * wins. A visit that is open again (in `upcoming`) is left out of the older pages.
 */
export function mergePast(latest: readonly Appointment[], older: readonly Appointment[], upcoming: readonly Appointment[] = []): Appointment[] {
  const seen = new Set<string>([...latest, ...upcoming].map((a) => a.id));
  const rest: Appointment[] = [];
  for (const a of older) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    rest.push(a);
  }
  return [...latest, ...rest.sort(newestFirst)];
}

/** Adds one more loaded page to the older ones, without duplicates. */
export function addOlderPage(older: readonly Appointment[], page: readonly Appointment[]): Appointment[] {
  const seen = new Set(older.map((a) => a.id));
  return [...older, ...page.filter((a) => !seen.has(a.id) && (seen.add(a.id), true))];
}

/** How many past visits to skip for the next page: everything shown so far. */
export const nextPastOffset = (latest: readonly Appointment[], older: readonly Appointment[]) => mergePast(latest, older).length;

/** Every visit the app holds for a person, for looking one up by id (a call to join). */
export const allVisits = (v: VisitsData | undefined, older: readonly Appointment[] = []): Appointment[] =>
  v ? [...v.upcoming, ...mergePast(v.past, older, v.upcoming)] : [];
