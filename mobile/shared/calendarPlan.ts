// "Add to calendar": the order of things to try, kept apart from the phone so it can be
// tested. 1) the phone's own calendar screen; 2) write the event straight into the default
// calendar (asking for permission only now); 3) hand over an .ics file through the share
// sheet. Only when all three fail does the app say it couldn't open the calendar.

export interface CalendarEvent {
  /** Stable id of what this is (a visit, a care item, a surgery): used to avoid adding it twice. */
  ref: string;
  title: string;
  start: Date;
  end: Date;
  location?: string;
  notes?: string;
}

export type CalendarResult = "saved" | "added" | "already" | "shared" | "cancelled" | "failed";

export interface CalendarDeps {
  /** Opens the phone's calendar screen with the event filled in. Throws when no app can. */
  openEditor: (e: CalendarEvent) => Promise<"saved" | "cancelled">;
  /** Asks for calendar permission (the system prompt). */
  requestPermission: () => Promise<boolean>;
  /** The default calendar that can be written to, or null. */
  writableCalendarId: () => Promise<string | null>;
  /** Creates the event with a 1-hour-before alarm; returns its id. */
  createEvent: (calendarId: string, e: CalendarEvent) => Promise<string>;
  /** Writes an .ics file and opens the share sheet ("Save to calendar"). False when sharing is not possible. */
  shareIcs: (e: CalendarEvent) => Promise<boolean>;
  /** The event id remembered for this ref on the phone, if it was added directly before. */
  recall: (ref: string) => Promise<string | null>;
  remember: (ref: string, eventId: string) => Promise<void>;
  /** Development only: receives the error's code, never its message. */
  onError?: (step: "editor" | "direct" | "share", code: string) => void;
}

const codeOf = (e: unknown) => {
  const c = (e as { code?: unknown } | null)?.code;
  return typeof c === "string" && c ? c : "unknown";
};

export async function addEventToCalendar(e: CalendarEvent, d: CalendarDeps): Promise<CalendarResult> {
  // Added directly once already: don't add it again.
  try { if (await d.recall(e.ref)) return "already"; } catch { /* treat as not added */ }

  try {
    return await d.openEditor(e);
  } catch (err) {
    d.onError?.("editor", codeOf(err));
  }

  try {
    if (await d.requestPermission()) {
      const calendarId = await d.writableCalendarId();
      if (calendarId) {
        const id = await d.createEvent(calendarId, e);
        try { await d.remember(e.ref, id); } catch { /* the event is in the calendar all the same */ }
        return "added";
      }
    }
  } catch (err) {
    d.onError?.("direct", codeOf(err));
  }

  try {
    if (await d.shareIcs(e)) return "shared";
  } catch (err) {
    d.onError?.("share", codeOf(err));
  }
  return "failed";
}

/** What to tell the patient; null when they backed out themselves. */
export function calendarMessage(r: CalendarResult): { tone: "success" | "error" | "info"; text: string } | null {
  switch (r) {
    case "saved":
    case "added": return { tone: "success", text: "Added to your calendar" };
    case "already": return { tone: "info", text: "This is already in your calendar" };
    case "shared": return { tone: "info", text: "Choose your calendar app to save it" };
    case "failed": return { tone: "error", text: "We couldn't open your calendar" };
    default: return null;
  }
}

/** The first calendar the phone lets us write to: its primary one if it says so. */
export function pickWritableCalendar<T extends { id: string; allowsModifications?: boolean; isPrimary?: boolean; accessLevel?: string; source?: { isLocalAccount?: boolean } | null }>(
  calendars: readonly T[], defaultId?: string | null,
): string | null {
  const writable = calendars.filter((c) => c.allowsModifications !== false && (!c.accessLevel || ["owner", "editor", "contributor", "root"].includes(c.accessLevel)));
  if (!writable.length) return null;
  return (writable.find((c) => c.id === defaultId) ?? writable.find((c) => c.isPrimary) ?? writable[0]).id;
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/([,;])/g, "\\$1");

/** A one-event .ics file with a 1-hour-before alarm. */
export function icsFor(e: CalendarEvent, now: Date = new Date()): string {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//HealingNet//App//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.ref.replace(/[^A-Za-z0-9-]/g, "-")}@healingnet`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.notes ? [`DESCRIPTION:${esc(e.notes)}`] : []),
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:Reminder", "TRIGGER:-PT1H", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n");
}
