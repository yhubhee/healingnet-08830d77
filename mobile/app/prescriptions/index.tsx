// Prescriptions (src/pages/patient/Prescriptions.tsx): grouped by document, with status.
import { router } from "expo-router";
import { ChevronRight, Pill } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Segmented } from "@/components/form";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { Body, Card, Chip, EmptyState, Mono, Small, Strong } from "@/components/ui";
import { useRealtime, useRxDocuments, useRxExtras } from "@/lib/data";
import { usePatient } from "@/lib/session";
import { fmtLongDate } from "@/shared/dates";
import { prescriberName, REQUEST_LABEL, RX_TONE, rxStatusLabel } from "@/shared/pharmacy";
import { space, useTheme } from "@/theme";

export default function Prescriptions() {
  const { colors } = useTheme();
  const { patientId } = usePatient();
  const docs = useRxDocuments();
  const extras = useRxExtras();
  const [tab, setTab] = useState<"all" | "current">("all");
  // Live: pharmacy replies and collections.
  useRealtime("rx_pharmacy_requests", patientId ? `patient_id=eq.${patientId}` : null, [["rx-requests"], ["rx-documents"]]);

  const all = docs.data ?? [];
  const list = tab === "current" ? all.filter((d) => d.status === "valid") : all;

  return (
    <Screen title="Prescriptions" back updatedAt={docs.dataUpdatedAt || undefined}
      onRefresh={() => { docs.refetch(); extras.refetch(); }} refreshing={docs.isRefetching}>
      <Body muted>Show the code or QR at any HealingNet pharmacy, or send it to one near you. You pay at the counter.</Body>
      <Segmented label="Which prescriptions" value={tab} onChange={setTab} options={[{ value: "all", label: "All" }, { value: "current", label: "Valid now" }]} />
      <QueryState query={docs}>
        {list.length === 0 ? (
          tab === "current"
            ? <EmptyState icon={Pill} title="No valid prescriptions right now" text="See All for older ones." actionLabel="Show all" onAction={() => setTab("all")} />
            : <EmptyState icon={Pill} title="No prescriptions yet" text="When a doctor prescribes medicine, it appears here." actionLabel="Book a doctor" onAction={() => router.push("/book")} />
        ) : list.map((d) => {
          const items = d.items ?? [];
          const requests = (extras.data?.requests ?? []).filter((r) => r.rx_document_id === d.document_id);
          return (
            <Card key={d.document_id} style={{ gap: space.sm }} onPress={() => router.push(`/prescriptions/${d.document_id}`)}
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
              {requests.slice(0, 2).map((r) => <Small key={r.id}>{r.pharmacies?.name ?? "Pharmacy"}: {REQUEST_LABEL[r.status]}</Small>)}
            </Card>
          );
        })}
      </QueryState>
    </Screen>
  );
}
