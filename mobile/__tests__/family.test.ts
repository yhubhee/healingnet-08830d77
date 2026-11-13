import { cleanPersonId, createActivePersonStore } from "@/shared/activePerson";
import {
  addFamilyArgs, ageOn, ageText, daysUntil18, EMPTY_FAMILY_FORM, forPerson, needsPermission, permissionLabel, personForNotification, personWithAge,
  relationshipLabel, removeExplanation, resolveActive, turning18Note, validateFamilyForm, type FamilyForm,
} from "@/shared/family";
import { familyKey, personKeys } from "@/shared/keys";
import { shouldPersistQuery } from "@/lib/cache";
import { remindersFor, reminderText, todaysDoses, type Reminder } from "@/shared/reminders";

const ME = "11111111-1111-4111-8111-111111111111";
const TOBI = "22222222-2222-4222-8222-222222222222";
const ADA = "33333333-3333-4333-8333-333333333333";

describe("who is this for: the active person", () => {
  const make = () => {
    const saved: (string | null)[] = [];
    return { store: createActivePersonStore((id) => { saved.push(id); }), saved };
  };

  it("starts as Me", () => {
    expect(make().store.get()).toBeNull();
  });

  it("switches to a family member, saves the choice and tells the screens", () => {
    const { store, saved } = make();
    const seen: (string | null)[] = [];
    store.subscribe(() => seen.push(store.get()));
    store.set(TOBI);
    expect(store.get()).toBe(TOBI);
    expect(saved).toEqual([TOBI]);
    expect(seen).toEqual([TOBI]);
  });

  it("goes back to Me on sign-out and removes the saved choice", () => {
    const { store, saved } = make();
    store.set(TOBI);
    store.reset();
    expect(store.get()).toBeNull();
    expect(saved[saved.length - 1]).toBeNull();
  });

  it("sign-out clears the saved choice even when Me was already showing", () => {
    const { store, saved } = make();
    store.reset();
    expect(saved).toEqual([null]);
  });

  it("puts the saved choice in place at start-up without saving it again", () => {
    const { store, saved } = make();
    store.init(TOBI);
    expect(store.get()).toBe(TOBI);
    expect(saved).toEqual([]);
  });

  it("treats anything that is not an id as Me", () => {
    const { store } = make();
    store.init("not-an-id");
    expect(store.get()).toBeNull();
    expect(cleanPersonId(undefined)).toBeNull();
    expect(cleanPersonId(42)).toBeNull();
    expect(cleanPersonId(TOBI)).toBe(TOBI);
  });

  it("stops telling a screen that has gone away", () => {
    const { store } = make();
    let calls = 0;
    const stop = store.subscribe(() => { calls += 1; });
    store.set(TOBI);
    stop();
    store.set(ADA);
    expect(calls).toBe(1);
  });

  it("falls back to Me when the saved person is no longer in the family", () => {
    expect(resolveActive(TOBI, [{ patient_id: ADA }])).toBeNull();
    expect(resolveActive(TOBI, [{ patient_id: TOBI }])).toBe(TOBI);
    expect(resolveActive(TOBI, [])).toBeNull();
    // The list is not known yet: keep the choice.
    expect(resolveActive(TOBI, undefined)).toBe(TOBI);
    expect(resolveActive(null, [{ patient_id: TOBI }])).toBeNull();
  });
});

describe("a notification switches to the person it is about", () => {
  const family = [TOBI, ADA];

  it("switches from Me to the family member", () => {
    expect(personForNotification(TOBI, null, ME, family)).toBe(TOBI);
  });
  it("switches from one family member to another", () => {
    expect(personForNotification(ADA, TOBI, ME, family)).toBe(ADA);
  });
  it("switches back to Me for a notification about the patient", () => {
    expect(personForNotification(ME, TOBI, ME, family)).toBeNull();
  });
  it("stays put when it is about the person already showing", () => {
    expect(personForNotification(TOBI, TOBI, ME, family)).toBeUndefined();
    expect(personForNotification(ME, null, ME, family)).toBeUndefined();
  });
  it("stays put when the notification names no one", () => {
    expect(personForNotification(null, TOBI, ME, family)).toBeUndefined();
    expect(personForNotification(undefined, null, ME, family)).toBeUndefined();
  });
  it("does not switch to someone who is no longer in the family", () => {
    expect(personForNotification("44444444-4444-4444-8444-444444444444", null, ME, family)).toBeUndefined();
  });
  it("drives the store: Me, then Tobi after a notification about Tobi", () => {
    const store = createActivePersonStore(() => {});
    const next = personForNotification(TOBI, store.get(), ME, family);
    if (next !== undefined) store.set(next);
    expect(store.get()).toBe(TOBI);
  });
});

