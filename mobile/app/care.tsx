// Care (src/pages/patient/Care.tsx): the pregnancy and procedure plans the hospital shares,
// from my_care(). Words over colour, and dates in Nigerian format ("Tue 24 Nov, 9:00 am").
// The patient ticks tests, medicines, to-dos and instructions; visits are marked by the
// hospital. Dated items and the procedure can be added to the phone's calendar.
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import { CalendarCheck, CalendarPlus, Check, ClipboardList, FileText, FlaskConical, HeartPulse, Pill } from "@/components/icons";
import type { LucideIcon } from "@/components/icons";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Chip, EmptyState, ErrorState, Heading, Label, ListSkeleton, Notice, Small, Strong } from "@/components/ui";
import { addToCalendarWithToast } from "@/lib/calendar";
import { useCare, useSetCareItemDone } from "@/lib/care";
import { useActivePerson } from "@/lib/family";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import {
  bpFlag, careDateTime, careDay, careKindLabel, fastingLine, gestationText, groupCareItems, HOSPITAL_MARKS_VISITS, isActivePregnancy, isPast, NO_CARE_PLAN,
  patientCanTick, pregnancyProgress, pregnancyStatusText, procedureTypeText, surgeryArrival, surgeryStart, surgeryStatusText,
  type CareItem, type CareKind, type Pregnancy, type Surgery,
} from "@/shared/care";
import { fmt12 } from "@/shared/dates";
import { dbMessage, friendlyError } from "@/shared/errors";
import { MIN_TOUCH, space, useTheme } from "@/theme";

const KIND_ICON: Record<CareKind, LucideIcon> = { visit: CalendarCheck, test: FlaskConical, medicine: Pill, task: ClipboardList, instruction: FileText };

function Part({ title, children }: { title: string; children: ReactNode }) {
  return <View style={{ gap: space.sm }}><Label>{title}</Label>{children}</View>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <View><Small>{label}</Small><Strong>{value}</Strong></View>;
}

function Todo({ items, place }: { items: CareItem[]; place: string }) {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const tick = useSetCareItemDone();
  const g = groupCareItems(items);
  if (items.length === 0) return <Small>Nothing to do yet.</Small>;

  const row = (i: CareItem) => {
    const Icon = KIND_ICON[i.kind];
    const done = i.status === "done";
    const canTick = patientCanTick(i);
    const when = i.due_at ? careDateTime(i.due_at) : "";
    const note = done ? (i.done_by_patient ? "You marked this done" : "Marked done by the hospital") : i.kind === "visit" ? HOSPITAL_MARKS_VISITS : "";
    const toggle = () => {
      if (!online) { toast.info(OFFLINE_ACTION); return; }
      tick.mutate({ id: i.id, done: !done }, { onError: (e) => toast.error(dbMessage(e)) });
    };
    return (
      <View key={i.id} style={{ gap: space.xs, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.divider }}>
        <Pressable disabled={!canTick || tick.isPending} onPress={toggle}
          accessibilityRole={canTick ? "checkbox" : "text"} accessibilityState={canTick ? { checked: done } : undefined}
          accessibilityLabel={`${careKindLabel(i.kind)}: ${i.title}. ${when ? `${when}. ` : ""}${done ? "Done" : canTick ? "Not done yet" : HOSPITAL_MARKS_VISITS}`}
          style={{ minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "flex-start", gap: space.md }}>
          {canTick ? (
            <View style={{ width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: "center", justifyContent: "center", marginTop: 2,
              borderColor: done ? colors.primary : colors.border, backgroundColor: done ? colors.primary : "transparent" }}>
              {done ? <Check size={18} color={colors.onPrimary} /> : null}
            </View>
          ) : (
            <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center", marginTop: 2 }}>
              {done ? <Check size={18} color={colors.primaryText} /> : <Icon size={18} color={colors.primaryText} />}
            </View>
          )}
          <View style={{ flex: 1, gap: 2 }}>
            <Strong style={done ? { textDecorationLine: "line-through" } : undefined}>{i.title}</Strong>
            <Small>{[careKindLabel(i.kind), when ? `${when}${!done && isPast(i.due_at, new Date()) ? " (date has passed)" : ""}` : null, note || null].filter(Boolean).join(" · ")}</Small>
            {i.details ? <Body>{i.details}</Body> : null}
          </View>
        </Pressable>
        {!done && i.due_at && !isPast(i.due_at, new Date()) ? (
          <Button small variant="ghost" icon={CalendarPlus} label="Add to calendar" accessibilityLabel={`Add ${i.title} to your calendar`}
            onPress={() => {
              const start = new Date(i.due_at!);
              addToCalendarWithToast({ ref: `care:${i.id}:${i.due_at}`, title: i.title, start, end: new Date(start.getTime() + (i.kind === "visit" ? 60 : 30) * 60_000), location: place, notes: i.details ?? "From your HealingNet care plan." }, toast);
            }} />
        ) : null}
      </View>
    );
  };
  const group = (label: string, list: CareItem[]) => (list.length ? <View><Small muted={false} style={{ paddingBottom: space.xs }}>{label}</Small>{list.map(row)}</View> : null);
  return <View style={{ gap: space.md }}>{group("Upcoming", g.upcoming)}{group("No date", g.noDate)}{group("Done", g.done)}</View>;
}

