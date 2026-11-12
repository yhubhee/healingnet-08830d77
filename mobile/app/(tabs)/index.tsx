// Home (mirrors the data on src/pages/patient/Dashboard.tsx): next appointment, the two
// main actions, active prescriptions and the latest unread updates.
import { router } from "expo-router";
import { Bell, CalendarPlus, ChevronRight, Pill, Stethoscope } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Chip, Heading, IconButton, Label, LinkText, Skeleton, Small, Strong, Title } from "@/components/ui";
import { VisitFacts } from "@/components/VisitBits";
import { addToCalendar } from "@/lib/calendar";
import { useAppointments, useHomeSummary, useMarkNotificationRead, useRxDocuments, useRxExtras } from "@/lib/data";
import { useOnline } from "@/lib/net";
import { usePatient } from "@/lib/session";
import { openWeb } from "@/lib/web";
import { doctorOrPending, sortUpcoming, statusText } from "@/shared/appointments";
import { timeAgo } from "@/shared/dates";
import { screenForUrl } from "@/shared/links";
import { rxNextAction } from "@/shared/pharmacy";
import { MIN_TOUCH, radius, space, useTheme } from "@/theme";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Tile({ icon: Icon, title, text, onPress }: { icon: LucideIcon; title: string; text: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${text}`} onPress={onPress}
      style={({ pressed }) => ({
        flex: 1, minHeight: 132, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
        padding: space.lg, gap: space.sm, opacity: pressed ? 0.85 : 1,
      })}>
      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
        <Icon size={24} color={colors.primaryText} />
      </View>
      <Strong>{title}</Strong>
      <Small>{text}</Small>
    </Pressable>
  );
}

export default function Home() {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const { profile } = usePatient();
  const appts = useAppointments();
  const rx = useRxDocuments();
  const extras = useRxExtras();
  const summary = useHomeSummary();
  const markRead = useMarkNotificationRead();

  const next = sortUpcoming(appts.data ?? [])[0] ?? null;
  const validRx = (rx.data ?? []).filter((d) => d.status === "valid");
  const refreshing = appts.isRefetching || rx.isRefetching || summary.isRefetching;
  const refresh = () => { appts.refetch(); rx.refetch(); extras.refetch(); summary.refetch(); };
  const updatedAt = Math.max(appts.dataUpdatedAt, rx.dataUpdatedAt, summary.dataUpdatedAt) || undefined;

  async function calendar() {
    if (!next) return;
    const result = await addToCalendar(next);
    if (result === "saved") toast.success("Added to your calendar");
    else if (result === "failed") toast.error("We couldn't open your calendar.");
  }

  return (
    <Screen tab onRefresh={refresh} refreshing={refreshing} updatedAt={updatedAt}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Small>{greeting()}</Small>
          <Title numberOfLines={2}>{profile?.first_name ? `Hello, ${profile.first_name}` : "Hello"}</Title>
        </View>
        <IconButton icon={Bell} label={summary.data?.unreadCount ? `Notifications, ${summary.data.unreadCount} unread` : "Notifications"}
          badge={summary.data?.unreadCount} onPress={() => router.push("/notifications")} />
      </View>

      {/* Next appointment */}
      <QueryState query={appts} skeleton={<Skeleton height={190} />}>
      {next ? (
        <View style={{ backgroundColor: colors.hero, borderRadius: 24, padding: space.xl, gap: space.md }}>
          <Label color={colors.onHeroMuted}>Next appointment</Label>
          <Chip label={statusText(next)} onHero />
          <Pressable accessibilityRole="button" accessibilityLabel={`${doctorOrPending(next)}. Open visits`} onPress={() => router.navigate("/(tabs)/visits")}
            style={{ minHeight: MIN_TOUCH, justifyContent: "center" }}>
            <Heading color={colors.onHero} style={{ fontSize: 22, lineHeight: 28 }}>{doctorOrPending(next)}</Heading>
            {next.doctors?.specialty ? <Small color={colors.onHeroMuted}>{next.doctors.specialty}</Small> : null}
          </Pressable>
          <VisitFacts a={next} color={colors.onHero} />
          <Button label="Add to calendar" variant="onHero" icon={CalendarPlus} onPress={calendar} />
        </View>
      ) : (
        <Card style={{ gap: space.md }}>
          <Label>Next appointment</Label>
          <Strong>No upcoming visits</Strong>
          <Small>Book a doctor at a hospital near you. The hospital confirms the time.</Small>
          <Button label="Book a doctor" icon={CalendarPlus} onPress={() => router.push("/book")} />
        </Card>
      )}
      </QueryState>

      {/* Main actions */}
      <View style={{ flexDirection: "row", gap: space.md }}>
        <Tile icon={Stethoscope} title="Check symptoms" text="Answer a few questions. Opens the website." onPress={() => openWeb("/patient/triage")} />
        <Tile icon={CalendarPlus} title="Book a doctor" text="Choose a hospital, doctor and time." onPress={() => router.push("/book")} />
      </View>

      {/* Active prescriptions */}
      <QueryState query={rx} skeleton={<Skeleton height={110} />}>
        <Card onPress={() => router.push("/prescriptions")} accessibilityLabel={`Active prescriptions: ${validRx.length}. Open prescriptions`} style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
              <Pill size={24} color={colors.primaryText} />
            </View>
            <View style={{ flex: 1 }}>
              <Strong>{validRx.length === 0 ? "No active prescriptions" : `${validRx.length} active prescription${validRx.length === 1 ? "" : "s"}`}</Strong>
              <Small>{validRx.length === 0 ? "Prescriptions from your doctor appear here." : rxNextAction(validRx[0], extras.data?.requests ?? [])}</Small>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </View>
        </Card>
      </QueryState>

      {/* Updates */}
      <View style={{ gap: space.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Heading>Updates</Heading>
          <LinkText label="See all" onPress={() => router.push("/notifications")} />
        </View>
        <QueryState query={summary} skeleton={<Skeleton height={72} />}>
        {(summary.data?.updates ?? []).length === 0 ? (
          <Card><Body muted>You're all caught up.</Body></Card>
        ) : (
          summary.data!.updates.map((n) => (
            <Card key={n.id} accessibilityLabel={`${n.title}. ${n.message ?? ""}`} style={{ gap: 4 }}
              onPress={() => { if (online) markRead.mutate(n.id); router.navigate(screenForUrl(n.action_url)); }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
                <Strong style={{ flex: 1 }}>{n.title}</Strong>
                <Chip label="New" tone="coral" />
              </View>
              {n.message ? <Small numberOfLines={3}>{n.message}</Small> : null}
              <Small>{timeAgo(n.created_at)}</Small>
            </Card>
          ))
        )}
        </QueryState>
      </View>
    </Screen>
  );
}
