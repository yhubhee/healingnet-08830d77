// Medicine reminders, and care-plan reminders (0.5), on the phone. Both share one budget of
// 60 scheduled notifications, nearest first (shared/care.ts shareBudget).
// Medicine reminders: where they are kept (encrypted, like the saved data),
// handing the next doses to the phone's own scheduler, and the Taken / Snooze buttons.
// Nothing here goes to the server, and nothing logs a medicine name.
import * as Notifications from "expo-notifications";
import { useEffect, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import {
  activeReminders, cleanTimes, planSchedule, pruneTaken, reminderText, SNOOZE_MINUTES, topUp, type Dose, type Reminder,
} from "@/shared/reminders";
import { alertsReplacedByPush, careAlertText, shareBudget, type CareAlert } from "@/shared/care";
import { encryptedStorage } from "./storage";

const STORE_KEY = "hn.reminders";
const CHANNEL = "medicine";
const CATEGORY = "medicine";
const ID_PREFIX = "med:";
const CARE_CHANNEL = "care";
const CARE_PREFIX = "care:";
/** Key for the signed-in patient's own care alerts. */
const ME = "me";
export const ACTION_TAKEN = "taken";
export const ACTION_SNOOZE = "snooze";

interface Store {
  reminders: Reminder[];
  /** Dose key -> when it was ticked as taken. */
  taken: Record<string, number>;
  /** Copy of the patient's "Show details on the lock screen" switch. */
  showDetails: boolean;
  /** Care-plan alerts worked out from my_care(), per person ("me" or a family member's patient id). */
  care: Record<string, CareAlert[]>;
  /** Care alerts a server notification has already covered: not rung again on the phone. */
  careOff: string[];
}
const EMPTY: Store = { reminders: [], taken: {}, showDetails: false, care: {}, careOff: [] };

let state: Store = EMPTY;
let loaded: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function load(): Promise<void> {
  loaded ??= encryptedStorage.getItem(STORE_KEY).then((raw) => {
    if (!raw) return;
    try {
      const s = JSON.parse(raw) as Partial<Store>;
      state = { reminders: Array.isArray(s.reminders) ? s.reminders : [], taken: s.taken ?? {}, showDetails: s.showDetails === true,
        care: s.care && typeof s.care === "object" ? s.care : {}, careOff: Array.isArray(s.careOff) ? s.careOff : [] };
      emit();
    } catch { /* unreadable: start empty */ }
  }).catch(() => {});
  return loaded;
}

async function save(next: Store): Promise<void> {
  state = next;
  emit();
  try { await encryptedStorage.setItem(STORE_KEY, JSON.stringify(next)); } catch { /* kept in memory for this run */ }
}

/** The reminders and Taken ticks, live. */
export function useReminders(): Store {
  useEffect(() => { load(); }, []);
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state, () => EMPTY);
}

// ---- The phone's scheduler --------------------------------------------------------------
let prepared = false;
async function prepare(): Promise<void> {
  if (prepared) return;
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: "Medicine reminders",
      importance: Notifications.AndroidImportance.HIGH,
      // The text itself is generic unless the patient chose to show details.
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  // Both buttons open the app: that is the only way they are sure to work when the app
  // was fully closed, and it shows the tick on Home straight away.
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CARE_CHANNEL, {
      name: "Care plan reminders",
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
  await Notifications.setNotificationCategoryAsync(CATEGORY, [
    { identifier: ACTION_TAKEN, buttonTitle: "Taken" },
    { identifier: ACTION_SNOOZE, buttonTitle: `Snooze ${SNOOZE_MINUTES} min` },
  ]);
  prepared = true;
}

const keyOf = (n: Notifications.NotificationRequest): string | null => {
  const data = n.content.data as { kind?: unknown; key?: unknown } | null | undefined;
  return data?.kind === "med" && typeof data.key === "string" ? data.key : null;
};

const careKeyOf = (n: Notifications.NotificationRequest): string | null => {
  const data = n.content.data as { kind?: unknown; key?: unknown } | null | undefined;
  return data?.kind === "care" && typeof data.key === "string" ? data.key : null;
};

async function scheduleCare(a: CareAlert, showDetails: boolean): Promise<void> {
  const { title, body } = careAlertText(a, showDetails);
  await Notifications.scheduleNotificationAsync({
    identifier: CARE_PREFIX + a.key,
    // The data says only which alert and whose plan it is: no titles, no health details.
    content: { title, body, sound: "default", data: { kind: "care", key: a.key, patient: a.patientId } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: a.at, channelId: CARE_CHANNEL },
  });
}

/** Every care alert still to come, for everyone, without the ones a server notification covered. */
function pendingCare(now: Date): CareAlert[] {
  const off = new Set(state.careOff);
  return Object.values(state.care).flat().filter((a) => a.at > now.getTime() && !off.has(a.key)).sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
}

async function schedule(dose: Pick<Dose, "key" | "drug" | "dose" | "person">, when: number, identifier: string, showDetails: boolean): Promise<void> {
  const { title, body } = reminderText(dose, showDetails);
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, categoryIdentifier: CATEGORY, sound: "default", data: { kind: "med", key: dose.key } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
  });
}

