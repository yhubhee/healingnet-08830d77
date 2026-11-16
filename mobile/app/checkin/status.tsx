// "You're checked in": the queue number, how many people are ahead, the hospital and the
// doctor. Refreshed every 30 seconds while the screen is open. "It's your turn" replaces the
// number's caption when the front desk calls. Leaving the queue asks first.
import { router } from "expo-router";
import { Alert, View } from "react-native";
import { QrCode } from "@/components/icons";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, EmptyState, ErrorState, Heading, Label, ListSkeleton, Small, Title } from "@/components/ui";
import { useCancelCheckin, useMyCheckins } from "@/lib/checkin";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { canLeaveQueue, checkinDetail, checkinHeadline, isOpenCheckin, type CheckinStatus } from "@/shared/checkin";
import { dbMessage, friendlyError } from "@/shared/errors";
import { fonts, space, useTheme } from "@/theme";

function StatusCard({ c }: { c: CheckinStatus }) {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const cancel = useCancelCheckin();
  const called = c.status === "called";
  const showNumber = c.status !== "in_consultation";

  const leave = () => Alert.alert("Leave the queue?", `You will lose your place at ${c.hospital_name}. You can scan the code again later.`, [
    { text: "Stay in the queue", style: "cancel" },
    {
      text: "Leave the queue", style: "destructive",
      onPress: () => cancel.mutate(c.checkin_id, { onSuccess: () => toast.success("You left the queue"), onError: (e) => toast.error(dbMessage(e)) }),
    },
  ]);

  return (
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: called ? colors.hero : colors.card, borderRadius: 24, borderWidth: called ? 0 : 1, borderColor: colors.border, padding: space.xl, gap: space.sm, alignItems: "center" }}>
      <Label color={called ? colors.onHeroMuted : colors.primaryText}>{checkinHeadline(c.status)}</Label>
      {showNumber ? (
        <>
          <Small color={called ? colors.onHeroMuted : undefined}>Your queue number</Small>
          <Title accessibilityLabel={`Queue number ${c.queue_number ?? "not known"}`} color={called ? colors.onHero : undefined}
            style={{ fontFamily: fonts.bold, fontSize: 88, lineHeight: 96 }}>{c.queue_number ?? "–"}</Title>
        </>
      ) : null}
      {checkinDetail(c) ? <Body color={called ? colors.onHero : undefined} style={{ textAlign: "center", fontFamily: fonts.semibold }}>{checkinDetail(c)}</Body> : null}
      <Small color={called ? colors.onHeroMuted : undefined} style={{ textAlign: "center" }}>{c.hospital_name}{c.doctor_name ? ` · ${c.doctor_name}` : ""}</Small>
      {canLeaveQueue(c) ? (
        <Button label="Leave the queue" variant="dangerGhost" onPress={leave} loading={cancel.isPending} disabled={!online} disabledReason={OFFLINE_ACTION} style={{ alignSelf: "stretch", marginTop: space.sm }} />
      ) : null}
    </View>
  );
}

export default function CheckInStatus() {
  const q = useMyCheckins(30_000);
  const online = useOnline();
  const open = (q.data ?? []).filter(isOpenCheckin);
  const finished = (q.data ?? []).filter((c) => c.status === "completed");

  return (
    <Screen title="Your place in the queue" back person="switch" onRefresh={() => q.refetch()} refreshing={q.isRefetching} updatedAt={q.dataUpdatedAt || undefined}>
      {q.data === undefined && q.isLoading ? <ListSkeleton rows={1} height={260} />
        : q.data === undefined ? <ErrorState offline={!online} message={friendlyError(q.error)} onRetry={() => q.refetch()} />
        : open.length > 0 ? open.map((c) => <StatusCard key={c.checkin_id} c={c} />)
        : finished.length > 0 ? (
          <Card style={{ gap: space.sm }}>
            <Heading>Your visit is finished</Heading>
            <Small>{finished[0].hospital_name}. Thank you for coming.</Small>
          </Card>
        ) : (
          <EmptyState icon={QrCode} title="You're not in a queue" text="Scan the QR code at a hospital's front desk to check in." actionLabel="Scan to check in" onAction={() => router.replace("/checkin")} />
        )}
    </Screen>
  );
}
