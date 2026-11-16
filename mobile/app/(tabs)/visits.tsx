// Visits (src/pages/patient/Appointments.tsx): Upcoming and Past, with the website's exact
// status wording, cancel, reschedule, add to calendar, Rate your visit (completed visits
// from the last 30 days) and join call (the video visit opens in
// the in-app browser; see components/JoinCallSheet.tsx).
// The list is virtualised and its rows are memoised: a patient with a long history mounts
// only the few cards on screen, and the saved list shows before the network answers.
// One request (my_visits) brings the open visits and the latest 30 past ones; "Show older
// visits" loads 30 more at a time. A sheet is only mounted while it is open.
import { CalendarDays, CalendarPlus, QrCode } from "@/components/icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, View, type ListRenderItem } from "react-native";
import { NavRow, Segmented } from "@/components/form";
import { JoinCallSheet } from "@/components/JoinCallSheet";
import { loadState } from "@/components/QueryState";
import { RateVisitSheet } from "@/components/RateVisitSheet";
import { RescheduleSheet } from "@/components/RescheduleSheet";
import { ListScreen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Button, EmptyState, ErrorState, IconButton, ListSkeleton, Notice } from "@/components/ui";
import { VisitCard } from "@/components/VisitCard";
import { visitWhen } from "@/components/VisitBits";
import { addToCalendarWithToast, visitEvent } from "@/lib/calendar";
import { appointmentsKey, fetchVisits, useCancelAppointment, useRealtime, useVisits } from "@/lib/data";
import { useOnline } from "@/lib/net";
import { useScreenReady } from "@/lib/perf";
import { usePatient } from "@/lib/session";
import { doctorOrPending, pickCallToJoin, sortUpcoming, type Appointment } from "@/shared/appointments";
import { dbMessage, friendlyError } from "@/shared/errors";
import { addOlderPage, allVisits, mergePast, nextPastOffset } from "@/shared/visits";
import { space } from "@/theme";

type Tab = "upcoming" | "past";
const keyOf = (a: Appointment) => a.id;
const NO_OLDER: Appointment[] = [];

export default function Visits() {
  const toast = useToast();
  const online = useOnline();
  const { patientId } = usePatient();
  const q = useVisits();
  const { mutateAsync: cancelVisit, isPending: cancelling } = useCancelAppointment();
  const [tab, setTab] = useState<Tab>("upcoming");
  const [moving, setMoving] = useState<Appointment | null>(null);
  const [calling, setCalling] = useState<Appointment | null>(null);
  const [rating, setRating] = useState<Appointment | null>(null);
  // Older past visits loaded with "Show older visits", for the person on screen only.
  const [older, setOlder] = useState<{ patientId: string | null; rows: Appointment[]; more: boolean | null }>({ patientId: null, rows: [], more: null });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const olderRows = older.patientId === patientId ? older.rows : NO_OLDER;

  // Live updates while this screen is in front (the hospital confirming, declining or assigning a doctor).
  useRealtime("patient_appointments", patientId ? `patient_id=eq.${patientId}` : null, [appointmentsKey(patientId)]);

  const data = q.data;
  const all = useMemo(() => (data ? allVisits(data, olderRows) : undefined), [data, olderRows]);
  const list = useMemo(() => {
    if (!data) return [];
    return tab === "upcoming" ? sortUpcoming(data.upcoming) : mergePast(data.past, olderRows, data.upcoming);
  }, [data, olderRows, tab]);
  const hasOlder = older.patientId === patientId && older.more !== null ? older.more : data?.has_more_past === true;

  const showOlder = useCallback(async () => {
    if (!patientId || !data) return;
    setLoadingOlder(true);
    try {
      const page = await fetchVisits(patientId, nextPastOffset(data.past, olderRows));
      setOlder({ patientId, rows: addOlderPage(olderRows, page.past), more: page.has_more_past });
    } catch (e) {
      toast.error(friendlyError(e));
    }
    setLoadingOlder(false);
  }, [patientId, data, olderRows, toast]);

  // Opened from a "Your doctor is ready" notification (?join=<visit id>, or "ready"): fetch
  // the latest visits, then open the Join call sheet for that visit.
  const { join } = useLocalSearchParams<{ join?: string }>();
  const { refetch, isFetching } = q;
  useEffect(() => { if (join) refetch(); }, [join, refetch]);
  useEffect(() => {
    if (!join || !all) return;
    const target = pickCallToJoin(all, join);
    if (target) {
      setTab("upcoming");
      setCalling(target);
      router.setParams({ join: undefined });
    } else if (!isFetching) {
      router.setParams({ join: undefined }); // the call is over or the visit is gone: just show Visits
    }
  }, [join, all, isFetching]);

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
    await addToCalendarWithToast(visitEvent(a), toast);
  }, [toast]);


  const renderItem = useCallback<ListRenderItem<Appointment>>(({ item }) => (
    <VisitCard a={item} review={item.review ?? null} onRate={setRating} online={online} cancelling={cancelling} onCancel={confirmCancel} onReschedule={setMoving} onCalendar={calendar} onJoin={setCalling} />
  ), [online, cancelling, confirmCancel, calendar]);

  const state = loadState(q);
  useScreenReady("/(tabs)/visits", state !== "loading");
  const header = (
    <View style={{ gap: space.lg }}>
      <Segmented label="Visits" value={tab} onChange={setTab} options={[{ value: "upcoming", label: "Upcoming" }, { value: "past", label: "Past" }]} />
      <NavRow icon={QrCode} label="Check in at a hospital" hint="Scan the code at the front desk to join today's queue." onPress={() => router.push("/checkin")} />
      {!online ? <Notice tone="warning" text="You're offline. Booking, cancelling and rescheduling need the internet." /> : null}
    </View>
  );
  const empty = state === "loading" ? <ListSkeleton />
    : state !== "ready" ? <ErrorState offline={state === "offline"} message={friendlyError(q.error)} onRetry={() => q.refetch()} />
    : tab === "upcoming"
      ? <EmptyState icon={CalendarDays} title="No upcoming visits" text="Book a doctor and the hospital will confirm the time." actionLabel="Book a doctor" onAction={() => router.push("/book")} />
      : <EmptyState icon={CalendarDays} title="No past visits yet" text="Completed, cancelled and declined visits appear here." />;


  return (
    <ListScreen tab title="Visits" person="switch" data={list} keyExtractor={keyOf}
      listFooter={tab === "past" && hasOlder && list.length > 0 ? (
        <Button label="Show older visits" variant="secondary" onPress={showOlder} loading={loadingOlder} disabled={!online} disabledReason="You're offline. Older visits need the internet." />
      ) : null} renderItem={renderItem} header={header} empty={empty}
      onRefresh={() => q.refetch()} refreshing={q.isRefetching} updatedAt={q.dataUpdatedAt || undefined}
      right={<IconButton icon={CalendarPlus} label="Book a doctor" onPress={() => router.push("/book")} />}
      footer={
        <>
          {moving ? <RescheduleSheet appointment={moving} onClose={() => setMoving(null)} /> : null}
          {rating ? <RateVisitSheet appointment={rating} review={rating.review ?? null} onClose={() => setRating(null)} /> : null}
          {calling ? <JoinCallSheet appointment={calling} onClose={() => setCalling(null)} onReturned={() => q.refetch()} /> : null}
        </>
      } />
  );
}
