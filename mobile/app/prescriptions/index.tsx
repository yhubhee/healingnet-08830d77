// Prescriptions (src/pages/patient/Prescriptions.tsx): grouped by document, with status.
import { ChevronRight, Pill } from "@/components/icons";
import { router } from "expo-router";
import { memo, useCallback, useMemo, useState } from "react";
import { View, type ListRenderItem } from "react-native";
import { Segmented } from "@/components/form";
import { loadState } from "@/components/QueryState";
import { ListScreen } from "@/components/Screen";
import { Body, Card, Chip, EmptyState, ErrorState, ListSkeleton, Mono, Small, Strong } from "@/components/ui";
import { useRealtime, useRxDocuments, useRxExtras } from "@/lib/data";
import { usePatient } from "@/lib/session";
import { fmtLongDate } from "@/shared/dates";
import { friendlyError } from "@/shared/errors";
import { prescriberName, REQUEST_LABEL, RX_TONE, rxStatusLabel, type PatientRequest, type RxPayload } from "@/shared/pharmacy";
import { space, useTheme } from "@/theme";

const NO_REQUESTS: PatientRequest[] = [];
const keyOf = (d: RxPayload) => String(d.document_id);

const RxCard = memo(function RxCard({ d, requests }: { d: RxPayload; requests: PatientRequest[] }) {
  const { colors } = useTheme();
  const items = d.items ?? [];
  const mine = requests.filter((r) => r.rx_document_id === d.document_id);
  return (
    <Card style={{ gap: space.sm }} onPress={() => router.push(`/prescriptions/${d.document_id}`)}
      accessibilityLabel={`Prescription from ${prescriberName(d.prescriber)}, ${rxStatusLabel(d)}. ${items.map((i) => i.drug_name).join(", ")}`}>
      <Chip label={rxStatusLabel(d)} tone={RX_TONE[d.status]} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Strong>{items.map((i) => i.drug_name).join(", ") || "Prescription"}</Strong>
          <Small>{[prescriberName(d.prescriber), d.hospital_name, fmtLongDate(d.issued_at)].filter(Boolean).join(" · ")}</Small>
        </View>
        <ChevronRight size={20} color={colors.textMuted} />
      </View>
      <Mono style={{ fontSize: 16 }}>{d.code}</Mono>
      {mine.slice(0, 2).map((r) => <Small key={r.id}>{r.pharmacies?.name ?? "Pharmacy"}: {REQUEST_LABEL[r.status]}</Small>)}
    </Card>
  );
});

export default function Prescriptions() {
  const { patientId } = usePatient();
  const docs = useRxDocuments();
  const extras = useRxExtras();
  const [tab, setTab] = useState<"all" | "current">("all");
  // Live: pharmacy replies and collections.
  useRealtime("rx_pharmacy_requests", patientId ? `patient_id=eq.${patientId}` : null, [["rx-requests"], ["rx-documents"]]);

  const all = docs.data;
  const list = useMemo(() => (tab === "current" ? (all ?? []).filter((d) => d.status === "valid") : all ?? []), [all, tab]);
  const requests = extras.data?.requests ?? NO_REQUESTS;
  const renderItem = useCallback<ListRenderItem<RxPayload>>(({ item }) => <RxCard d={item} requests={requests} />, [requests]);

  const state = loadState(docs);
  const header = (
    <View style={{ gap: space.lg }}>
      <Body muted>Show the code or QR at any HealingNet pharmacy, or send it to one near you. You pay at the counter.</Body>
      <Segmented label="Which prescriptions" value={tab} onChange={setTab} options={[{ value: "all", label: "All" }, { value: "current", label: "Valid now" }]} />
    </View>
  );
  const empty = state === "loading" ? <ListSkeleton />
    : state !== "ready" ? <ErrorState offline={state === "offline"} message={friendlyError(docs.error)} onRetry={() => docs.refetch()} />
    : tab === "current"
      ? <EmptyState icon={Pill} title="No valid prescriptions right now" text="See All for older ones." actionLabel="Show all" onAction={() => setTab("all")} />
      : <EmptyState icon={Pill} title="No prescriptions yet" text="When a doctor prescribes medicine, it appears here." actionLabel="Book a doctor" onAction={() => router.push("/book")} />;

  return (
    <ListScreen title="Prescriptions" back data={list} keyExtractor={keyOf} renderItem={renderItem} header={header} empty={empty}
      updatedAt={docs.dataUpdatedAt || undefined} onRefresh={() => { docs.refetch(); extras.refetch(); }} refreshing={docs.isRefetching} />
  );
}
