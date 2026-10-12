// Turn a database / network error into a message that is safe to show a user.
const KNOWN: [RegExp, string][] = [
  [/not enough stock/i, "There isn't enough stock for that quantity."],
  [/too many wrong codes/i, "Too many wrong codes. Please try again in a little while."],
  [/fee is locked/i, "The fee can't be changed once the request is accepted."],
  [/status change is not allowed/i, "That status change isn't allowed."],
  [/permission denied|row-level security|not allowed|42501/i, "You don't have permission to do that."],
  [/duplicate key|23505/i, "That record already exists."],
  [/jwt|not authenticated|invalid.*token/i, "Please sign in again."],
  [/failed to fetch|network/i, "Network problem. Check your connection and try again."],
];

export function friendlyError(e: unknown, fallback = "Something went wrong. Please try again."): string {
  const msg = String((e as any)?.message ?? e ?? "");
  const code = String((e as any)?.code ?? "");
  for (const [re, text] of KNOWN) if (re.test(msg) || re.test(code)) return text;
  return fallback;
}
