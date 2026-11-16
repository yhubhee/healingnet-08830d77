// Home (mirrors the data on src/pages/patient/Dashboard.tsx): next appointment, "Your
// health" (prescriptions, lab results, records and letters at a glance), the two main
// actions, today's medicines (from reminders kept on this phone), the latest unread updates
// and the family row. Each section draws from its own saved data: none waits for another.
import { Award, Bell, CalendarPlus, Check, ChevronRight, FileText, FlaskConical, HeartPulse, Pill, QrCode, Stethoscope, Users } from "@/components/icons";
import type { LucideIcon } from "@/components/icons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { PersonChip } from "@/components/PersonSwitcher";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Chip, Heading, IconButton, Label, LinkText, Skeleton, Small, Strong, Title } from "@/components/ui";
import { VisitFacts } from "@/components/VisitBits";
import { addToCalendarWithToast, visitEvent } from "@/lib/calendar";
import { useCare } from "@/lib/care";
import { useMyCheckins } from "@/lib/checkin";
import { useHealthOverview, useHomeSummary, useMarkNotificationRead, useVisits } from "@/lib/data";
import { activePerson } from "@/lib/activePerson";
import { useActivePerson, useFamilyNext, useShowPersonFor } from "@/lib/family";
import { useOnline } from "@/lib/net";
import { useScreenReady } from "@/lib/perf";
import { setTaken, useReminders } from "@/lib/reminders";
import { useSession } from "@/lib/session";
import { doctorOrPending, sortUpcoming, statusText } from "@/shared/appointments";
import { hasActiveCare, nextCareLine } from "@/shared/care";
import { currentCheckin, queueLine } from "@/shared/checkin";
import { fmt12, fmtDayDate, timeAgo } from "@/shared/dates";
import { ageText } from "@/shared/family";
import { notificationTarget } from "@/shared/links";
import { verifyBanner } from "@/shared/verification";
import { cardSpoken, overviewCards, type OverviewCard, type OverviewCardId } from "@/shared/overview";
import { remindersFor, todaysDoses } from "@/shared/reminders";
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

const CARD_ICON: Record<OverviewCardId, LucideIcon> = { prescriptions: Pill, labs: FlaskConical, records: FileText, letters: Award };
const CARD_SCREEN: Record<OverviewCardId, "/prescriptions" | "/lab-results" | "/records" | "/letters"> = {
  prescriptions: "/prescriptions", labs: "/lab-results", records: "/records", letters: "/letters",
};

