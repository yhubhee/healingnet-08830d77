// Push notifications: permission, registering this phone with the database, and opening
// the right screen when a notification is tapped. Nothing here logs tokens or content.
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Platform } from "react-native";
import { notificationTarget } from "@/shared/links";
import { APP_VERSION } from "./env";
import { careReminderPerson, handleReminderResponse } from "./reminders";
import { DEVICE_KEYS, getFlag, setFlag } from "./storage";
import { supabase } from "./supabase";

// A notification that arrives while the app is open still shows as a banner.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushPermission = "granted" | "denied" | "undetermined" | "unavailable";

export async function pushPermission(): Promise<PushPermission> {
  if (!Device.isDevice) return "unavailable";
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
  } catch {
    return "unavailable";
  }
}

/** Shows the system permission prompt. Only called from the explanation screen or Settings. */
export async function askPushPermission(): Promise<PushPermission> {
  if (!Device.isDevice) return "unavailable";
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted" ? "granted" : "denied";
  } catch {
    return "unavailable";
  }
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "HealingNet updates",
    importance: Notifications.AndroidImportance.HIGH,
    // The database decides what the lock screen may show; the channel itself allows it.
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Registers this phone for push if the user has allowed notifications. Called after
 * sign-in and on every app start. Quietly does nothing when push is not set up yet
 * (no permission, an emulator, or no EAS project id).
 */
export async function registerForPush(): Promise<boolean> {
  try {
    if ((await pushPermission()) !== "granted") return false;
    await ensureAndroidChannel();
    const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if (!projectId) return false;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (!token) return false;
    const { error } = await supabase.rpc("register_push_device", {
      p_token: token,
      p_platform: Platform.OS === "ios" ? "ios" : "android",
      p_app_version: APP_VERSION,
    });
    if (error) return false;
    await setFlag(DEVICE_KEYS.pushToken, token);
    return true;
  } catch {
    return false;
  }
}

/** Removes this phone's registration, so a shared phone stops getting the last user's alerts. */
export async function unregisterPush(): Promise<void> {
  const token = await getFlag(DEVICE_KEYS.pushToken);
  if (!token) return;
  await supabase.rpc("unregister_push_device", { p_token: token });
  await setFlag(DEVICE_KEYS.pushToken, null);
}

/** Told which notification was tapped, before its screen opens: switches to the family member it is about. */
export type BeforeOpen = (n: { subjectId?: string | null; notificationId?: string | null }) => Promise<void>;

const asId = (v: unknown) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

/** Opens the app screen for a tapped notification (its type and data.url); unknown ones open Home. */
async function openFromNotification(response: Notifications.NotificationResponse | null | undefined, beforeOpen?: BeforeOpen) {
  if (!response) return;
  // A medicine reminder (or its Taken / Snooze button): Home shows "Today's medicines".
  if (handleReminderResponse(response)) { router.navigate("/(tabs)"); return; }
  // A care-plan reminder kept on this phone: Care, for the person it is about.
  const carePerson = careReminderPerson(response);
  if (carePerson !== undefined) {
    try { await beforeOpen?.({ subjectId: carePerson ?? "me" }); } catch { /* open the screen anyway */ }
    router.navigate("/care");
    return;
  }
  const data = (response.notification.request.content.data ?? {}) as
    { url?: unknown; type?: unknown; reference_id?: unknown; notification_id?: unknown; subject_patient_id?: unknown };
  // The push carries the notification's id; who it is about is read from that row.
  const subject = asId(data.subject_patient_id);
  try { await beforeOpen?.({ subjectId: subject ?? undefined, notificationId: asId(data.notification_id) }); } catch { /* open the screen anyway */ }
  router.navigate(notificationTarget({ url: data.url, type: data.type, referenceId: data.reference_id }));
}

let handledInitial = false;

/** Call once the signed-in screens are mounted. Returns a cleanup function. */
export function listenForNotificationTaps(beforeOpen?: BeforeOpen): () => void {
  if (!handledInitial) {
    handledInitial = true;
    // The notification that opened the app from a cold start.
    try { openFromNotification(Notifications.getLastNotificationResponse(), beforeOpen).catch(() => {}); } catch { /* nothing to open */ }
  }
  const sub = Notifications.addNotificationResponseReceivedListener((r) => { openFromNotification(r, beforeOpen).catch(() => {}); });
  return () => sub.remove();
}