describe("query keys include the person", () => {
  const builders = [
    personKeys.appointments, personKeys.visitReviews, personKeys.rxDocuments, personKeys.rxRequests,
    personKeys.labResults, personKeys.emr, personKeys.letters, personKeys.letterDoctors,
  ];

  it("every per-person key carries the patient id", () => {
    for (const key of builders) expect(key(TOBI)).toContain(TOBI);
  });
  it("two people never share a key", () => {
    for (const key of builders) expect(JSON.stringify(key(TOBI))).not.toBe(JSON.stringify(key(ME)));
  });
  it("a family member's profile is keyed by their id, under the account", () => {
    expect(personKeys.memberProfile("user-1", TOBI)).toEqual(["profile", "user-1", TOBI]);
    expect(personKeys.memberProfile("user-1", TOBI)).not.toEqual(personKeys.memberProfile("user-1", ADA));
  });
  it("each person's saved (offline) data is kept under their own key, and the family list is saved too", () => {
    expect(shouldPersistQuery(personKeys.appointments(TOBI), "success")).toBe(true);
    expect(shouldPersistQuery(personKeys.labResults(TOBI), "success")).toBe(true);
    expect(shouldPersistQuery(personKeys.memberProfile("user-1", TOBI), "success")).toBe(true);
    expect(shouldPersistQuery(familyKey("user-1"), "success")).toBe(true);
  });
});

describe("age and the adult-permission rule", () => {
  const today = "2026-11-13";

  it("is 17 the day before the 18th birthday (17 years and 364 days)", () => {
    expect(ageOn("2008-11-14", today)).toBe(17);
    expect(needsPermission("2008-11-14", today)).toBe(false);
  });
  it("is 18 on the 18th birthday", () => {
    expect(ageOn("2008-11-13", today)).toBe(18);
    expect(needsPermission("2008-11-13", today)).toBe(true);
  });
  it("counts whole years by the calendar", () => {
    expect(ageOn("2020-06-01", today)).toBe(6);
    expect(ageOn("2026-11-13", today)).toBe(0);
    expect(ageOn("2026-01-01", today)).toBe(0);
    expect(ageOn("1950-12-31", today)).toBe(75);
  });
  it("a 29 February birthday turns 18 on 1 March in a year without one", () => {
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
    expect(ageOn("2008-02-29", "2026-03-01")).toBe(18);
  });
  it("has no age for a missing, future or impossible date", () => {
    expect(ageOn("", today)).toBeNull();
    expect(ageOn(null, today)).toBeNull();
    expect(ageOn("2027-01-01", today)).toBeNull();
    expect(needsPermission("", today)).toBe(false);
  });
  it("words the age", () => {
    expect(ageText(0)).toBe("Under 1");
    expect(ageText(6)).toBe("6");
    expect(ageText(null)).toBe("");
    expect(personWithAge("Tobi", 6)).toBe("Tobi (6)");
    expect(personWithAge("Tobi", null)).toBe("Tobi");
  });
});

describe("the add form", () => {
  const today = "2026-11-13";
  const child: FamilyForm = { first_name: " Tobi ", last_name: "Okafor", date_of_birth: "2020-06-01", gender: "male", relationship: "child", consent: false };
  const adult: FamilyForm = { ...child, first_name: "Ngozi", date_of_birth: "1958-03-02", gender: "female", relationship: "parent" };

  it("accepts a child without the permission tick", () => {
    expect(validateFamilyForm(child, today)).toEqual({});
  });
  it("asks for the permission tick for an adult", () => {
    expect(validateFamilyForm(adult, today).consent).toBeTruthy();
    expect(validateFamilyForm({ ...adult, consent: true }, today)).toEqual({});
  });
  it("the tick is needed from the 18th birthday, not the day before", () => {
    expect(validateFamilyForm({ ...child, date_of_birth: "2008-11-14" }, today).consent).toBeUndefined();
    expect(validateFamilyForm({ ...child, date_of_birth: "2008-11-13" }, today).consent).toBeTruthy();
  });
  it("needs every field", () => {
    const e = validateFamilyForm(EMPTY_FAMILY_FORM, today);
    expect(Object.keys(e).sort()).toEqual(["date_of_birth", "first_name", "gender", "last_name", "relationship"]);
  });
  it("refuses a date of birth in the future", () => {
    expect(validateFamilyForm({ ...child, date_of_birth: "2026-11-14" }, today).date_of_birth).toBe("Date of birth cannot be in the future");
  });
  it("sends permission only for an adult, and trims the names", () => {
    expect(addFamilyArgs(child, today)).toEqual({ p_first_name: "Tobi", p_last_name: "Okafor", p_date_of_birth: "2020-06-01", p_gender: "male", p_relationship: "child" });
    expect(addFamilyArgs({ ...adult, consent: true }, today).p_consent_confirmed).toBe(true);
    // A tick left over from an earlier date of birth is not sent for a child.
    expect("p_consent_confirmed" in addFamilyArgs({ ...child, consent: true }, today)).toBe(false);
  });
  it("words the tick box and the removal with the person's name", () => {
    expect(permissionLabel("Ngozi")).toBe("I have Ngozi's permission to manage their health care on HealingNet.");
    expect(removeExplanation("Tobi")).toBe("Tobi will be removed from your account. Open appointments are cancelled. If a hospital has treated Tobi, that hospital keeps its records.");
    expect(relationshipLabel("child")).toBe("Child");
    expect(relationshipLabel("unknown")).toBe("Family member");
  });
});

