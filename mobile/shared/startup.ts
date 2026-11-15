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
 *   no session                          -> Welcome
 *   saved check: patient, complete      -> the tabs, at once
 *   nothing known yet                   -> stay and wait for the check (never the tabs)
 *   check says: new account             -> Finish sign-up
 *   check says: not a patient           -> "This app is for patients"
 *   check says: profile incomplete      -> Complete profile
 * No path reaches the tabs until the profile is known to be complete: not a fresh sign-in,
 * not a second device, not a deep link, and not a restart in the middle of signing up
 * (a stored session with no saved check waits like a fresh sign-in).
 */
export function gateTarget({ signedIn, kind, profileComplete, first }: GateState): StartScreen | null {
  if (OPEN_ROUTES.includes(first)) return null;
  if (!signedIn) return first === "(auth)" ? null : "/(auth)";
  // Nothing known yet: wait where we are (behind the loading screen), whoever it is.
  if (kind === undefined) return null;
  if (kind === "new") return first === "finish-signup" ? null : "/finish-signup";
  if (kind !== "patient") return first === "not-patient" ? null : "/not-patient";
  if (profileComplete === false) return first === "complete-profile" ? null : "/complete-profile";
  if (profileComplete === undefined) return null;
  // Complete: leave the sign-in screens. (Complete profile moves on by itself after saving.)
  return OUTSIDE_APP.includes(first) ? "/(tabs)" : null;
}

/**
 * True while the role and profile check has not answered and nothing is saved from last
 * time: a fresh sign-in, or a stored session with no saved check. The loading screen covers
 * whatever is underneath, so the tabs are never seen with an incomplete profile.
 */
export function waitingForCheck({ signedIn, kind, profileComplete }: Omit<GateState, "first">): boolean {
  if (!signedIn) return false;
  return kind === undefined || (kind === "patient" && profileComplete === undefined);
}

/**
 * The profile answer the gate uses: the local check (instant, from the saved profile) and
 * the server's my_profile_status(). If the server says incomplete, it is incomplete. A
 * fresh sign-in waits for the server's answer; if that cannot be had, the local one stands.
 */
export function combineProfileChecks(
  local: boolean | undefined, server: { complete: boolean; isPatient: boolean } | undefined,
  opts: { waitForServer: boolean; serverFailed: boolean },
): boolean | undefined {
  if (server?.isPatient && !server.complete) return false;
  if (local === undefined) return undefined;
  if (opts.waitForServer && !server && !opts.serverFailed) return undefined;
  return local;
}

/** The first screen for a cold start, from stored data alone; null means wait for the check behind the loading screen. */
export function firstScreen(userId: string | null, check: AccountCheck | null): StartScreen | null {
  if (!userId) return "/(auth)";
  if (!check) return null;
  return gateTarget({
    signedIn: true, returning: true, kind: check.kind, profileComplete: check.profileComplete, first: "",
  }) ?? "/(tabs)";
}
