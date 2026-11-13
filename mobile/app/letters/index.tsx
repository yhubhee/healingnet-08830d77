// Letters (src/pages/patient/Letters.tsx): official documents issued by the patient's doctor,
// and "Request a letter". A request shows in the list as waiting until the doctor issues it.
import { Award, ChevronRight, Plus } from "@/components/icons";
import { router } from "expo-router";
import { memo, useCallback, useState } from "react";
import { View, type ListRenderItem } from "react-native";
import { loadState } from "@/components/QueryState";
import { ListScreen } from "@/components/Screen";
import { RequestLetterSheet } from "@/components/RequestLetterSheet";
import { Card, Chip, EmptyState, ErrorState, IconButton, ListSkeleton, Small, Strong } from "@/components/ui";
import { useLetters } from "@/lib/health";
import { usePatient } from "@/lib/session";
import { fmtLongDate } from "@/shared/dates";
import { friendlyError } from "@/shared/errors";
import { LETTER_STATUS_TEXT, letterDoctor, letterLabel, letterStatus, type Letter } from "@/shared/records";
import { space, useTheme } from "@/theme";

const keyOf = (l: Letter) => l.id;
const LETTER_TONE = { issued: "success", pending: "warning", expired: "neutral" } as const;

const LetterCard = memo(function LetterCard({ l }: { l: Letter }) {
  const { colors } = useTheme();
  const status = letterStatus(l);
  return (
    <Card onPress={() => router.push(`/letters/${l.id}`)}
      accessibilityLabel={`${letterLabel(l)}. ${LETTER_STATUS_TEXT[status]}. Issued ${fmtLongDate(l.issued_at)}${letterDoctor(l) ? ` by ${letterDoctor(l)}` : ""}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Chip label={LETTER_STATUS_TEXT[status]} tone={LETTER_TONE[status]} />
          <Strong numberOfLines={2}>{letterLabel(l)}</Strong>
          <Small>{status === "pending" ? "Requested" : "Issued"} {fmtLongDate(l.issued_at)}{l.valid_until ? ` · Valid until ${fmtLongDate(l.valid_until)}` : ""}</Small>
          <Small>{status === "pending" ? `Asked of ${letterDoctor(l) ?? "any available doctor"}` : `By ${letterDoctor(l) ?? "—"}`}</Small>
        </View>
        <ChevronRight size={20} color={colors.textMuted} />
      </View>
    </Card>
  );
});

export default function Letters() {
  const q = useLetters();
  const { patientId } = usePatient();
  const [requesting, setRequesting] = useState(false);
  const renderItem = useCallback<ListRenderItem<Letter>>(({ item }) => <LetterCard l={item} />, []);
  const state = loadState(q);
  const empty = state === "loading" ? <ListSkeleton />
    : state !== "ready" ? <ErrorState offline={state === "offline"} message={friendlyError(q.error)} onRetry={() => q.refetch()} />
    : <EmptyState icon={Award} title="No letters or reports yet" text="When your doctor issues one, it will appear here. You can also ask for one." actionLabel="Request a letter" onAction={() => setRequesting(true)} />;
  return (
    <ListScreen title="Letters" back data={q.data ?? []} keyExtractor={keyOf} renderItem={renderItem} empty={empty}
      header={q.data?.length ? <Small>Official medical documents issued to you by your doctor. Tap + to request one; a request shows here until your doctor issues it.</Small> : null}
      right={<IconButton icon={Plus} label="Request a letter" onPress={() => setRequesting(true)} />}
      footer={<RequestLetterSheet visible={requesting} patientId={patientId} onClose={() => setRequesting(false)} />}
      onRefresh={() => q.refetch()} refreshing={q.isRefetching} />
  );
}
