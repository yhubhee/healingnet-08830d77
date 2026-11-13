// One medical record entry, read-only: what was written, or the vitals that were taken.
import { FileText } from "@/components/icons";
import { useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { Body, Card, Chip, EmptyState, Heading, Label, Small, Strong } from "@/components/ui";
import { useRecords } from "@/lib/health";
import { fmtDateTime } from "@/shared/dates";
import { entryDoctor, entryTypeLabel, vitalsList } from "@/shared/records";
import { space } from "@/theme";

export default function RecordDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useRecords();
  const e = (q.data ?? []).find((x) => x.id === id);
  const vitals = e ? vitalsList(e.vital_data) : [];

  return (
    <Screen title="Record" back person="show" updatedAt={q.dataUpdatedAt || undefined} onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <QueryState query={q}>
        {!e ? (
          <EmptyState icon={FileText} title="Record not found" text="It may have been removed. Pull down to refresh." />
        ) : (
          <>
            <View style={{ gap: space.sm }}>
              <Chip label={entryTypeLabel(e.entry_type)} tone="primary" />
              <Heading>{e.title}</Heading>
            </View>
            <Card style={{ gap: space.md }}>
              <View><Small>Date</Small><Strong>{fmtDateTime(e.created_at)}</Strong></View>
              <View><Small>Doctor</Small><Strong>{entryDoctor(e) ?? "Not recorded"}</Strong></View>
              <View><Small>Hospital</Small><Strong>{e.hospitals?.name ?? "Not recorded"}</Strong></View>
            </Card>
            {vitals.length > 0 ? (
              <Card style={{ gap: space.md }}>
                <Label>Vitals</Label>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.md }}>
                  {vitals.map((v) => (
                    <View key={v.label} style={{ minWidth: "45%", flex: 1 }}><Small>{v.label}</Small><Strong>{v.value}</Strong></View>
                  ))}
                </View>
              </Card>
            ) : null}
            {e.content ? <Card style={{ gap: 4 }}><Label>Notes</Label><Body selectable>{e.content}</Body></Card> : null}
            {!e.content && vitals.length === 0 ? <Card><Body muted>Nothing more was written for this entry.</Body></Card> : null}
            <Small>Records are written by your hospital. If something looks wrong, ask the hospital to correct it.</Small>
          </>
        )}
      </QueryState>
    </Screen>
  );
}
