// "Remind me" for one medicine: the app suggests times from how often it is taken; the
// patient can change them, and how many days the reminders run.
import { Plus, Trash2 } from "./icons";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { Platform, ScrollView, View } from "react-native";
import { askPushPermission, pushPermission } from "@/lib/push";
import { removeReminder, saveReminder } from "@/lib/reminders";
import { fmt12 } from "@/shared/dates";
import type { RxItem } from "@/shared/pharmacy";
import {
  cleanTimes, DEFAULT_DAYS, localDate, MAX_DAYS, MAX_TIMES, parseDurationDays, suggestTimes, toTime, type Reminder,
} from "@/shared/reminders";
import { space, useTheme } from "@/theme";
import { Field, Sheet } from "./form";
import { useToast } from "./toast";
import { Body, Button, IconButton, Notice, Small, Strong } from "./ui";

const asDate = (time: string) => { const [h, m] = time.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d; };

export function ReminderSheet({ item, documentId, existing, onClose }: {
  item: RxItem | null;
  documentId: string;
  existing: Reminder | null;
  onClose: () => void;
}) {
  const { scheme } = useTheme();
  const toast = useToast();
  const [times, setTimes] = useState<string[]>([]);
  const [days, setDays] = useState(String(DEFAULT_DAYS));
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const suggestion = suggestTimes(item?.frequency);
  const id = item?.prescription_id;
  useEffect(() => {
    if (!item) return;
    setEditing(null);
    setTimes(existing ? existing.times : suggestTimes(item.frequency).times);
    setDays(String(existing ? existing.days : parseDurationDays(item.duration) ?? DEFAULT_DAYS));
    // Only when the sheet opens for a medicine, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setTime = (index: number, value: string) => setTimes((list) => cleanTimes(list.map((t, i) => (i === index ? value : t))));

  function pick(index: number) {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({ value: asDate(times[index]), mode: "time", is24Hour: false, onChange: (e, d) => { if (e.type === "set" && d) setTime(index, toTime(d)); } });
    } else {
      setEditing(index);
    }
  }

  function add() {
    // The next free hour after the last time, or 8:00 for the first.
    const last = times[times.length - 1];
    let hour = last ? (Number(last.slice(0, 2)) + 4) % 24 : 8;
    while (times.includes(`${String(hour).padStart(2, "0")}:00`)) hour = (hour + 1) % 24;
    setTimes(cleanTimes([...times, `${String(hour).padStart(2, "0")}:00`]));
  }

  const dayCount = Number(days);
  const daysOk = /^\d{1,3}$/.test(days.trim()) && dayCount >= 1 && dayCount <= MAX_DAYS;

  async function save() {
    if (!item || times.length === 0 || !daysOk) return;
    setBusy(true);
    try {
      // Reminders are notifications, so the phone has to allow them.
      let permission = await pushPermission();
      if (permission === "undetermined") permission = await askPushPermission();
      if (permission !== "granted" && permission !== "unavailable") {
        toast.error("Notifications are off for HealingNet. Turn them on in your phone's settings to get reminders.");
        return;
      }
      await saveReminder({
        id: item.prescription_id, documentId, drug: item.drug_name, dose: item.dosage, times,
        // Changing the times keeps the original first day, so the course still ends when it should.
        startDate: existing?.startDate ?? localDate(new Date()), days: dayCount,
      });
      toast.success(existing ? "Reminders changed" : "Reminders set");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!item) return;
    setBusy(true);
    await removeReminder(item.prescription_id);
    setBusy(false);
    toast.success("Reminders turned off");
    onClose();
  }

  return (
    <Sheet visible={!!item} onClose={onClose} title={`Remind me: ${item?.drug_name ?? ""}`}
      footer={
        <>
          <Button label={existing ? "Save changes" : "Set reminders"} onPress={save} loading={busy} disabled={times.length === 0 || !daysOk}
            disabledReason={times.length === 0 ? "Add at least one time" : "Enter how many days"} />
          {existing ? <Button label="Turn off reminders" variant="dangerGhost" onPress={turnOff} disabled={busy} /> : null}
        </>
      }>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md }}>
        <Body muted>{[item?.dosage, item?.frequency, item?.duration].filter(Boolean).join(" · ") || "No dose given"}</Body>
        {suggestion.kind === "as_needed" ? <Notice text="This medicine is taken only when needed, so no times are suggested. Add times only if your doctor told you to." />
          : suggestion.kind === "unknown" ? <Notice text="We couldn't work out the times from the prescription. Add the times your doctor or pharmacist told you." />
          : !existing ? <Small>Suggested from “{item?.frequency}”. Change any time to suit your day.</Small> : null}

        {times.map((t, i) => (
          <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Button label={fmt12(t)} variant="secondary" style={{ flex: 1 }} onPress={() => pick(i)} accessibilityLabel={`Reminder at ${fmt12(t)}. Change the time`} />
            <IconButton icon={Trash2} label={`Remove the ${fmt12(t)} reminder`} onPress={() => { setEditing(null); setTimes(times.filter((x) => x !== t)); }} />
          </View>
        ))}
        {Platform.OS === "ios" && editing !== null && times[editing] ? (
          <DateTimePicker value={asDate(times[editing])} mode="time" display="spinner" themeVariant={scheme}
            onChange={(_e, d) => { if (d) { const next = toTime(d); const list = cleanTimes(times.map((t, i) => (i === editing ? next : t))); setTimes(list); setEditing(list.indexOf(next)); } }} />
        ) : null}
        {times.length === 0 ? <Strong>No times yet</Strong> : null}
        {times.length < MAX_TIMES ? <Button small label="Add a time" icon={Plus} variant="ghost" onPress={add} /> : null}

        <Field label="For how many days" value={days} onChangeText={setDays} keyboardType="number-pad" maxLength={3}
          error={daysOk ? undefined : `Enter a number from 1 to ${MAX_DAYS}.`}
          hint={parseDurationDays(item?.duration) ? `From the prescription: ${item?.duration}. Reminders stop after the last day.` : "Reminders stop after the last day."} />
        <Small>Reminders stay on this phone. The lock screen says “Time for your medicine”; it names the medicine only if “Show details on the lock screen” is on in Settings, Notifications.</Small>
      </ScrollView>
    </Sheet>
  );
}
