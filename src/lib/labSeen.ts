// "Seen by patient" on a finished lab result, for the ordering doctor and the hospital.
// lab_results.patient_viewed_at is set once, by the database, when the patient first opens
// the result in the app or on the website.
export function labSeenText(o: { status?: string | null; patient_viewed_at?: string | null } | null | undefined): string | null {
  if (!o || (o.status !== "completed" && o.status !== "final")) return null;
  return o.patient_viewed_at
    ? `Seen by patient on ${new Date(o.patient_viewed_at).toLocaleDateString()}`
    : "Not yet seen by patient";
}
