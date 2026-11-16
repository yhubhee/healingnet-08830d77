// "Add to calendar" for visits, care-plan items and procedures. The order of things to try
// is in shared/calendarPlan.ts: the phone's own calendar screen, then writing the event
// straight into the default calendar (permission is asked only then), then an .ics file
// through the share sheet.
//
// The functions come from "expo-calendar/legacy": since SDK 58 the same names imported from
// "expo-calendar" throw every time they are called, which is why 0.4 always said
// "We couldn't open your calendar".
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Calendar from "expo-calendar/legacy";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { doctorOrPending, type Appointment } from "@/shared/appointments";
import { addEventToCalendar, calendarMessage, icsFor, pickWritableCalendar, type CalendarDeps, type CalendarEvent, type CalendarResult } from "@/shared/calendarPlan";
import { appointmentStart } from "@/shared/dates";
import { addressLine } from "@/shared/geo";

export type { CalendarEvent, CalendarResult };

// Which things were written straight into the calendar on this phone (ids only, nothing
// about what they are), so the same one is not added twice.
const STORE_KEY = "hn.calendar-events";
const MAX_REMEMBERED = 200;
async function readMap(): Promise<Record<string, string>> {
  try { return JSON.parse((await AsyncStorage.getItem(STORE_KEY)) ?? "{}") as Record<string, string>; } catch { return {}; }
}

const deps: CalendarDeps = {
  async openEditor(e) {
    const result = await Calendar.createEventInCalendarAsync({ title: e.title, startDate: e.start, endDate: e.end, location: e.location, notes: e.notes });
    return result.action === "canceled" ? "cancelled" : "saved";
  },
  async requestPermission() {
    const { status } = await Calendar.requestCalendarPermissionsAsync();
    return status === "granted";
  },
  async writableCalendarId() {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    let defaultId: string | null = null;
    if (Platform.OS === "ios") { try { defaultId = (await Calendar.getDefaultCalendarAsync()).id; } catch { /* pick from the list */ } }
    return pickWritableCalendar(calendars, defaultId);
  },
  createEvent: (calendarId, e) => Calendar.createEventAsync(calendarId, {
    title: e.title, startDate: e.start, endDate: e.end, location: e.location, notes: e.notes, alarms: [{ relativeOffset: -60 }],
    timeZone: "Africa/Lagos",
  }),
  async shareIcs(e) {
    if (!(await Sharing.isAvailableAsync())) return false;
    const file = new File(Paths.cache, "healingnet-event.ics");
    file.create({ overwrite: true });
    file.write(icsFor(e));
    await Sharing.shareAsync(file.uri, { mimeType: "text/calendar", UTI: "com.apple.ical.ics", dialogTitle: "Save to calendar" });
    return true;
  },
  recall: async (ref) => (await readMap())[ref] ?? null,
  async remember(ref, eventId) {
    const entries = Object.entries({ ...(await readMap()), [ref]: eventId }).slice(-MAX_REMEMBERED);
    await AsyncStorage.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(entries)));
  },
  // Development only, and only the error's code: never an event's title or time.
  onError: __DEV__ ? (step, code) => console.log(`[calendar] ${step} failed: ${code}`) : undefined,
};

export const addToCalendar = (e: CalendarEvent): Promise<CalendarResult> => addEventToCalendar(e, deps);

/** Sign-out: forget what this phone added (the events themselves stay in the person's calendar). */
export const forgetCalendarEvents = () => AsyncStorage.removeItem(STORE_KEY).catch(() => {});

export function visitEvent(a: Appointment): CalendarEvent {
  const start = appointmentStart(a.requested_date, a.requested_time);
  const video = a.is_telemedicine === true;
  const place = a.hospitals ? [a.hospitals.name, addressLine(a.hospitals)].filter(Boolean).join(", ") : undefined;
  return {
    ref: `visit:${a.id}:${a.requested_date}:${a.requested_time ?? ""}`,
    title: `HealingNet visit: ${doctorOrPending(a)}`,
    start, end: new Date(start.getTime() + 30 * 60 * 1000),
    location: video ? "Video visit (HealingNet)" : place,
    notes: video ? "Open HealingNet to join the call." : "Booked on HealingNet.",
  };
}

/** Adds the event and tells the patient what happened. */
export async function addToCalendarWithToast(e: CalendarEvent, toast: { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void }): Promise<void> {
  const message = calendarMessage(await addToCalendar(e));
  if (message) toast[message.tone](message.text);
}