let syncing: Promise<void> | null = null;
/**
 * Brings the phone's scheduled notifications in line with the reminders: finished courses
 * are dropped, passed and ticked doses are removed, and the list is topped back up to the
 * next 60. Called when the app opens, when it returns to the front, and after any change.
 */
export function syncReminders(rebuild = false): Promise<void> {
  const run = async () => {
    await load();
    const now = new Date();
    const reminders = activeReminders(state.reminders, now);
    const taken = pruneTaken(state.taken, now);
    if (reminders.length !== state.reminders.length || Object.keys(taken).length !== Object.keys(state.taken).length) await save({ ...state, reminders, taken });
    try {
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== "granted") return;
      const all = await Notifications.getAllScheduledNotificationsAsync();
      const scheduled = all.filter((n) => keyOf(n) !== null);
      const careScheduled = all.filter((n) => careKeyOf(n) !== null && n.identifier.startsWith(CARE_PREFIX));
      const care = pendingCare(now);
      if (reminders.length === 0 && scheduled.length === 0 && care.length === 0 && careScheduled.length === 0) return;
      await prepare();
      // One budget for both kinds: the nearest 60 in total.
      const shared = shareBudget(planSchedule(reminders, now, taken), care);
      const plan = shared.doses;
      const mine = scheduled.filter((n) => n.identifier.startsWith(ID_PREFIX));
      const { cancel, add } = topUp(rebuild ? [] : mine.map((n) => keyOf(n)!), plan);
      const wantedCare = new Set(shared.alerts.map((a) => a.key));
      const haveCare = new Set(rebuild ? [] : careScheduled.map((n) => careKeyOf(n)!));
      const drop = [
        ...(rebuild ? mine.map((n) => n.identifier) : cancel.map((k) => ID_PREFIX + k)),
        ...careScheduled.filter((n) => rebuild || !wantedCare.has(careKeyOf(n)!)).map((n) => n.identifier),
      ];
      await Promise.all(drop.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
      for (const dose of add) await schedule(dose, dose.at, ID_PREFIX + dose.key, state.showDetails);
      for (const a of shared.alerts) if (!haveCare.has(a.key)) await scheduleCare(a, state.showDetails);
    } catch { /* the next sync tries again */ }
  };
  syncing = (syncing ?? Promise.resolve()).then(run, run);
  return syncing;
}

// ---- Changes ----------------------------------------------------------------------------
export async function saveReminder(reminder: Reminder): Promise<void> {
  await load();
  const clean = { ...reminder, times: cleanTimes(reminder.times) };
  await save({ ...state, reminders: [...state.reminders.filter((r) => r.id !== clean.id), clean] });
  await syncReminders();
}

export async function removeReminder(id: string): Promise<void> {
  await load();
  await save({ ...state, reminders: state.reminders.filter((r) => r.id !== id) });
  await syncReminders();
}

/** A family member was removed: their reminders go with them. */
export async function removeRemindersFor(patientId: string): Promise<void> {
  await load();
  if (!state.reminders.some((r) => r.patientId === patientId) && !state.care[patientId]) return;
  const care = { ...state.care };
  delete care[patientId];
  await save({ ...state, reminders: state.reminders.filter((r) => r.patientId !== patientId), care });
  await syncReminders();
}

