// Rate your visit: when a visit can be rated, and how a doctor's rating is written.
// The database (rate_appointment) has the final say; these only decide what the app offers.
import type { Appointment } from "./appointments";

export const RATING_WINDOW_DAYS = 30;

export interface VisitReview { rating: number; comment: string | null }

/**
 * A completed visit with a doctor can be rated for 30 days, counted (as the database does)
 * from when the visit was last updated, or from when it was made if it never was.
 */
export function canRateVisit(a: Pick<Appointment, "status" | "doctor_id" | "updated_at" | "created_at">, now: Date = new Date()): boolean {
  if (a.status !== "completed" || !a.doctor_id) return false;
  const stamp = a.updated_at ?? a.created_at;
  if (!stamp) return false;
  const t = new Date(stamp).getTime();
  return !Number.isNaN(t) && now.getTime() - t <= RATING_WINDOW_DAYS * 86_400_000;
}

/** "4.6 ★ (12 reviews)", "5.0 ★ (1 review)", or "New" when nobody has rated the doctor yet. */
export function ratingLabel(rating: number | string | null | undefined, reviewCount: number | null | undefined): string {
  const count = Number(reviewCount ?? 0);
  const value = Number(rating ?? 0);
  if (!count || count < 1 || !Number.isFinite(value) || value <= 0) return "New";
  return `${value.toFixed(1)} ★ (${count} review${count === 1 ? "" : "s"})`;
}

/** The same thing for a screen reader. */
export function ratingSpoken(rating: number | string | null | undefined, reviewCount: number | null | undefined): string {
  const label = ratingLabel(rating, reviewCount);
  if (label === "New") return "New, no ratings yet";
  const count = Number(reviewCount);
  return `Rated ${Number(rating).toFixed(1)} out of 5 from ${count} review${count === 1 ? "" : "s"}`;
}

/** "★★★★☆" for 4. */
export const stars = (rating: number) => "★".repeat(Math.max(0, Math.min(5, Math.round(rating)))) + "☆".repeat(5 - Math.max(0, Math.min(5, Math.round(rating))));
