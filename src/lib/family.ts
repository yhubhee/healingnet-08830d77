// Family profiles: everything that can be worked out without the phone or the network.
// Ages, the adult-permission rule, the "nearly an adult" note, who a notification is about,
// and the wording shared by the website and the app (mobile/shared/family.ts is the same
// file below this comment; keep the two the same).

/** One row of my_family(), plus whether an adult's permission was recorded. */
export interface FamilyMember {
  patient_id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  relationship: string;
  age: number;
  is_adult: boolean;
  linked_hospitals: number;
  added_at: string;
  /** From patient_guardians.consent_confirmed_at; undefined when it could not be read. */
  has_permission?: boolean;
}

export const MAX_FAMILY = 10;
export const ADULT_AGE = 18;

export const RELATIONSHIPS = [
  { value: "child", label: "Child" },
  { value: "parent", label: "Parent" },
  { value: "spouse", label: "Husband or wife" },
  { value: "sibling", label: "Brother or sister" },
  { value: "grandparent", label: "Grandparent" },
  { value: "grandchild", label: "Grandchild" },
  { value: "other", label: "Other" },
] as const;

export const relationshipLabel = (value: string | null | undefined) =>
  RELATIONSHIPS.find((r) => r.value === value)?.label ?? "Family member";

const DATE = /^(\d{4})-(\d{2})-(\d{2})/;
function ymd(iso: string | null | undefined): [number, number, number] | null {
  const m = DATE.exec(iso ?? "");
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/**
 * Whole years between a "YYYY-MM-DD" date of birth and "today", by the calendar: the age
 * goes up on the birthday itself, never a day early or late (the database counts the same way).
 */
export function ageOn(dob: string | null | undefined, today: string): number | null {
  const b = ymd(dob);
  const t = ymd(today);
  if (!b || !t) return null;
  let age = t[0] - b[0];
  if (t[1] < b[1] || (t[1] === b[1] && t[2] < b[2])) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

/** 18 or over on that day: the guardian must confirm they have this person's permission. */
export function needsPermission(dob: string | null | undefined, today: string): boolean {
  const age = ageOn(dob, today);
  return age !== null && age >= ADULT_AGE;
}

/** Whole days from "today" until the 18th birthday; 0 or less once it has come. */
export function daysUntil18(dob: string | null | undefined, today: string): number | null {
  const b = ymd(dob);
  const t = ymd(today);
  if (!b || !t) return null;
  const birthday = Date.UTC(b[0] + ADULT_AGE, b[1] - 1, b[2]);
  return Math.round((birthday - Date.UTC(t[0], t[1] - 1, t[2])) / 86_400_000);
}

/** "6", "Under 1", or "" when the age is unknown. */
export function ageText(age: number | null | undefined): string {
  if (age === null || age === undefined) return "";
  return age < 1 ? "Under 1" : String(age);
}

/** "Tobi (6)" for the booking line and the switcher. */
export function personWithAge(firstName: string, age: number | null | undefined): string {
  const a = ageText(age);
  return a ? `${firstName} (${a})` : firstName;
}

export const permissionLabel = (firstName: string) =>
  `I have ${firstName.trim() || "this person"}'s permission to manage their health care on HealingNet.`;

export const removeExplanation = (firstName: string) =>
  `${firstName} will be removed from your account. Open appointments are cancelled. If a hospital has treated ${firstName}, that hospital keeps its records.`;

export const DELETE_FAMILY_LINE = "Your family members will be removed too, except records hospitals keep.";

/**
 * The gentle note on a family member's profile: shown when they are 17 and within 90 days
 * of turning 18, or already 18 or over with no permission on record. Nothing to do yet.
 */
export function turning18Note(
  m: { first_name: string; date_of_birth: string | null | undefined; has_permission?: boolean }, today: string,
): string | null {
  const age = ageOn(m.date_of_birth, today);
  if (age === null) return null;
  const tail = "Soon they'll be able to manage their own HealingNet account.";
  if (age >= ADULT_AGE) return m.has_permission === false ? `${m.first_name} is an adult. ${tail}` : null;
  const days = daysUntil18(m.date_of_birth, today);
  if (age === ADULT_AGE - 1 && days !== null && days <= 90) return `${m.first_name} is nearly an adult. ${tail}`;
  return null;
}

// ---- The add form -----------------------------------------------------------------------
export interface FamilyForm {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  gender: string;
  relationship: string;
  consent: boolean;
}
export const EMPTY_FAMILY_FORM: FamilyForm = { first_name: "", last_name: "", date_of_birth: "", gender: "", relationship: "", consent: false };
export type FamilyErrors = Partial<Record<keyof FamilyForm, string>>;

/** The same checks the database makes, with the same words, so most mistakes show before sending. */
export function validateFamilyForm(f: FamilyForm, today: string): FamilyErrors {
  const e: FamilyErrors = {};
  if (!f.first_name.trim()) e.first_name = "Enter their first name";
  if (!f.last_name.trim()) e.last_name = "Enter their last name";
  if (!f.date_of_birth) e.date_of_birth = "Enter their date of birth";
  else if (f.date_of_birth > today) e.date_of_birth = "Date of birth cannot be in the future";
  else if (f.date_of_birth < "1900-01-01") e.date_of_birth = "Check the date of birth";
  if (!f.gender) e.gender = "Choose their sex";
  if (!f.relationship) e.relationship = "Choose how they are related to you";
  if (needsPermission(f.date_of_birth, today) && !f.consent) e.consent = "Confirm that you have their permission to manage their health care";
  return e;
}

/** What add_family_member is sent. Permission is only sent for an adult. */
export function addFamilyArgs(f: FamilyForm, today: string) {
  return {
    p_first_name: f.first_name.trim(),
    p_last_name: f.last_name.trim(),
    p_date_of_birth: f.date_of_birth,
    p_gender: f.gender,
    p_relationship: f.relationship,
    ...(needsPermission(f.date_of_birth, today) ? { p_consent_confirmed: f.consent === true } : {}),
  };
}

// ---- Acting for someone -----------------------------------------------------------------
/**
 * Adds p_patient_id to a database call only when it is for a family member. For the
 * signed-in patient nothing is added, so the call is exactly what it was before.
 * `activeId` is null for "Me".
 */
export function forPerson<T extends object>(args: T, activeId: string | null | undefined, ownId?: string | null): T & { p_patient_id?: string } {
  return activeId && activeId !== ownId ? { ...args, p_patient_id: activeId } : args;
}

/**
 * The saved choice, checked against the family list: someone who is no longer in the
 * family falls back to "Me" (null). While the list is still unknown the choice is kept.
 */
export function resolveActive(saved: string | null, family: readonly { patient_id: string }[] | undefined): string | null {
  if (!saved) return null;
  if (!family) return saved;
  return family.some((m) => m.patient_id === saved) ? saved : null;
}

/**
 * Who to show when a notification is opened. Returns the person to switch to (null = Me),
 * or undefined to stay as we are: no subject, already showing them, or they are no longer
 * in the family.
 */
export function personForNotification(
  subjectId: string | null | undefined, activeId: string | null, ownId: string | null, familyIds?: readonly string[],
): string | null | undefined {
  if (!subjectId) return undefined;
  const target = subjectId === ownId ? null : subjectId;
  if (target === activeId) return undefined;
  if (target !== null && familyIds && !familyIds.includes(target)) return undefined;
  return target;
}
