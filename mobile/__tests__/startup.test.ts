import { firstScreen, gateTarget, parseAccountCheck, storedUserId, waitingForCheck, type AccountCheck } from "../shared/startup";

const session = (over: Record<string, unknown> = {}) => JSON.stringify({ access_token: "a", refresh_token: "r", user: { id: "u1" }, ...over });
const check = (over: Partial<AccountCheck> = {}): AccountCheck => ({ userId: "u1", kind: "patient", profileComplete: true, patientId: "p1", ...over });

describe("reading what is stored on the phone", () => {
  it("finds the user in a stored session", () => {
    expect(storedUserId(session())).toBe("u1");
  });
  it("treats a missing, broken or incomplete session as signed out", () => {
    expect(storedUserId(null)).toBeNull();
    expect(storedUserId("")).toBeNull();
    expect(storedUserId("not json")).toBeNull();
    expect(storedUserId(session({ refresh_token: "" }))).toBeNull();
    expect(storedUserId(session({ user: null }))).toBeNull();
  });
  it("only uses a saved check that belongs to the stored user", () => {
    expect(parseAccountCheck(JSON.stringify(check()), "u1")).toEqual(check());
    expect(parseAccountCheck(JSON.stringify(check()), "someone-else")).toBeNull();
    expect(parseAccountCheck("not json", "u1")).toBeNull();
    expect(parseAccountCheck(JSON.stringify(check()), null)).toBeNull();
  });
});

describe("the first screen, from stored data only", () => {
  it("stored session -> the tabs", () => {
    expect(firstScreen("u1", check())).toBe("/(tabs)");
  });
  it("stored session but no saved check yet (first start after an update) -> still the tabs", () => {
    expect(firstScreen("u1", null)).toBe("/(tabs)");
  });
  it("no stored session -> Welcome", () => {
    expect(firstScreen(null, null)).toBe("/(auth)");
    expect(firstScreen(null, check())).toBe("/(auth)");
  });
  it("a saved check with a problem opens that screen straight away", () => {
    expect(firstScreen("u1", check({ kind: "doctor" }))).toBe("/not-patient");
    expect(firstScreen("u1", check({ kind: "new" }))).toBe("/finish-signup");
    expect(firstScreen("u1", check({ profileComplete: false }))).toBe("/complete-profile");
  });
});

describe("a background check that finds a problem", () => {
  const inTabs = { signedIn: true, returning: true, first: "(tabs)" };
  it("stays put when the check agrees", () => {
    expect(gateTarget({ ...inTabs, kind: "patient", profileComplete: true })).toBeNull();
    expect(gateTarget({ ...inTabs, kind: undefined, profileComplete: undefined })).toBeNull();
  });
  it("session revoked -> Welcome", () => {
    expect(gateTarget({ ...inTabs, signedIn: false, kind: undefined, profileComplete: undefined })).toBe("/(auth)");
  });
  it("not a patient -> the patients-only screen", () => {
    for (const kind of ["doctor", "hospital", "pharmacy", "admin"] as const) {
      expect(gateTarget({ ...inTabs, kind, profileComplete: undefined })).toBe("/not-patient");
    }
  });
  it("no profile yet -> Finish sign-up", () => {
    expect(gateTarget({ ...inTabs, kind: "new", profileComplete: undefined })).toBe("/finish-signup");
  });
  it("profile incomplete -> Complete profile, and it stays there", () => {
    expect(gateTarget({ ...inTabs, kind: "patient", profileComplete: false })).toBe("/complete-profile");
    expect(gateTarget({ ...inTabs, first: "complete-profile", kind: "patient", profileComplete: false })).toBeNull();
  });
  it("leaves the open screens alone", () => {
    expect(gateTarget({ signedIn: false, returning: false, kind: undefined, profileComplete: undefined, first: "reset-password" })).toBeNull();
    expect(gateTarget({ signedIn: true, returning: true, kind: "doctor", profileComplete: undefined, first: "auth-callback" })).toBeNull();
  });
});

describe("a fresh sign-in", () => {
  const justSignedIn = { signedIn: true, returning: false, first: "(auth)" };
  it("waits on the sign-in screen until the first check answers", () => {
    expect(gateTarget({ ...justSignedIn, kind: undefined, profileComplete: undefined })).toBeNull();
    expect(waitingForCheck({ ...justSignedIn, kind: undefined, profileComplete: undefined })).toBe(true);
    expect(gateTarget({ ...justSignedIn, kind: "patient", profileComplete: undefined })).toBeNull();
    expect(waitingForCheck({ ...justSignedIn, kind: "patient", profileComplete: undefined })).toBe(true);
  });
  it("then opens the right screen", () => {
    expect(gateTarget({ ...justSignedIn, kind: "patient", profileComplete: true })).toBe("/(tabs)");
    expect(gateTarget({ ...justSignedIn, kind: "patient", profileComplete: false })).toBe("/complete-profile");
    expect(gateTarget({ ...justSignedIn, kind: "doctor", profileComplete: undefined })).toBe("/not-patient");
    expect(waitingForCheck({ ...justSignedIn, kind: "doctor", profileComplete: undefined })).toBe(false);
  });
  it("a returning patient never waits", () => {
    expect(waitingForCheck({ signedIn: true, returning: true, kind: undefined, profileComplete: undefined })).toBe(false);
  });
});
