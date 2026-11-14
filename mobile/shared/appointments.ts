// Appointment wording and grouping. The status text is exactly what the website shows
// (src/pages/patient/Appointments.tsx).

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  hospital_id: string | null;
  requested_date: string;
  requested_time: string | null;
  status: string;
  reason: string | null;
  is_telemedicine: boolean | null;
  decline_reason: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** Set when the doctor joins the video call, and when the call ends. */
  call_started_at?: string | null;
  call_ended_at?: string | null;
  doctors: { id?: string; first_name: string; last_name: string; specialty: string | null } | null;
  hospitals: { id?: string; name: string } | null;
  /** The patient's own rating of this visit (from my_visits); null when not rated. */
  review?: { rating: number; comment: string | null } | null;
}

type StatusInput = Pick<Appointment, "status" | "decline_reason"> & { doctors?: Appointment["doctors"] };

export const doctorName = (a: { doctors?: Appointment["doctors"] }) =>
  a.doctors ? `Dr. ${a.doctors.first_name} ${a.doctors.last_name}` : null;

export const doctorOrPending = (a: { doctors?: Appointment["doctors"] }) => doctorName(a) ?? "Doctor to be assigned";

/** The status in plain words, as the patient should read it. */
export function statusText(a: StatusInput): string {
  const doctor = doctorName(a);
  switch (a.status) {
    case "pending": return "Waiting for the hospital to confirm";
    case "accepted":
    case "confirmed": return doctor ? `Confirmed with ${doctor}` : "Confirmed";
    case "rejected": return a.decline_reason ? `Declined: ${a.decline_reason}` : "Declined";
    case "completed":
    case "done": return "Completed";
    case "cancelled": return "Cancelled";
    default: return a.status;
  }
}

export type Tone = "success" | "warning" | "danger" | "neutral";

/** Colour family for a status chip. The chip always shows statusText as well. */
export function statusTone(status: string): Tone {
  if (status === "pending") return "warning";
  if (status === "accepted" || status === "confirmed") return "success";
  if (status === "rejected") return "danger";
  return "neutral";
}

export const UPCOMING_STATUSES = ["pending", "accepted", "confirmed"];
export const isUpcoming = (a: Pick<Appointment, "status">) => UPCOMING_STATUSES.includes(a.status);

/** The database lets a patient cancel a pending or accepted booking. */
export const canCancel = (a: Pick<Appointment, "status">) => a.status === "pending" || a.status === "accepted";
export const canJoinCall = (a: Pick<Appointment, "status" | "is_telemedicine">) =>
  a.is_telemedicine === true && (a.status === "accepted" || a.status === "confirmed");

/** The doctor has joined the video call and it has not ended. */
export const doctorIsInCall = (a: Pick<Appointment, "status" | "is_telemedicine" | "call_started_at" | "call_ended_at">) =>
  canJoinCall(a) && !!a.call_started_at && !a.call_ended_at;

/**
 * The visit a "Your doctor is ready" notification is about: the one it names, if it can
 * still be joined; otherwise (a push names none) the visit whose doctor is in the call now.
 */
export function pickCallToJoin<T extends Pick<Appointment, "id" | "status" | "is_telemedicine" | "call_started_at" | "call_ended_at">>(list: T[], join: string): T | null {
  return list.find((a) => a.id === join && canJoinCall(a) && !a.call_ended_at) ?? (join === "ready" ? list.find(doctorIsInCall) ?? null : null);
}

/** Upcoming visits, soonest first: the first one is the Home card's "next appointment". */
export function sortUpcoming<T extends Pick<Appointment, "requested_date" | "requested_time" | "status">>(list: T[]): T[] {
  const key = (a: T) => `${a.requested_date}T${a.requested_time ?? "00:00"}`;
  return list.filter(isUpcoming).sort((a, b) => key(a).localeCompare(key(b)));
}