function PregnancyCard({ p }: { p: Pregnancy }) {
  const { colors } = useTheme();
  const active = isActivePregnancy(p);
  const g = p.weeks_today !== null ? { weeks: p.weeks_today, days: p.days_extra ?? 0 } : null;
  const nextVisit = groupCareItems(p.items).upcoming.find((i) => i.kind === "visit" && !isPast(i.due_at, new Date()));
  return (
    <Card style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Chip label={`Pregnancy · ${pregnancyStatusText(p.status)}`} tone="primary" />
        <Heading style={{ fontSize: 26, lineHeight: 32 }}>{active && g ? gestationText(g) : pregnancyStatusText(p.status)}</Heading>
        <Small>{[p.hospital_name, p.doctor_name].filter(Boolean).join(" · ")}</Small>
      </View>
      {active && g ? (
        <View style={{ gap: space.xs }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space.sm }}>
            <Small muted={false}>{p.edd ? `Due date: ${careDay(p.edd)} ${p.edd.slice(0, 4)}` : "Due date not set"}</Small>
            <Small>{g.weeks} of 40 weeks</Small>
          </View>
          <View accessibilityRole="progressbar" accessibilityLabel={`${g.weeks} of 40 weeks`} accessibilityValue={{ min: 0, max: 40, now: Math.min(40, g.weeks) }}
            style={{ height: 10, borderRadius: 5, backgroundColor: colors.divider, overflow: "hidden" }}>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.primary, width: `${Math.round(pregnancyProgress(g) * 100)}%` }} />
          </View>
        </View>
      ) : null}
      {nextVisit ? <Notice tone="success" text={`Next visit: ${nextVisit.title} · ${careDateTime(nextVisit.due_at)}`} /> : null}
      {p.delivery_date ? (
        <Small muted={false}>Delivered {careDay(p.delivery_date)} {p.delivery_date.slice(0, 4)}{p.delivery_type ? ` · ${p.delivery_type} delivery` : ""}{p.baby_gender ? ` · baby ${p.baby_gender === "female" ? "girl" : "boy"}` : ""}{p.baby_weight ? ` · ${p.baby_weight} kg` : ""}</Small>
      ) : null}
      {p.patient_notes ? <Part title="Message from your doctor"><Body>{p.patient_notes}</Body></Part> : null}
      {p.visits.length > 0 ? (
        <Part title="Your last visits">
          {p.visits.slice(0, 6).map((v) => {
            const [sys, dia] = (v.bp ?? "").split("/").map(Number);
            const flag = v.bp ? bpFlag(sys, dia) : null;
            return (
              <View key={v.visit_date} style={{ paddingVertical: space.xs, borderTopWidth: 1, borderTopColor: colors.divider }}>
                <Strong>{careDay(v.visit_date)}{v.gestational_weeks !== null ? ` · ${v.gestational_weeks} weeks` : ""}</Strong>
                <Small>{[v.bp ? `Blood pressure ${v.bp}${flag ? ` (${flag})` : ""}` : null, v.weight_kg !== null ? `Weight ${v.weight_kg} kg` : null,
                  v.fetal_heart_rate !== null ? `Baby's heartbeat ${v.fetal_heart_rate} a minute` : null].filter(Boolean).join(" · ") || "No measurements recorded"}</Small>
              </View>
            );
          })}
        </Part>
      ) : null}
      <Part title="To do"><Todo items={p.items} place={p.hospital_name} /></Part>
    </Card>
  );
}

