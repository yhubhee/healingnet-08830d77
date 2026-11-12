// Settings → Notifications: switches that write to notification_preferences. The
// database reads them when it queues a push, and decides what the lock screen shows.
import { useEffect, useState } from "react";
import { Linking } from "react-native";
import { ToggleRow } from "@/components/form";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Button, Card, Divider, Label, Notice, Small } from "@/components/ui";
import { DEFAULT_PUSH_PREFS, usePushPrefs, useSavePushPrefs } from "@/lib/data";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { askPushPermission, pushPermission, registerForPush, type PushPermission } from "@/lib/push";
import type { PushPrefs } from "@/shared/database";
import { friendlyError } from "@/shared/errors";
import { space } from "@/theme";

export default function NotificationSettings() {
  const toast = useToast();
  const online = useOnline();
  const q = usePushPrefs();
  const save = useSavePushPrefs();
  const [permission, setPermission] = useState<PushPermission>("undetermined");
  useEffect(() => { pushPermission().then(setPermission); }, []);

  const prefs = q.data ?? DEFAULT_PUSH_PREFS;
  const set = (patch: Partial<PushPrefs>) =>
    save.mutate(patch, {
      onSuccess: () => toast.success("Preferences saved"),
      onError: (e) => toast.error(friendlyError(e, "Could not save preferences")),
    });

  async function allow() {
    if (permission === "denied") return void Linking.openSettings();
    const result = await askPushPermission();
    setPermission(result);
    if (result === "granted") { await registerForPush(); toast.success("Notifications are on for this phone"); }
  }

  const off = !online;
  const groupOff = off || !prefs.push_enabled;

  return (
    <Screen title="Notifications" back onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      {permission === "unavailable" ? <Notice text="Push notifications need a real phone; they don't work on an emulator." /> : null}
      {permission === "undetermined" || permission === "denied" ? (
        <Card style={{ gap: space.sm }}>
          <Small muted={false}>Notifications are turned off for HealingNet on this phone.</Small>
          <Button small label={permission === "denied" ? "Open phone settings" : "Turn on notifications"} onPress={allow} />
        </Card>
      ) : null}
      {off ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}

      <QueryState query={q}>
        <Card style={{ gap: space.xs }}>
          <Label>Push notifications</Label>
          <ToggleRow label="Push notifications" hint="Send alerts to my phones" value={prefs.push_enabled} onChange={(v) => set({ push_enabled: v })} disabled={off} />
          <Divider />
          <ToggleRow label="Appointments" hint="Confirmations, changes and reminders" value={prefs.push_appointments} onChange={(v) => set({ push_appointments: v })} disabled={groupOff} />
          <Divider />
          <ToggleRow label="Prescriptions" hint="New prescriptions and pharmacy replies" value={prefs.push_prescriptions} onChange={(v) => set({ push_prescriptions: v })} disabled={groupOff} />
          <Divider />
          <ToggleRow label="Lab results" value={prefs.push_lab_results} onChange={(v) => set({ push_lab_results: v })} disabled={groupOff} />
          <Divider />
          <ToggleRow label="Other updates" hint="Letters, billing and account news" value={prefs.push_other} onChange={(v) => set({ push_other: v })} disabled={groupOff} />
        </Card>
        <Card style={{ gap: space.xs }}>
          <Label>Privacy</Label>
          <ToggleRow label="Show details on the lock screen" hint="Anyone who sees your phone can read them" value={prefs.push_show_details}
            onChange={(v) => set({ push_show_details: v })} disabled={groupOff} />
          <Small>When this is off, notifications say only "Appointment update" or similar.</Small>
        </Card>
      </QueryState>
      <Small>Everything is also kept in your Notifications list inside the app.</Small>
    </Screen>
  );
}