describe("the turning-18 note", () => {
  const today = "2026-11-13";
  const tobi = (date_of_birth: string, has_permission?: boolean) => ({ first_name: "Tobi", date_of_birth, has_permission });

  it("is not shown for a young child", () => {
    expect(turning18Note(tobi("2020-06-01"), today)).toBeNull();
  });
  it("is not shown at 17 with more than 90 days to go", () => {
    expect(daysUntil18("2009-02-12", today)).toBe(91);
    expect(turning18Note(tobi("2009-02-12"), today)).toBeNull();
  });
  it("is shown at 17 within 90 days of 18", () => {
    expect(daysUntil18("2009-02-11", today)).toBe(90);
    expect(turning18Note(tobi("2009-02-11"), today)).toBe("Tobi is nearly an adult. Soon they'll be able to manage their own HealingNet account.");
    expect(turning18Note(tobi("2008-11-14"), today)).toContain("nearly an adult");
  });
  it("is shown at 18 or over when no permission is on record", () => {
    expect(turning18Note(tobi("2008-11-13", false), today)).toBe("Tobi is an adult. Soon they'll be able to manage their own HealingNet account.");
    expect(turning18Note(tobi("2000-01-01", false), today)).toContain("is an adult");
  });
  it("is not shown for an adult added with their permission", () => {
    expect(turning18Note(tobi("1958-03-02", true), today)).toBeNull();
  });
  it("says nothing when it is not known whether permission was recorded", () => {
    expect(turning18Note(tobi("2000-01-01", undefined), today)).toBeNull();
  });
});

describe("booking and share codes for a family member", () => {
  const args = { p_hospital_id: "h", p_doctor_id: "d", p_date: "2026-11-20", p_time: "09:00" };

  it("does not send p_patient_id for Me", () => {
    expect(forPerson(args, null, ME)).toEqual(args);
    expect("p_patient_id" in forPerson(args, null, ME)).toBe(false);
    expect("p_patient_id" in forPerson(args, undefined)).toBe(false);
  });
  it("does not send p_patient_id when the active id is the patient's own", () => {
    expect("p_patient_id" in forPerson(args, ME, ME)).toBe(false);
  });
  it("sends p_patient_id for a family member", () => {
    expect(forPerson(args, TOBI, ME)).toEqual({ ...args, p_patient_id: TOBI });
    expect(forPerson({}, TOBI, ME)).toEqual({ p_patient_id: TOBI });
  });
});

describe("medicine reminders are kept apart for each person", () => {
  const mine: Reminder = { id: "rx1", documentId: "d1", drug: "Amoxicillin", dose: "500mg", times: ["08:00"], startDate: "2026-11-13", days: 5 };
  const tobis: Reminder = { ...mine, id: "rx2", drug: "Paracetamol", dose: "5ml", patientId: TOBI, person: "Tobi" };
  const now = new Date(2026, 10, 13, 7, 0);

  it("shows only the active person's medicines", () => {
    expect(remindersFor([mine, tobis], null).map((r) => r.id)).toEqual(["rx1"]);
    expect(remindersFor([mine, tobis], TOBI).map((r) => r.id)).toEqual(["rx2"]);
    expect(todaysDoses(remindersFor([mine, tobis], TOBI), now).map((d) => d.drug)).toEqual(["Paracetamol"]);
  });
  it("names the person only when lock-screen details are on", () => {
    const [dose] = todaysDoses([tobis], now);
    expect(reminderText(dose, true)).toEqual({ title: "Tobi: time for medicine", body: "Paracetamol · 5ml" });
    expect(reminderText(dose, false)).toEqual({ title: "Time for your medicine", body: "Open HealingNet to see which one." });
  });
  it("keeps the patient's own reminder wording as it was", () => {
    const [dose] = todaysDoses([mine], now);
    expect(reminderText(dose, true).title).toBe("Time for your medicine");
  });
});
