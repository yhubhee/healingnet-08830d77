// Visits (src/pages/patient/Appointments.tsx): Upcoming and Past, with the website's exact
// status wording, cancel, reschedule, add to calendar and join call.
import { router } from "expo-router";
import { CalendarDays, CalendarPlus, RotateCcw, Video } from "lucide-react-native";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Segmented } from "@/components/form";
import { QueryState } from "@/components/QueryState";
import { RescheduleSheet } from "@/components/RescheduleSheet";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Chip, EmptyState, Heading, IconButton, Notice, Small } from "@/components/ui";
import { VisitFacts, visitWhen } from "@/components/VisitBits";
import { addToCalendar } from "@/lib/calendar";
import { appointmentsKey, useAppointments, useCancelAppointment, useRealtime } from "@/lib/data";
import { WEB_URL } from "@/lib/env";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { usePatient } from "@/lib/session";
import { openUrl } from "@/lib/web";
import {
  canCancel, canJoinCall, doctorOrPending, isUpcoming, sortUpcoming, statusText, statusTone, type Appointment,
} from "@/shared/appointments";
import { dbMessage } from "@/shared/errors";
import { consultUrl } from "@/shared/links";
import { space } from "@/theme";

type Tab = "upcoming" | "past";

export default function Visits() {
  const toast = useToast();
  const online = useOnline();
  const { patientId } = usePatient();
  const q = useAppointments();
  const cancel = useCancelAppointment();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [moving, setMoving] = useState<Appointment | null>(null);

  // Live updates while this screen is open (the hospital confirming, declining or assigning a doctor).
  useRealtime("patient_appointments", patientId ? `patient_id=eq.${patientId}` : null, [appointmentsKey(patientId)]);

  const all = q.data ?? [];
  const list = tab === "upcoming" ? sortUpcoming(all) : all.filter((a) => !isUpcoming(a));

  function confirmCancel(a: Appointment) {
    Alert.alert(
      "Cancel this appointment?",
      `Are you sure? ${doctorOrPending(a)} on ${visitWhen(a)}. The hospital will be told.`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Yes, cancel", style: "destructive",
          onPress: async () => {
            try {
              await cancel.mutateAsync(a.id);
              toast.success("Appointment cancelled");
            } catch (e) {
              toast.error(dbMessage(e));
            }
          },
        },
      ],
    );
  }

  async function calendar(a: Appointment) {
    const result = await addToCalendar(a);
    if (result === "saved") toast.success("Added to your calendar");
    else if (result === "failed") toast.error("We couldn't open your calendar.");
  }

  return (
    <Screen tab title="Visits" onRefresh={() => q.refetch()} refreshing={q.isRefetching} updatedAt={q.dataUpdatedAt || undefined}
      right={<IconButton icon={CalendarPlus} label="Book a doctor" onPress={() => router.push("/book")} />}>
      <Segmented label="Visits" value={tab} onChange={setTab} options={[{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }]} />
      {!online ? <Notice tone="warning" text="You're offline. Booking, cancelling and rescheduling need the internet." /> : null}
      <QueryState query={q}>
        {list.length === 0 ? (
          tab === "upcoming"
            ? <EmptyState icon={CalendarDays} title="No upcoming visits" text="Book a doctor and the hospital will confirm the time." actionLabel="Book a doctor" onAction={() => router.push("/book")} />
            : <EmptyState icon={CalendarDays} title="No past visits yet" text="Completed, cancelled and declined visits appear here." />
        ) : list.map((a) => {
          const upcoming = isUpcoming(a);
          return (
            <Card key={a.id} style={{ gap: space.md }}>
              <Chip label={statusText(a)} tone={statusTone(a.status)} />
              <View>
                <Heading>{doctorOrPending(a)}</Heading>
                {a.doctors?.specialty ? <Small>{a.doctors.specialty}</Small> : null}
              </View>
              <VisitFacts a={a} />
              {a.reason ? <Body>{a.reason}</Body> : null}
              {upcoming ? <Small>We'll remind you 24 hours and 1 hour before.</Small> : null}

              {canJoinCall(a) ? (
                <Button label="Join call" icon={Video} onPress={() => openUrl(consultUrl(WEB_URL, a.id))} disabled={!online} disabledReason={OFFLINE_ACTION} />
              ) : null}
              {a.status === "rejected" ? <Button label="Book again" icon={RotateCcw} onPress={() => router.push("/book")} /> : null}
              {upcoming ? (
                <View style={{ gap: space.sm }}>
                  <Button label="Add to calendar" variant="secondary" icon={CalendarPlus} onPress={() => calendar(a)} />
                  <View style={{ flexDirection: "row", gap: space.sm }}>
                    <Button label="Reschedule" variant="secondary" style={{ flex: 1 }} onPress={() => setMoving(a)} disabled={!online} disabledReason={OFFLINE_ACTION} />
                    {canCancel(a) ? (
                      <Button label="Cancel" variant="dangerGhost" style={{ flex: 1 }} onPress={() => confirmCancel(a)}
                        disabled={!online || cancel.isPending} disabledReason={OFFLINE_ACTION} accessibilityLabel="Cancel this appointment" />
                    ) : null}
                  </View>
                </View>
              ) : null}
            </Card>
          );
        })}
      </QueryState>
      <RescheduleSheet appointment={moving} onClose={() => setMoving(null)} />
    </Screen>
  );
}
