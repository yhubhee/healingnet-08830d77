// Health: my health card (the health fields of src/pages/patient/Profile.tsx), prescriptions,
// share my records, and the sections that arrive in the next update.
import { Award, ChevronRight, FileText, FlaskConical, Pencil, Pill, ShieldCheck } from "@/components/icons";
import type { LucideIcon } from "@/components/icons";
import { router } from "expo-router";
import { View } from "react-native";
import { Screen } from "@/components/Screen";
import { Button, Card, Chip, Heading, Label, ListSkeleton, Small, Strong } from "@/components/ui";
import { useRxDocuments } from "@/lib/data";
import { profileKey, usePatient } from "@/lib/session";
import { openWeb } from "@/lib/web";
import { useQueryClient } from "@tanstack/react-query";
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

export default function Health() {
  const qc = useQueryClient();
  const { profile: p, userId } = usePatient();
  const rx = useRxDocuments();
  const valid = (rx.data ?? []).filter((d) => d.status === "valid").length;
  const profileState = qc.getQueryState(profileKey(userId));

  return (
    <Screen tab title="Health" updatedAt={profileState?.dataUpdatedAt || undefined}
      onRefresh={() => { qc.invalidateQueries({ queryKey: ["profile"] }); rx.refetch(); }} refreshing={rx.isRefetching}>
      {!p ? <ListSkeleton rows={1} height={180} /> : (
        <Card style={{ gap: space.md }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Label style={{ flex: 1 }}>My health card</Label>
            <Button small variant="ghost" icon={Pencil} label="Edit" accessibilityLabel="Edit my health card" onPress={() => router.push("/complete-profile?edit=1")} />
          </View>
          <Heading>{p.first_name} {p.last_name}</Heading>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
            <Fact label="Blood group" value={p.blood_group} />
            <Fact label="Genotype" value={p.genotype} />
          </View>
          <View>
            <Small>Emergency contact</Small>
            <Strong>{[p.emergency_contact_name, p.emergency_contact_phone].filter(Boolean).join(" · ") || "Not set"}</Strong>
          </View>
        </Card>
      )}

      <Row icon={Pill} title="Prescriptions" onPress={() => router.push("/prescriptions")}
        text={rx.data ? (valid > 0 ? `${valid} valid now. Show the code or QR at a pharmacy.` : "Your prescriptions and their QR codes.") : "Your prescriptions and their QR codes."} />
      <Row icon={ShieldCheck} title="Share my records" text="A one-time code to show at a hospital's front desk." onPress={() => router.push("/share-records")} />

      <Heading>More</Heading>
      <Row icon={FlaskConical} title="Lab results" chip="Coming in the next update" text="Opens the website for now." onPress={() => openWeb("/patient/lab-results")} />
      <Row icon={FileText} title="Records" chip="Coming in the next update" text="Opens the website for now." onPress={() => openWeb("/patient/medical-records")} />
      <Row icon={Award} title="Letters" chip="Coming in the next update" text="Opens the website for now." onPress={() => openWeb("/patient/letters")} />
    </Screen>
  );
}
