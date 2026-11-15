import { FINISH_PROFILE_FIRST, profileIncompleteRoute } from "../shared/errors";
import { profileProgress, type ProfileForm } from "../shared/patientProfile";
import { combineProfileChecks, firstScreen, gateTarget, parseAccountCheck, storedUserId, waitingForCheck, type AccountCheck } from "../shared/startup";

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
  it("stored session but no saved check (the app was closed in the middle of signing up) -> wait for the check, never the tabs", () => {
    expect(firstScreen("u1", null)).toBeNull();
    expect(waitingForCheck({ signedIn: true, returning: true, kind: undefined, profileComplete: undefined })).toBe(true);
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
  it("a returning patient with a saved check never waits", () => {
    expect(waitingForCheck({ signedIn: true, returning: true, kind: "patient", profileComplete: true })).toBe(false);
    expect(waitingForCheck({ signedIn: false, returning: false, kind: undefined, profileComplete: undefined })).toBe(false);
  });
});

describe("no path reaches the tabs with an incomplete profile", () => {
  const incomplete = { signedIn: true, kind: "patient" as const, profileComplete: false };
  const unknown = { signedIn: true, kind: undefined, profileComplete: undefined };
  const half = { signedIn: true, kind: "patient" as const, profileComplete: undefined };

  it("email sign-up and its confirm link, and sign-in on a second device", () => {
    // The link lands on auth-callback, which asks for the tabs; the gate answers.
    for (const first of ["(auth)", "(tabs)", ""]) {
      expect(gateTarget({ ...unknown, returning: false, first })).toBeNull();
      expect(waitingForCheck({ ...unknown, returning: false })).toBe(true);
      expect(gateTarget({ ...half, returning: false, first })).toBeNull();
      expect(waitingForCheck({ ...half, returning: false })).toBe(true);
      expect(gateTarget({ ...incomplete, returning: false, first })).toBe("/complete-profile");
    }
  });

  it("a deep link or a notification tap", () => {
    for (const first of ["prescriptions", "lab-results", "family", "book", "notifications", "messages"]) {
      expect(gateTarget({ ...incomplete, returning: true, first })).toBe("/complete-profile");
      expect(gateTarget({ ...unknown, returning: true, first })).toBeNull();
      expect(waitingForCheck({ ...unknown, returning: true })).toBe(true);
    }
  });

  it("the back button from Complete profile", () => {
    // Wherever back lands, the gate sends the person to Complete profile again.
    for (const first of ["(tabs)", "(auth)", "", "profile"]) {
      expect(gateTarget({ ...incomplete, returning: true, first })).toBe("/complete-profile");
    }
    expect(gateTarget({ ...incomplete, returning: true, first: "complete-profile" })).toBeNull();
  });

  it("an app restart in the middle", () => {
    // Restarted before the first check was saved: wait. Restarted after: straight to Complete profile.
    expect(firstScreen("u1", null)).toBeNull();
    expect(firstScreen("u1", check({ profileComplete: false }))).toBe("/complete-profile");
    expect(gateTarget({ ...unknown, returning: true, first: "(tabs)" })).toBeNull();
    expect(waitingForCheck({ ...unknown, returning: true })).toBe(true);
  });

  it("the tabs open only once the profile is known to be complete", () => {
    expect(gateTarget({ signedIn: true, returning: false, kind: "patient", profileComplete: true, first: "(auth)" })).toBe("/(tabs)");
    expect(gateTarget({ signedIn: true, returning: true, kind: "patient", profileComplete: true, first: "(tabs)" })).toBeNull();
  });
});

describe("the server's check (my_profile_status) alongside the local one", () => {
  const settled = { waitForServer: false, serverFailed: false };
  const fresh = { waitForServer: true, serverFailed: false };

  it("if the server says incomplete, it is incomplete, whatever is saved on the phone", () => {
    expect(combineProfileChecks(true, { isPatient: true, complete: false }, settled)).toBe(false);
    expect(combineProfileChecks(undefined, { isPatient: true, complete: false }, fresh)).toBe(false);
  });

  it("a returning patient is routed at once from the local check", () => {
    expect(combineProfileChecks(true, undefined, settled)).toBe(true);
    expect(combineProfileChecks(false, undefined, settled)).toBe(false);
    expect(combineProfileChecks(false, { isPatient: true, complete: true }, settled)).toBe(false);
  });

  it("a fresh sign-in waits for the server, and falls back to the local check if it cannot be reached", () => {
    expect(combineProfileChecks(true, undefined, fresh)).toBeUndefined();
    expect(combineProfileChecks(true, { isPatient: true, complete: true }, fresh)).toBe(true);
    expect(combineProfileChecks(true, undefined, { waitForServer: true, serverFailed: true })).toBe(true);
    expect(combineProfileChecks(undefined, undefined, settled)).toBeUndefined();
  });
});

describe("profile_incomplete routing", () => {
  it("a call refused with the profile_incomplete hint goes to Complete profile with a toast", () => {
    const refused = { message: "Complete your profile before booking. Missing: phone number, address", code: "P0001", hint: "profile_incomplete" };
    expect(profileIncompleteRoute(refused)).toEqual({ route: "/complete-profile", toast: "Finish your profile first." });
    expect(FINISH_PROFILE_FIRST).toBe("Finish your profile first.");
  });

  it("any other failure is not rerouted", () => {
    expect(profileIncompleteRoute({ message: "Complete your profile before booking.", code: "P0001" })).toBeNull();
    expect(profileIncompleteRoute({ message: "That time is taken", hint: "slot_taken" })).toBeNull();
    expect(profileIncompleteRoute(new Error("Network request failed"))).toBeNull();
    expect(profileIncompleteRoute(null)).toBeNull();
    expect(profileIncompleteRoute("profile_incomplete")).toBeNull();
  });
});

describe("Complete profile progress", () => {
  const empty: ProfileForm = {
    phone: "", date_of_birth: "", gender: "", state: "", city: "", address: "", emergency_contact_name: "", emergency_contact_phone: "",
    blood_group: "", genotype: "", insurance_provider: "", insurance_policy_number: "", allergies: "", medical_conditions: "",
  };
  it("counts the required details that are filled in and valid", () => {
    expect(profileProgress(empty, "2026-11-14").text).toBe("0 of 8 done");
    expect(profileProgress({ ...empty, phone: "0803 123 4567", gender: "female", state: "Lagos" }, "2026-11-14").text).toBe("3 of 8 done");
    // A phone number that is not Nigerian does not count yet.
    expect(profileProgress({ ...empty, phone: "12345", gender: "female" }, "2026-11-14").done).toBe(1);
    const full = { ...empty, phone: "+2348031234567", date_of_birth: "1990-05-01", gender: "male", state: "Lagos", city: "Ikeja", address: "1 Allen Avenue",
      emergency_contact_name: "Ada", emergency_contact_phone: "08031234567" };
    expect(profileProgress(full, "2026-11-14")).toEqual({ done: 8, total: 8, text: "8 of 8 done" });
    // Optional details never change the count.
    expect(profileProgress({ ...full, blood_group: "O+" }, "2026-11-14").done).toBe(8);
  });
});
