// "Add to calendar": opens the phone's own calendar screen with the visit filled in. The
// phone asks for calendar access (where it needs it) only at this moment, never earlier.
import * as Calendar from "expo-calendar";
import { doctorOrPending, type Appointment } from "@/shared/appointments";
import { appointmentStart } from "@/shared/dates";

export async function addToCalendar(a: Appointment): Promise<"saved" | "cancelled" | "failed"> {
  try {
    const start = appointmentStart(a.requested_date, a.requested_time);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const video = a.is_telemedicine === true;
    const result = await Calendar.createEventInCalendarAsync({
      title: `HealingNet visit: ${doctorOrPending(a)}`,
      startDate: start,
      endDate: end,
      location: video ? "Video visit (HealingNet)" : a.hospitals?.name ?? undefined,
      notes: video ? "Open HealingNet to join the call." : "Booked on HealingNet.",
    });
    return result.action === "canceled" ? "cancelled" : "saved";
  } catch {
    return "failed";
  }
}
