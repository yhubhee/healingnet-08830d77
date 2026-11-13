// Medical records (src/pages/patient/MedicalRecords.tsx): a timeline of what was recorded at
// each visit, newest first. Read-only. Saved for offline.
import { ChevronRight, FileText } from "@/components/icons";
import { router } from "expo-router";
import { memo, useCallback } from "react";
import { Pressable, View, type ListRenderItem } from "react-native";
import { loadState } from "@/components/QueryState";
import { ListScreen } from "@/components/Screen";
import { Chip, EmptyState, ErrorState, ListSkeleton, Small, Strong } from "@/components/ui";
import { useRecords } from "@/lib/health";
import { fmtLongDate } from "@/shared/dates";
import { friendlyError } from "@/shared/errors";
import { entryDoctor, entryTypeLabel, type EmrEntry } from "@/shared/records";
import { radius, space, useTheme } from "@/theme";

const keyOf = (e: EmrEntry) => e.id;

const RecordRow = memo(function RecordRow({ e }: { e: EmrEntry }) {
  const { colors } = useTheme();
  const who = [entryDoctor(e), e.hospitals?.name].filter(Boolean).join(" · ");
  return (
    <View style={{ flexDirection: "row", gap: space.md }}>
      {/* The timeline: a dot for each entry on a line that runs down the list. */}
      <View style={{ width: 16, alignItems: "center" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary, marginTop: 22 }} />
        <View style={{ flex: 1, width: 2, backgroundColor: colors.divider, marginTop: 4, marginBottom: -space.lg }} />
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push(`/records/${e.id}`)}
        accessibilityLabel={`${fmtLongDate(e.created_at)}. ${entryTypeLabel(e.entry_type)}. ${e.title}. ${who}`}
        style={({ pressed }) => ({ flex: 1, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: space.lg, opacity: pressed ? 0.85 : 1 })}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <View style={{ flex: 1, gap: 4 }}>
            <Small>{fmtLongDate(e.created_at)}</Small>
            <Strong numberOfLines={2}>{e.title}</Strong>
            <Chip label={entryTypeLabel(e.entry_type)} tone="primary" />
            {who ? <Small>{who}</Small> : null}
          </View>
          <ChevronRight size={20} color={colors.textMuted} />
        </View>
      </Pressable>
    </View>
  );
});

export default function Records() {
  const q = useRecords();
  const renderItem = useCallback<ListRenderItem<EmrEntry>>(({ item }) => <RecordRow e={item} />, []);
  const state = loadState(q);
  const empty = state === "loading" ? <ListSkeleton />
    : state !== "ready" ? <ErrorState offline={state === "offline"} message={friendlyError(q.error)} onRetry={() => q.refetch()} />
    : <EmptyState icon={FileText} title="No medical records yet" text="Notes, vitals and diagnoses from your visits appear here." />;
  return (
    <ListScreen title="Medical records" back data={q.data ?? []} keyExtractor={keyOf} renderItem={renderItem} empty={empty}
      header={q.data?.length ? <Small>Your clinical history in one timeline. Only your hospitals and doctors can add to it.</Small> : null}
      updatedAt={q.dataUpdatedAt || undefined} onRefresh={() => q.refetch()} refreshing={q.isRefetching} />
  );
}
