// One family member: who they are, their health card (edited through the profile form with
// their patient id), the "nearly an adult" note, and removing them from the account.
import { router, useLocalSearchParams } from "expo-router";
import type { ReactNode } from "react";
import { Alert, View } from "react-native";
import { Pencil, Trash2, UserRound } from "@/components/icons";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Button, Card, EmptyState, Heading, Label, ListSkeleton, Notice, Small, Strong } from "@/components/ui";
import { VerifyBadge } from "@/components/VerifyBadge";
import { verifyState } from "@/shared/verification";
import { activePerson } from "@/lib/activePerson";
import { useActivePerson, useFamily, useRemoveFamilyMember } from "@/lib/family";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { useMemberProfile } from "@/lib/session";
import { fmtLongDate, lagosToday } from "@/shared/dates";
import { dbMessage } from "@/shared/errors";
import { ageText, relationshipLabel, removeExplanation, turning18Note } from "@/shared/family";
import { healthNote } from "@/shared/patientProfile";
import { space } from "@/theme";

function Item({ label, value }: { label: string; value?: string | null }) {
  return <View><Small>{label}</Small><Strong>{value || "Not set"}</Strong></View>;
}
function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}><Label style={{ flex: 1 }}>{title}</Label>{action}</View>
      {children}
    </Card>
  );
}

export default function FamilyMemberScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const online = useOnline();
  const family = useFamily();
  const person = useActivePerson();
  const profile = useMemberProfile(id);
  const remove = useRemoveFamilyMember();
  const m = family.data?.find((x) => x.patient_id === id);
  const p = profile.data;
  const showing = !person.isMe && person.patientId === id;
  const refresh = () => { family.refetch(); profile.refetch(); };

  if (!m) {
    return (
      <Screen title="Family member" back onRefresh={refresh} refreshing={family.isRefetching}>
        {family.isPending ? <ListSkeleton /> : (
          <EmptyState icon={UserRound} title="Not in your family list" text="They may have been removed." actionLabel="Back to Family" onAction={() => router.replace("/family")} />
        )}
      </Screen>
    );
  }

  const note = turning18Note(m, lagosToday());
  const verify = verifyState(m);
  const openVerify = () => router.push({ pathname: "/family/verify", params: { id: m.patient_id } });
  const edit = () => router.push({ pathname: "/complete-profile", params: { edit: "1", person: m.patient_id } });

  function confirmRemove() {
    Alert.alert(`Remove ${m!.first_name}?`, removeExplanation(m!.first_name), [
      { text: "Keep", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          try {
            const result = await remove.mutateAsync(m!.patient_id);
            toast.success(result.held_by_hospitals
              ? `${m!.first_name} was removed. Hospitals that treated ${m!.first_name} keep their records.`
              : `${m!.first_name} was removed.`);
            if (router.canGoBack()) router.back(); else router.replace("/family");
          } catch (e) {
            toast.error(dbMessage(e));
          }
        },
      },
    ]);
  }

  return (
    <Screen title={m.first_name} back onRefresh={refresh} refreshing={family.isRefetching || profile.isRefetching}>
      <View style={{ gap: 2 }}>
        <Heading>{m.first_name} {m.last_name}</Heading>
        <Small>{[ageText(m.age) ? `Age ${ageText(m.age)}` : "", relationshipLabel(m.relationship)].filter(Boolean).join(" · ")}</Small>
      </View>

      {note ? <Notice text={note} /> : null}

      <Section title="Verification">
        <VerifyBadge member={m} lines={4} />
        {verify.locked ? <Small>{m.first_name}'s visits and records can't be opened until a document is accepted.</Small> : null}
        {verify.action ? <Button small label={verify.action} variant={verify.canUpload ? "primary" : "secondary"} onPress={openVerify} /> : null}
      </Section>

      <Button label={showing ? `Showing ${m.first_name} now` : `Show ${m.first_name}'s visits and records`} variant={showing ? "secondary" : "primary"} disabled={showing || verify.locked}
        disabledReason={verify.locked ? `${m.first_name} is locked until a document is accepted` : `The app is already showing ${m.first_name}`}
        onPress={() => { activePerson.set(m.patient_id); toast.info(`Showing ${m.first_name}`); router.replace("/(tabs)"); }} />

      <Section title="About">
        <Item label="Date of birth" value={fmtLongDate(m.date_of_birth)} />
        <Item label="Sex" value={m.gender ? m.gender[0].toUpperCase() + m.gender.slice(1) : null} />
        {m.linked_hospitals > 0 ? <Small>Treated at {m.linked_hospitals} hospital{m.linked_hospitals === 1 ? "" : "s"} on HealingNet.</Small> : null}
      </Section>

      <Section title="Health card" action={<Button small variant="ghost" icon={Pencil} label="Edit" accessibilityLabel={`Edit ${m.first_name}'s health card`} onPress={edit} />}>
        {verify.locked ? <Small>Locked until a document is accepted.</Small> : p === undefined ? <ListSkeleton rows={1} height={120} /> : p === null ? <Small>We couldn't load the health card. Pull down to try again.</Small> : (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
              <View style={{ flex: 1, minWidth: "45%" }}><Item label="Blood group" value={p.blood_group} /></View>
              <View style={{ flex: 1, minWidth: "45%" }}><Item label="Genotype" value={p.genotype} /></View>
            </View>
            <Item label="Allergies" value={healthNote(p.allergies)} />
            <Item label="Long-term conditions" value={healthNote(p.medical_conditions)} />
            <Item label="Emergency contact" value={[p.emergency_contact_name, p.emergency_contact_phone].filter(Boolean).join(" · ")} />
          </>
        )}
      </Section>

      {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
      <Button label={`Remove ${m.first_name}`} icon={Trash2} variant="dangerGhost" onPress={confirmRemove} loading={remove.isPending} disabled={!online} disabledReason={OFFLINE_ACTION} />
    </Screen>
  );
}
