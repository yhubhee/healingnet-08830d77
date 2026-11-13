// Visits (src/pages/patient/Appointments.tsx): Upcoming and Past, with the website's exact
// status wording, cancel, reschedule, add to calendar, Rate your visit (completed visits
// from the last 30 days) and join call (the video visit opens in
// the in-app browser; see components/JoinCallSheet.tsx).
// The list is virtualised and its rows are memoised: a patient with a long history mounts
// only the few cards on screen, and the saved list shows before the network answers.
import { CalendarDays, CalendarPlus } from "@/components/icons";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, View, type ListRenderItem } from "react-native";
import { Segmented } from "@/components/form";
import { JoinCallSheet } from "@/components/JoinCallSheet";
import { loadState } from "@/components/QueryState";
import { RateVisitSheet } from "@/components/RateVisitSheet";
import { RescheduleSheet } from "@/components/RescheduleSheet";
import { ListScreen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { EmptyState, ErrorState, IconButton, ListSkeleton, Notice } from "@/components/ui";
import { VisitCard } from "@/components/VisitCard";
import { visitWhen } from "@/components/VisitBits";
import { addToCalendar } from "@/lib/calendar";
import { appointmentsKey, useAppointments, useCancelAppointment, useRealtime, useVisitReviews } from "@/lib/data";
import { useOnline } from "@/lib/net";
import { usePatient } from "@/lib/session";
import { doctorOrPending, isUpcoming, sortUpcoming, type Appointment } from "@/shared/appointments";
import { dbMessage, friendlyError } from "@/shared/errors";
import { space } from "@/theme";

type Tab = "upcoming" | "past";
const keyOf = (a: Appointment) => a.id;

export default function Visits() {
  const toast = useToast();
  const online = useOnline();
  const { patientId } = usePatient();
  const q = useAppointments();
  const { mutateAsync: cancelVisit, isPending: cancelling } = useCancelAppointment();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [moving, setMoving] = useState<Appointment | null>(null);
  const [calling, setCalling] = useState<Appointment | null>(null);
  const [rating, setRating] = useState<Appointment | null>(null);
  const reviews = useVisitReviews().data;

  // Live updates while this screen is in front (the hospital confirming, declining or assigning a doctor).
  useRealtime("patient_appointments", patientId ? `patient_id=eq.${patientId}` : null, [appointmentsKey(patientId)]);

  const all = q.data;
  const list = useMemo(() => {
    const rows = all ?? [];
    return tab === "upcoming" ? sortUpcoming(rows) : rows.filter((a) => !isUpcoming(a));
  }, [all, tab]);

  const confirmCancel = useCallback((a: Appointment) => {
    Alert.alert(
      "Cancel this appointment?",
      `Are you sure? ${doctorOrPending(a)} on ${visitWhen(a)}. The hospital will be told.`,
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Yes, cancel", style: "destructive",
          onPress: async () => {
            try {
              await cancelVisit(a.id);
              toast.success("Appointment cancelled");
            } catch (e) {
              toast.error(dbMessage(e));
            }
          },
        },
      ],
    );
  }, [cancelVisit, toast]);

  const calendar = useCallback(async (a: Appointment) => {
    const result = await addToCalendar(a);
    if (result === "saved") toast.success("Added to your calendar");
    else if (result === "failed") toast.error("We couldn't open your calendar.");
  }, [toast]);


  const renderItem = useCallback<ListRenderItem<Appointment>>(({ item }) => (
    <VisitCard a={item} review={reviews?.[item.id] ?? null} onRate={setRating} online={online} cancelling={cancelling} onCancel={confirmCancel} onReschedule={setMoving} onCalendar={calendar} onJoin={setCalling} />
  ), [reviews, online, cancelling, confirmCancel, calendar]);

  const state = loadState(q);
  const header = (
    <View style={{ gap: space.lg }}>
      <Segmented label="Visits" value={tab} onChange={setTab} options={[{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }]} />
      {!online ? <Notice tone="warning" text="You're offline. Booking, cancelling and rescheduling need the internet." /> : null}
    </View>
  );
  const empty = state === "loading" ? <ListSkeleton />
    : state !== "ready" ? <ErrorState offline={state === "offline"} message={friendlyError(q.error)} onRetry={() => q.refetch()} />
    : tab === "upcoming"
      ? <EmptyState icon={CalendarDays} title="No upcoming visits" text="Book a doctor and the hospital will confirm the time." actionLabel="Book a doctor" onAction={() => router.push("/book")} />
      : <EmptyState icon={CalendarDays} title="No past visits yet" text="Completed, cancelled and declined visits appear here." />;


  return (
    <ListScreen tab title="Visits" data={list} extraData={reviews} keyExtractor={keyOf} renderItem={renderItem} header={header} empty={empty}
      onRefresh={() => q.refetch()} refreshing={q.isRefetching} updatedAt={q.dataUpdatedAt || undefined}
      right={<IconButton icon={CalendarPlus} label="Book a doctor" onPress={() => router.push("/book")} />}
      footer={
        <>
          <RescheduleSheet appointment={moving} onClose={() => setMoving(null)} />
          <RateVisitSheet appointment={rating} review={rating ? reviews?.[rating.id] ?? null : null} onClose={() => setRating(null)} />
          <JoinCallSheet appointment={calling} onClose={() => setCalling(null)} onReturned={() => q.refetch()} />
        </>
      } />
  );
}