/** One "Your health" card: icon, title, one line of status and a count, and it opens its screen. */
function HealthCard({ card }: { card: OverviewCard }) {
  const { colors } = useTheme();
  const Icon = CARD_ICON[card.id];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${cardSpoken(card)}. Open ${card.title.toLowerCase()}`}
      onPress={() => router.push(CARD_SCREEN[card.id])}
      style={({ pressed }) => ({
        flexBasis: "47%", flexGrow: 1, minHeight: 124, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border,
        backgroundColor: colors.card, padding: space.md, gap: space.xs, opacity: pressed ? 0.85 : 1,
      })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <Icon size={22} color={colors.primaryText} />
        </View>
        <View style={{ flex: 1 }} />
        {card.count !== null ? <Chip label={card.highlight ? `${card.count} new` : String(card.count)} tone={card.highlight ? "coral" : "neutral"} /> : null}
      </View>
      <Strong numberOfLines={1}>{card.title}</Strong>
      <Small numberOfLines={2}>{card.status}</Small>
    </Pressable>
  );
}

export default function Home() {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  // The greeting is always for the account holder; the chip below says who the page is for.
  const { profile, patientId: ownId } = useSession();
  const person = useActivePerson();
  const showPersonFor = useShowPersonFor();
  const appts = useVisits();
  const overview = useHealthOverview();
  const summary = useHomeSummary();
  const markRead = useMarkNotificationRead();
  // Today's place in a hospital's queue, while a check-in is open.
  const checkins = useMyCheckins();
  const checkin = currentCheckin(checkins.data ?? []);
  // The fifth "Your health" card: only for an active pregnancy or an upcoming procedure.
  const care = useCare();
  const careLine = hasActiveCare(care.data) ? nextCareLine(care.data!, new Date()) : null;
  const { reminders, taken } = useReminders();
  // Each person's medicines are kept apart: only the active person's show here.
  const doses = todaysDoses(remindersFor(reminders, person.isMe ? null : person.patientId), new Date());

  // Family row: everyone except the person on screen, each with their next visit.
  const others = [
    ...(person.isMe ? [] : [{ id: null as string | null, patientId: ownId, name: "Me", sub: "" }]),
    ...person.family.filter((m) => person.isMe || m.patient_id !== person.patientId)
      .map((m) => ({ id: m.patient_id as string | null, patientId: m.patient_id as string | null, name: m.first_name, sub: ageText(m.age) })),
  ];
  const familyNext = useFamilyNext(person.family.length ? others.map((o) => o.patientId).filter((v): v is string => !!v) : []);

  const banner = verifyBanner(person.family);
  const next = sortUpcoming(appts.data?.upcoming ?? [])[0] ?? null;
  const refreshing = appts.isRefetching || overview.isRefetching || summary.isRefetching;
  const refresh = () => { appts.refetch(); overview.refetch(); summary.refetch(); checkins.refetch(); care.refetch(); if (person.family.length) familyNext.refetch(); };
  const updatedAt = Math.max(appts.dataUpdatedAt, overview.dataUpdatedAt, summary.dataUpdatedAt) || undefined;

  useScreenReady("/(tabs)/index", appts.data !== undefined || appts.isError || appts.fetchStatus === "paused");

  async function calendar() {
    if (!next) return;
    await addToCalendarWithToast(visitEvent(next), toast);
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
      <PersonChip />

      {/* Family verification: shown while anyone still needs a document. */}
      {banner ? (
        <View accessibilityRole="alert" style={{ backgroundColor: banner.locked ? colors.dangerSoft : colors.warningBg, borderRadius: radius.card, padding: space.md, gap: space.sm }}>
          <Strong color={banner.locked ? colors.danger : colors.warningText}>{banner.text}</Strong>
          <Button small label="Verify" variant="secondary" accessibilityLabel={banner.text + " Verify"}
            onPress={() => router.push({ pathname: "/family/verify", params: { id: banner.patientId } })} />
        </View>
      ) : null}

      {/* In a hospital's queue today: the number and how many are ahead; "It's your turn" when called. */}
      {checkin ? (
        <Pressable accessibilityRole="button" accessibilityLiveRegion="polite"
          accessibilityLabel={`${checkin.status === "called" ? "It's your turn. " : ""}${queueLine(checkin)}. Open your place in the queue`}
          onPress={() => router.push("/checkin/status")}
          style={({ pressed }) => ({
            borderRadius: radius.card, padding: space.lg, gap: space.xs, opacity: pressed ? 0.85 : 1,
            backgroundColor: checkin.status === "called" ? colors.hero : colors.primarySoft,
          })}>
          {checkin.status === "called" ? <Heading color={colors.onHero} style={{ fontSize: 24, lineHeight: 30 }}>It's your turn</Heading> : <Label color={colors.primaryText}>{person.isMe ? "You're checked in" : `${person.firstName} is checked in`}</Label>}
          <Strong color={checkin.status === "called" ? colors.onHero : colors.text}>{checkin.status === "called" ? `Please go to the front desk at ${checkin.hospital_name}.` : queueLine(checkin)}</Strong>
        </Pressable>
      ) : null}

      {/* Next appointment */}
      <QueryState query={appts} skeleton={<Skeleton height={190} />}>
      {next ? (
        <View style={{ backgroundColor: colors.hero, borderRadius: 24, padding: space.xl, gap: space.md }}>
          <Label color={colors.onHeroMuted}>{person.isMe ? "Next appointment" : `${person.firstName}'s next appointment`}</Label>
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
          <Label>{person.isMe ? "Next appointment" : `${person.firstName}'s next appointment`}</Label>
          <Strong>No upcoming visits</Strong>
          <Small>Book a doctor at a hospital near you. The hospital confirms the time.</Small>
          <Button label="Book a doctor" icon={CalendarPlus} onPress={() => router.push("/book")} />
        </Card>
      )}
      </QueryState>

      {/* Your health: a skeleton only when nothing is saved; an error never hides the rest of Home. */}
      <View style={{ gap: space.sm }}>
        <Heading>{person.isMe ? "Your health" : `${person.firstName}'s health`}</Heading>
        {overview.data ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
            {overviewCards(overview.data).map((card) => <HealthCard key={card.id} card={card} />)}
            {careLine ? (
              <Pressable accessibilityRole="button" accessibilityLabel={`Care plan. ${careLine}. Open care plan`} onPress={() => router.push("/care")}
                style={({ pressed }) => ({
                  flexBasis: "100%", minHeight: 76, borderRadius: radius.card, borderWidth: 1, borderColor: colors.primaryText, backgroundColor: colors.primarySoft,
                  padding: space.md, flexDirection: "row", alignItems: "center", gap: space.md, opacity: pressed ? 0.85 : 1,
                })}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" }}>
                  <HeartPulse size={22} color={colors.primaryText} />
                </View>
                <View style={{ flex: 1 }}>
                  <Strong numberOfLines={1}>Care plan</Strong>
                  <Small numberOfLines={2} muted={false}>{careLine}</Small>
                </View>
                <ChevronRight size={20} color={colors.primaryText} />
              </Pressable>
            ) : null}
          </View>
        ) : overview.isError || overview.fetchStatus === "paused" ? (
          <Card style={{ gap: space.sm }}>
            <Small>{overview.fetchStatus === "paused" ? "You're offline. Your health summary appears when you reconnect." : "We couldn't load your health summary."}</Small>
            <LinkText label="Open Health" onPress={() => router.navigate("/(tabs)/health")} />
          </Card>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} height={124} style={{ flexBasis: "47%", flexGrow: 1 }} />)}
          </View>
        )}
      </View>

      {/* Main actions */}
      <View style={{ flexDirection: "row", gap: space.md }}>
        <Tile icon={Stethoscope} title="Check symptoms" text="Answer a few questions and see what to do next." onPress={() => router.push("/triage")} />
        <Tile icon={CalendarPlus} title="Book a doctor" text="Choose a hospital, doctor and time." onPress={() => router.push("/book")} />
      </View>
      <View style={{ flexDirection: "row", gap: space.md }}>
        <Tile icon={QrCode} title="Check in" text="At the hospital? Scan the code at the front desk to join the queue." onPress={() => router.push(checkin ? "/checkin/status" : "/checkin")} />
      </View>

      {/* Today's medicines: the day's reminder doses, each with a Taken tick. Kept on this phone. */}
      {doses.length > 0 ? (
        <Card style={{ gap: space.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Label style={{ flex: 1 }}>Today's medicines</Label>
            <Small>{doses.filter((d) => taken[d.key]).length} of {doses.length} taken</Small>
          </View>
          {doses.map((d) => {
            const done = !!taken[d.key];
            return (
              <Pressable key={d.key} accessibilityRole="checkbox" accessibilityState={{ checked: done }}
                accessibilityLabel={`${fmt12(d.time)}, ${d.drug}${d.dose ? `, ${d.dose}` : ""}. ${done ? "Taken" : "Not taken yet"}`}
                onPress={() => setTaken(d.key, !done)}
                style={{ minHeight: MIN_TOUCH + 4, flexDirection: "row", alignItems: "center", gap: space.md }}>
                <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: "center", justifyContent: "center",
                  borderColor: done ? colors.primary : colors.border, backgroundColor: done ? colors.primary : "transparent" }}>
                  {done ? <Check size={18} color={colors.onPrimary} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Strong style={done ? { textDecorationLine: "line-through" } : undefined}>{d.drug}</Strong>
                  <Small>{fmt12(d.time)}{d.dose ? ` · ${d.dose}` : ""}{done ? " · Taken" : ""}</Small>
                </View>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

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
              onPress={async () => {
                if (online) markRead.mutate(n.id);
                // About someone else in the family: show them first.
                await showPersonFor({ subjectId: n.subject_patient_id });
                router.navigate(notificationTarget({ url: n.action_url, type: n.type, referenceId: n.reference_id }));
              }}>
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

      {/* Family: each other person's next visit; tap to switch to them. */}
      {person.family.length > 0 ? (
        <Card style={{ gap: space.xs }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Users size={18} color={colors.textMuted} />
            <Label style={{ flex: 1 }}>Family</Label>
            <LinkText label="Manage" onPress={() => router.push("/family")} />
          </View>
          {others.map((o) => {
            const visit = o.patientId ? familyNext.data?.[o.patientId] : undefined;
            const when = visit ? `Next visit: ${fmtDayDate(visit.date)}${visit.time ? `, ${fmt12(visit.time)}` : ""}` : "No upcoming visit";
            return (
              <Pressable key={o.id ?? "me"} accessibilityRole="button" accessibilityLabel={`${o.name}. ${when}. Show ${o.id ? o.name : "my own records"}`}
                onPress={() => {
                  const member = person.family.find((m) => m.patient_id === o.id);
                  if (member && member.access_ok === false) router.push({ pathname: "/family/verify", params: { id: member.patient_id } });
                  else activePerson.set(o.id);
                }}
                style={({ pressed }) => ({ minHeight: MIN_TOUCH + 4, flexDirection: "row", alignItems: "center", gap: space.md, opacity: pressed ? 0.6 : 1 })}>
                <View style={{ flex: 1 }}>
                  <Strong>{o.name}{o.sub ? ` (${o.sub})` : ""}</Strong>
                  <Small>{when}</Small>
                </View>
                <ChevronRight size={20} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </Card>
      ) : null}

    </Screen>
  );
}