/** Ticks (or unticks) a dose. A ticked dose no longer rings, and a waiting snooze is dropped. */
export async function setTaken(key: string, taken: boolean): Promise<void> {
  await load();
  const next = { ...state.taken };
  if (taken) next[key] = Date.now(); else delete next[key];
  await save({ ...state, taken: next });
  if (taken) await Notifications.cancelScheduledNotificationAsync(`${ID_PREFIX}snooze:${key}`).catch(() => {});
  await syncReminders();
}

async function snooze(key: string): Promise<void> {
  await load();
  const [reminderId] = key.split("|");
  const r = state.reminders.find((x) => x.id === reminderId);
  if (!r) return;
  try {
    await prepare();
    await schedule({ key, drug: r.drug, dose: r.dose, person: r.person }, Date.now() + SNOOZE_MINUTES * 60_000, `${ID_PREFIX}snooze:${key}`, state.showDetails);
  } catch { /* nothing to do: the dose still shows on Home */ }
}

// ---- Care-plan alerts -------------------------------------------------------------------
const sameAlerts = (a: CareAlert[] | undefined, b: CareAlert[]) =>
  (a ?? []).length === b.length && (a ?? []).every((x, i) => x.key === b[i].key && x.at === b[i].at && x.text === b[i].text && (x.person ?? null) === (b[i].person ?? null));

/**
 * Replaces the care alerts of the people given (null = the signed-in patient) with what
 * their care plans say now, then re-schedules. An item that is done, cancelled or moved
 * simply is not in the new list, so its alert is cancelled.
 */
export async function setCarePlans(plans: { patientId: string | null; alerts: CareAlert[] }[]): Promise<void> {
  await load();
  const care = { ...state.care };
  let changed = false;
  for (const p of plans) {
    const k = p.patientId ?? ME;
    if (sameAlerts(care[k], p.alerts)) continue;
    changed = true;
    if (p.alerts.length) care[k] = p.alerts; else delete care[k];
  }
  if (!changed) return;
  const keys = new Set(Object.values(care).flat().map((a) => a.key));
  await save({ ...state, care, careOff: state.careOff.filter((k) => keys.has(k)) });
  await syncReminders();
}

/**
 * A server notification about this care item or procedure has arrived (type "care", the
 * same reference id): the matching alert on the phone is dropped, so nobody is told twice.
 */
export async function careNotificationArrived(referenceId: string, at: Date = new Date()): Promise<void> {
  await load();
  const replaced = alertsReplacedByPush(Object.values(state.care).flat(), referenceId, at).filter((k) => !state.careOff.includes(k));
  if (!replaced.length) return;
  await save({ ...state, careOff: [...state.careOff, ...replaced] });
  await syncReminders();
}

/** A tapped care-plan reminder: whose plan it is (null = the signed-in patient), or undefined if it was not one. */
export function careReminderPerson(response: Notifications.NotificationResponse): string | null | undefined {
  const data = response.notification.request.content.data as { kind?: unknown; patient?: unknown } | null | undefined;
  if (data?.kind !== "care") return undefined;
  return typeof data.patient === "string" ? data.patient : null;
}

/** Keeps the lock-screen wording in step with the patient's "Show details" switch. */
export async function setReminderDetails(showDetails: boolean): Promise<void> {
  await load();
  if (state.showDetails === showDetails) return;
  await save({ ...state, showDetails });
  await syncReminders(true);
}

/** Sign-out and account deletion: nothing scheduled and nothing kept. */
export async function cancelAllReminders(): Promise<void> {
  state = EMPTY;
  loaded = Promise.resolve();
  emit();
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
  await Notifications.dismissAllNotificationsAsync().catch(() => {});
  await encryptedStorage.removeItem(STORE_KEY).catch(() => {});
  loaded = null;
}

/**
 * A tap on a medicine reminder or one of its buttons. Returns true when the notification
 * was a reminder (the app then shows Home, where "Today's medicines" is).
 */
export function handleReminderResponse(response: Notifications.NotificationResponse): boolean {
  const key = keyOf(response.notification.request);
  if (!key) return false;
  if (response.actionIdentifier === ACTION_TAKEN) setTaken(key, true);
  else if (response.actionIdentifier === ACTION_SNOOZE) snooze(key);
  Notifications.dismissNotificationAsync(response.notification.request.identifier).catch(() => {});
  return true;
}
