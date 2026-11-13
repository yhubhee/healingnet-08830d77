// Lab results (src/pages/patient/LabResults.tsx): each order with its tests, hospital and
// date, and "New" until the patient has opened it (on any device). Saved for offline.
import { ChevronRight, FlaskConical } from "@/components/icons";
import { router } from "expo-router";
import { memo, useCallback } from "react";
import { View, type ListRenderItem } from "react-native";
import { loadState } from "@/components/QueryState";
import { ListScreen } from "@/components/Screen";
import { Card, Chip, EmptyState, ErrorState, ListSkeleton, Small, Strong } from "@/components/ui";
import { useLabResults } from "@/lib/health";
import { fmtLongDate } from "@/shared/dates";
import { friendlyError } from "@/shared/errors";
import { labIsNew, labIsReady, labStatusText, labTitle, type LabResult } from "@/shared/labs";
import { space, useTheme } from "@/theme";

const keyOf = (r: LabResult) => r.id;

const LabCard = memo(function LabCard({ r }: { r: LabResult }) {
  const { colors } = useTheme();
  const isNew = labIsNew(r);
  const status = labStatusText(r);
  return (
    <Card onPress={() => router.push(`/lab-results/${r.id}`)}
      accessibilityLabel={`${isNew ? "New. " : ""}${labTitle(r)}. ${r.hospitals?.name ?? ""}. ${fmtLongDate(r.created_at)}. ${status}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
            {isNew ? <Chip label="New" tone="coral" /> : null}
            <Chip label={status} tone={!labIsReady(r) ? "warning" : status === "Ready" ? "success" : "danger"} />
          </View>
          <Strong numberOfLines={3}>{labTitle(r)}</Strong>
          <Small>{[r.hospitals?.name, fmtLongDate(r.created_at)].filter(Boolean).join(" · ")}</Small>
        </View>
        <ChevronRight size={20} color={colors.textMuted} />
      </View>
    </Card>
  );
});

export default function LabResults() {
  const q = useLabResults();
  const renderItem = useCallback<ListRenderItem<LabResult>>(({ item }) => <LabCard r={item} />, []);

  const state = loadState(q);
  const empty = state === "loading" ? <ListSkeleton />
    : state !== "ready" ? <ErrorState offline={state === "offline"} message={friendlyError(q.error)} onRetry={() => q.refetch()} />
    : <EmptyState icon={FlaskConical} title="No lab results yet" text="Tests requested by your doctors appear here when the lab has finished them." />;

  return (
    <ListScreen title="Lab results" back data={q.data ?? []} keyExtractor={keyOf} renderItem={renderItem} empty={empty}
      header={q.data?.length ? <Small>All tests requested by your doctors. Tap one to see every value.</Small> : null}
      updatedAt={q.dataUpdatedAt || undefined} onRefresh={() => q.refetch()} refreshing={q.isRefetching} />
  );
}
