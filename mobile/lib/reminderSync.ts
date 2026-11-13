// Keeps medicine reminders topped up while a patient is signed in.
import { useEffect } from "react";
import { AppState } from "react-native";
import { usePushPrefs } from "./data";
import { setReminderDetails, syncReminders } from "./reminders";

/** Mounted once for a signed-in patient: top up on open and on return, and follow the details switch. */
export function useReminderSync(active: boolean) {
  const prefs = usePushPrefs();
  const showDetails = prefs.data?.push_show_details;
  useEffect(() => {
    if (!active) return;
    syncReminders();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") syncReminders(); });
    return () => sub.remove();
  }, [active]);
  useEffect(() => { if (active && typeof showDetails === "boolean") setReminderDetails(showDetails); }, [active, showDetails]);
}
