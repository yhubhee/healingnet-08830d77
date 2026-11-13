// Start-up routing: which screen opens first, decided only from what is stored on the
// phone (never the network), and where a later background check sends the person.

export type AccountKind = "patient" | "admin" | "pharmacy" | "doctor" | "hospital" | "new";

/** The result of the last role and profile checks, saved on the device with the session. */
export interface AccountCheck {
  userId: string;
  kind: AccountKind;
  /** Patients only: are the required profile details filled in? */
  profileComplete: boolean;
  /** Patients only: lets the saved lists load before the profile row is read. */
  patientId: string | null;
}

export type StartScreen = "/(auth)" | "/(tabs)" | "/finish-signup" | "/not-patient" | "/complete-profile";

/** Screens that are open to anyone, signed in or not. */
export const OPEN_ROUTES = ["reset-password", "auth-callback"];

/** Groups a signed-in patient with a complete profile should be moved out of. */
const OUTSIDE_APP = ["(auth)", "not-patient", "finish-signup", ""];

/** The user id inside a stored Supabase session, or null when there is none worth trusting. */
export function storedUserId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw) as { refresh_token?: unknown; user?: { id?: unknown } | null } | null;
    if (!s || typeof s.refresh_token !== "string" || !s.refresh_token) return null;
    const id = s.user?.id;
    return typeof id === "string" && id ? id : null;
  } catch {
    return null;
  }
}

/** A saved check, if it is well formed and belongs to this user. */
export function parseAccountCheck(raw: string | null | undefined, userId: string | null): AccountCheck | null {
  if (!raw || !userId) return null;
  try {
    const c = JSON.parse(raw) as Partial<AccountCheck> | null;
    if (!c || c.userId !== userId || typeof c.kind !== "string") return null;
    return { userId, kind: c.kind as AccountKind, profileComplete: c.profileComplete === true, patientId: typeof c.patientId === "string" ? c.patientId : null };
  } catch {
    return null;
  }
}

export interface GateState {
  signedIn: boolean;
  /** The session was already on the phone when the app opened (not a sign-in just now). */
  returning: boolean;
  /** From the latest check, or the saved one until that arrives. */
  kind: AccountKind | undefined;
  profileComplete: boolean | undefined;
  /** The first part of the current route, e.g. "(tabs)". */
  first: string;
}

/**
 * Where to go from here, or null to stay. Used for the very first screen (from stored
 * data) and again whenever a background check changes what is known.
 *   no session                     -> Welcome
 *   stored session                 -> the tabs, at once
 *   check says: new account        -> Finish sign-up
 *   check says: not a patient      -> "This app is for patients"
 *   check says: profile incomplete -> Complete profile
 */
export function gateTarget({ signedIn, returning, kind, profileComplete, first }: GateState): StartScreen | null {
  if (OPEN_ROUTES.includes(first)) return null;
  if (!signedIn) return first === "(auth)" ? null : "/(auth)";
  const toTabs = OUTSIDE_APP.includes(first) ? "/(tabs)" : null;
  // Nothing known yet: a returning person goes straight in; a fresh sign-in waits for the check.
  if (kind === undefined) return returning ? toTabs : null;
  if (kind === "new") return first === "finish-signup" ? null : "/finish-signup";
  if (kind !== "patient") return first === "not-patient" ? null : "/not-patient";
  if (profileComplete === false) return first === "complete-profile" ? null : "/complete-profile";
  if (profileComplete === undefined && !returning) return null;
  return toTabs;
}

/** True while a fresh sign-in is still waiting for its first role and profile check. */
export function waitingForCheck({ signedIn, returning, kind, profileComplete }: Omit<GateState, "first">): boolean {
  if (!signedIn || returning) return false;
  return kind === undefined || (kind === "patient" && profileComplete === undefined);
}

/** The first screen for a cold start, from stored data alone. */
export function firstScreen(userId: string | null, check: AccountCheck | null): StartScreen {
  return gateTarget({
    signedIn: !!userId, returning: !!userId, kind: check?.kind, profileComplete: check ? check.profileComplete : undefined, first: "",
  }) ?? "/(tabs)";
}
