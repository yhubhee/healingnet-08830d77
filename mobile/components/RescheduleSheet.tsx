// Reschedule a visit. Same rules and the same update as the website's
// RescheduleAppointmentDialog: times come from the doctor's published hours, up to 60 days
// ahead, and times the doctor already has booked are disabled.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRescheduleAppointment } from "@/lib/data";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { supabase } from "@/lib/supabase";
import type { Appointment } from "@/shared/appointments";
import { addDays, dayChip, dayOfWeek, fmt12, fmtLongDate, halfHours, lagosNowTime, lagosToday } from "@/shared/dates";
import { friendlyError } from "@/shared/errors";
import { fonts, MIN_TOUCH, radius, space, useTheme } from "@/theme";
import { Sheet } from "./form";
import { useToast } from "./toast";
import { Button, ListSkeleton, Notice, Small, Strong } from "./ui";

const DAYS_AHEAD = 60;

export function RescheduleSheet({ appointment, onClose }: { appointment: Appointment | null; onClose: () => void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const reschedule = useRescheduleAppointment();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const a = appointment;

  useEffect(() => { setDate(""); setTime(""); }, [a?.id]);

  const avail = useQuery({
    queryKey: ["reschedule", "availability", a?.doctor_id, a?.hospital_id, a?.is_telemedicine],
    enabled: !!a?.doctor_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("doctor_availability").select("*").eq("doctor_id", a!.doctor_id!).eq("is_available", true);
      if (error) throw error;
      return (data ?? []).filter((r) => {
        if (a!.is_telemedicine) return r.accepts_virtual;
        if (!r.accepts_in_person) return false;
        if (a!.hospital_id && r.hospital_id && r.hospital_id !== a!.hospital_id) return false;
        return true;
      });
    },
  });

  const booked = useQuery({
    queryKey: ["reschedule", "booked", a?.doctor_id, date, a?.id],
    enabled: !!a?.doctor_id && !!date,
    queryFn: async () => {
      const { data, error } = await supabase.from("patient_appointments").select("requested_time, status")
        .eq("doctor_id", a!.doctor_id!).eq("requested_date", date).in("status", ["pending", "accepted", "confirmed"]).neq("id", a!.id);
      if (error) throw error;
      return (data ?? []).map((r) => (r.requested_time || "").slice(0, 5)).filter(Boolean);
    },
  });

  const rows = avail.data ?? [];
  const today = lagosToday();
  const days = useMemo(() => {
    const dows = new Set(rows.map((r) => r.day_of_week));
    return Array.from({ length: DAYS_AHEAD + 1 }, (_, i) => addDays(today, i)).filter((d) => dows.has(dayOfWeek(d))).slice(0, 21);
  }, [rows, today]);
  const slots = useMemo(() => {
    if (!date) return [];
    const set = new Set<string>();
    rows.filter((r) => r.day_of_week === dayOfWeek(date)).forEach((r) => halfHours(r.start_time.slice(0, 5), r.end_time.slice(0, 5)).forEach((s) => set.add(s)));
    return [...set].sort();
  }, [date, rows]);
  const now = lagosNowTime();

  async function save() {
    if (!a || !date || !time) return;
    try {
      await reschedule.mutateAsync({ id: a.id, date, time });
      toast.success("Appointment rescheduled successfully");
      onClose();
    } catch (e) {
      toast.error(`Couldn't reschedule. ${friendlyError(e)}`);
    }
  }

  return (
    <Sheet visible={!!a} onClose={onClose} title="Reschedule appointment"
      footer={a?.doctor_id && rows.length > 0 ? (
        <>
          {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
          <Button label={date && time ? `Reschedule to ${fmtLongDate(date)}, ${fmt12(time)}` : "Reschedule"} onPress={save}
            loading={reschedule.isPending} disabled={!date || !time || !online} disabledReason={!online ? OFFLINE_ACTION : "Choose a date and a time first"} />
        </>
      ) : <Button label="Close" variant="secondary" onPress={onClose} />}>
      <ScrollView contentContainerStyle={{ gap: space.md, paddingBottom: space.sm }}>
        {!a?.doctor_id ? (
          <Notice text="Times come from the doctor's schedule, so this appointment can be rescheduled once a doctor is assigned." />
        ) : avail.isPending ? <ListSkeleton rows={2} height={56} /> : avail.isError ? (
          <Notice tone="danger" text={online ? friendlyError(avail.error) : OFFLINE_ACTION} />
        ) : rows.length === 0 ? (
          <Notice tone="warning" text="This doctor hasn't published availability yet." />
        ) : (
          <>
            <Strong>New date</Strong>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
              {days.map((d) => {
                const c = dayChip(d);
                const selected = d === date;
                return (
                  <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${c.weekday} ${fmtLongDate(d)}`}
                    onPress={() => { setDate(d); setTime(""); }}
                    style={{ minWidth: 68, minHeight: 76, borderRadius: radius.button, borderWidth: 1, alignItems: "center", justifyContent: "center", padding: space.sm,
                      borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card }}>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: selected ? colors.onPrimary : colors.textMuted }}>{d === today ? "Today" : c.weekday}</Text>
                    <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: selected ? colors.onPrimary : colors.text }}>{c.day}</Text>
                    <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: selected ? colors.onPrimary : colors.textMuted }}>{c.month}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {date ? (
              <>
                <Strong>New time</Strong>
                {slots.length === 0 ? <Small>No available slots for this date</Small> : (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                    {slots.map((s) => {
                      const taken = (booked.data ?? []).includes(s);
                      const past = date === today && s <= now;
                      const off = taken || past;
                      const selected = s === time;
                      return (
                        <Pressable key={s} disabled={off} accessibilityRole="button" accessibilityState={{ selected, disabled: off }}
                          accessibilityLabel={`${fmt12(s)}${taken ? ", already booked" : past ? ", already passed" : ""}`} onPress={() => setTime(s)}
                          style={{ width: "31%", minHeight: MIN_TOUCH, borderRadius: radius.input, borderWidth: 1, alignItems: "center", justifyContent: "center",
                            borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card, opacity: off ? 0.4 : 1 }}>
                          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: selected ? colors.onPrimary : colors.text, textDecorationLine: off ? "line-through" : "none" }}>{fmt12(s)}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </Sheet>
  );
}