function SurgeryCard({ s }: { s: Surgery }) {
  const toast = useToast();
  const over = ["recovery", "completed"].includes(s.status);
  const upcoming = ["scheduled", "prep"].includes(s.status);
  const arrival = surgeryArrival(s);
  const start = surgeryStart(s);
  return (
    <Card style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <Chip label={`Procedure · ${surgeryStatusText(s.status)}`} tone="primary" />
        <Heading style={{ fontSize: 24, lineHeight: 30 }}>{s.procedure_name}</Heading>
        <Small>{[s.hospital_name, s.surgeon_name, procedureTypeText(s.procedure_type)].filter(Boolean).join(" · ")}</Small>
      </View>
      <View style={{ gap: space.md }}>
        <Fact label="Date and time" value={`${careDay(s.scheduled_date)}${s.scheduled_time ? `, ${fmt12(s.scheduled_time)}` : ""}`} />
        {s.admit_at ? <Fact label="Come to the hospital (admission)" value={careDateTime(s.admit_at)} /> : null}
        {s.fasting_from && !over ? <Fact label="No food or drink" value={fastingLine(s.fasting_from)} /> : null}
        {!over && s.status !== "cancelled" ? <Fact label="Consent form" value={s.consent_signed ? "Consent signed ✓" : "You'll sign the consent form at the hospital"} /> : null}
      </View>
      {upcoming && arrival && start && arrival.getTime() > Date.now() ? (
        <Button variant="secondary" icon={CalendarPlus} label="Add to calendar" accessibilityLabel={`Add ${s.procedure_name} to your calendar`}
          onPress={() => addToCalendarWithToast({
            ref: `surgery:${s.id}:${arrival.toISOString()}`, title: `${s.procedure_name} (${s.hospital_name})`, start: arrival,
            end: new Date(Math.max(start.getTime(), arrival.getTime()) + 2 * 3_600_000), location: s.hospital_name, notes: "Open HealingNet for your instructions.",
          }, toast)} />
      ) : null}
      {s.patient_instructions ? <Part title="Instructions"><Body>{s.patient_instructions}</Body></Part> : null}
      {s.post_op_instructions && over ? <Part title="After your operation"><Body>{s.post_op_instructions}</Body></Part> : null}
      <Part title="To do"><Todo items={s.items} place={s.hospital_name} /></Part>
    </Card>
  );
}

export default function Care() {
  const person = useActivePerson();
  const online = useOnline();
  const q = useCare();
  const data = q.data;
  const empty = !!data && data.pregnancies.length === 0 && data.surgeries.length === 0;
  return (
    <Screen title={person.isMe ? "Care plan" : `${person.firstName}'s care plan`} back person="switch"
      onRefresh={() => q.refetch()} refreshing={q.isRefetching} updatedAt={q.dataUpdatedAt || undefined}>
      {!data && (q.isLoading || q.fetchStatus === "fetching") ? <ListSkeleton rows={2} height={220} />
        : !data ? <ErrorState offline={!online} message={friendlyError(q.error)} onRetry={() => q.refetch()} />
        : empty ? <EmptyState icon={HeartPulse} title="No care plan yet" text={NO_CARE_PLAN} />
        : (
          <>
            {data.pregnancies.map((p) => <PregnancyCard key={p.id} p={p} />)}
            {data.surgeries.map((s) => <SurgeryCard key={s.id} s={s} />)}
            <Small style={{ textAlign: "center" }}>We remind you the day before and on the day, even without the internet.</Small>
          </>
        )}
    </Screen>
  );
}
