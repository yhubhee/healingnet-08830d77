// Turn a database / network error into a message that is safe to show a user.
const KNOWN: [RegExp, string][] = [
  [/only a hospital admin can invite/i, "Only a hospital admin can invite staff."],
  [/valid email/i, "Enter a valid email address."],
  [/not enough stock/i, "There isn't enough stock for that quantity."],
  [/too many wrong codes/i, "Too many wrong codes. Please try again in a little while."],
  [/fee is locked/i, "The fee can't be changed once the request is accepted."],
  [/status change is not allowed/i, "That status change isn't allowed."],
  [/permission denied|row-level security|not allowed|42501/i, "You don't have permission to do that."],
  [/duplicate key|23505/i, "That record already exists."],
  [/foreign key|23503/i, "That person needs a HealingNet account first."],
  [/jwt|not authenticated|invalid.*token/i, "Please sign in again."],
  [/failed to fetch|network/i, "Network problem. Check your connection and try again."],
];

// Messages raised by the pharmacy-network functions (prescription codes, dispensing,
// requests, pharmacy accounts, admin review). They are written for users, so they are
// shown exactly as the database wrote them. Some use code 42501, so they must be
// matched before the generic permission message below.
const PASS_THROUGH: RegExp[] = [
  /^This prescription (has already been dispensed|expired on|is not valid for dispensing|cannot be sent)/,
  /^That pharmacy (code is not valid|is not available on HealingNet)/,
  /^This account already has a profile/,
  /^Only the pharmacy owner can change these details/,
  /^Only a verified pharmacist with an in-date licence can dispense/,
  /^No pharmacy account$/,
  /^Member not found$/,
  /^You cannot deactivate yourself/,
  /^(Prescription|Request|Pharmacy|Pharmacist|Report|Fee) not found$/,
  /^Choose (at least one medicine|available, partly available|1 to 5 stars)/,
  /^A medicine on this list is not on the prescription/,
  /was not written by the prescribing doctor and cannot be dispensed here$/,
  /has already been dispensed$/,
  /^.{1,200} is (completed|cancelled|expired|on_hold|discontinued)$/,
  /^You can send a prescription to at most 3 pharmacies/,
  /^You already sent this prescription to that pharmacy/,
  /^This request is already /,
  /^Give the price the patient will pay at the counter/,
  /^You can rate a pharmacy after you collect your medicine/,
  /^Give a reason( when rejecting)?$/,
  /^The pharmacy needs a premises licence number/,
  /^A PCN registration number and licence expiry are needed/,
  /^This licence has expired$/,
  /^Status must be (approved or suspended|reviewed or closed)$/,
  /^Fee cannot be negative$/,
];

export function friendlyError(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const msg = String((e as any)?.message ?? e ?? "");
  const code = String((e as any)?.code ?? "");
  // The database writes plain-English messages for plan limits; show them as they are.
  if ((e as any)?.hint === "staff_limit_reached" && msg) return msg;
  if (msg && PASS_THROUGH.some((re) => re.test(msg))) return msg;
  for (const [re, text] of KNOWN) if (re.test(msg) || re.test(code)) return text;
  return fallback;
}
