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

export function friendlyError(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const msg = String((e as any)?.message ?? e ?? "");
  const code = String((e as any)?.code ?? "");
  // The database writes plain-English messages for plan limits; show them as they are.
  if ((e as any)?.hint === "staff_limit_reached" && msg) return msg;
  for (const [re, text] of KNOWN) if (re.test(msg) || re.test(code)) return text;
  return fallback;
}
