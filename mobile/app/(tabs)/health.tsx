// Health: my health card (allergies, long-term conditions, blood group, genotype and
// emergency contact, from src/pages/patient/Profile.tsx), prescriptions, share my records,
// lab results, medical records and letters.
import { Award, ChevronRight, FileText, FlaskConical, HeartPulse, Pencil, Pill, ShieldCheck } from "@/components/icons";
import type { LucideIcon } from "@/components/icons";
import { router } from "expo-router";
import { View } from "react-native";
import { Screen } from "@/components/Screen";
import { Button, Card, Chip, Heading, Label, ListSkeleton, Small, Strong } from "@/components/ui";
import { useRxDocuments } from "@/lib/data";
import { useActivePerson } from "@/lib/family";
import { useScreenReady } from "@/lib/perf";
import { profileKey, usePatient } from "@/lib/session";
import { personKeys } from "@/shared/keys";
import { useQueryClient } from "@tanstack/react-query";
import { healthNote } from "@/shared/patientProfile";
import { space, useTheme } from "@/theme";

function Fact({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={{ flex: 1, minWidth: "45%" }}>
      <Small>{label}</Small>
      <Strong>{value || "Not set"}</Strong>
    </View>
  );
}

function Row({ icon: Icon, title, text, chip, onPress }: { icon: LucideIcon; title: string; text: string; chip?: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}. ${chip ? `${chip}. ` : ""}${text}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <Icon size={24} color={colors.primaryText} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Strong>{title}</Strong>
          {chip ? <Chip label={chip} /> : null}
          <Small>{text}</Small>
        </View>
        <ChevronRight size={20} color={colors.textMuted} />
      </View>
    </Card>
  );
}

const PRESCRIPTIONS_TEXT = "Prescriptions and their QR codes.";

export default function Health() {
  const qc = useQueryClient();
  const { profile: p, userId, isMe, patientId } = usePatient();
  const person = useActivePerson();
  const rx = useRxDocuments();
  const editCard = () => router.push(isMe ? "/complete-profile?edit=1" : { pathname: "/complete-profile", params: { edit: "1", person: patientId ?? "" } });
  const valid = (rx.data ?? []).filter((d) => d.status === "valid").length;
  useScreenReady("/(tabs)/health", !!p);
  const profileState = qc.getQueryState(isMe ? profileKey(userId) : personKeys.memberProfile(userId, patientId));

  return (
    <Screen tab title="Health" person="switch" updatedAt={profileState?.dataUpdatedAt || undefined}
      onRefresh={() => { qc.invalidateQueries({ queryKey: ["profile"] }); rx.refetch(); }} refreshing={rx.isRefetching}>
      {!p ? <ListSkeleton rows={1} height={180} /> : (
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Label style={{ flex: 1 }}>{isMe ? "My health card" : `${person.firstName}'s health card`}</Label>
            <Button small variant="ghost" icon={Pencil} label="Edit" accessibilityLabel={isMe ? "Edit my health card" : `Edit ${person.firstName}'s health card`} onPress={editCard} />
          </View>
          <Heading>{p.first_name} {p.last_name}</Heading>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
            <Fact label="Blood group" value={p.blood_group} />
            <Fact label="Genotype" value={p.genotype} />
          </View>
          <View>
            <Small>Allergies</Small>
            <Strong>{healthNote(p.allergies)}</Strong>
          </View>
          <View>
            <Small>Long-term conditions</Small>
            <Strong>{healthNote(p.medical_conditions)}</Strong>
          </View>
          <View>
            <Small>Emergency contact</Small>
            <Strong>{[p.emergency_contact_name, p.emergency_contact_phone].filter(Boolean).join(" · ") || "Not set"}</Strong>
          </View>
        </Card>
      )}

      <Row icon={Pill} title="Prescriptions" onPress={() => router.push("/prescriptions")}
        text={rx.data ? (valid > 0 ? `${valid} valid now. Show the code or QR at a pharmacy.` : PRESCRIPTIONS_TEXT) : PRESCRIPTIONS_TEXT} />
      <Row icon={HeartPulse} title="Care plan" text="Pregnancy and procedure plans from your hospital, with what to do and when." onPress={() => router.push("/care")} />
      <Row icon={ShieldCheck} title={isMe ? "Share my records" : `Share ${person.firstName}'s records`} text="A one-time code to show at a hospital's front desk." onPress={() => router.push("/share-records")} />

      <Heading>More</Heading>
      <Row icon={FlaskConical} title="Lab results" text="Every value, with what is outside the normal range." onPress={() => router.push("/lab-results")} />
      <Row icon={FileText} title="Medical records" text={isMe ? "Notes, vitals and diagnoses from your visits." : `Notes, vitals and diagnoses from ${person.firstName}'s visits.`} onPress={() => router.push("/records")} />
      <Row icon={Award} title="Letters" text="Sick leave, fit-to-work and other letters from the doctor." onPress={() => router.push("/letters")} />
    </Screen>
  );
}
