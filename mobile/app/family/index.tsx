// Me → Family: the people whose health care this account manages.
import { router } from "expo-router";
import { View } from "react-native";
import { ChevronRight, Plus, Users } from "@/components/icons";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { Body, Button, Card, Chip, EmptyState, ListSkeleton, Small, Strong } from "@/components/ui";
import { useActivePerson, useFamily } from "@/lib/family";
import { ageText, MAX_FAMILY, relationshipLabel } from "@/shared/family";
import { space, useTheme } from "@/theme";

export default function Family() {
  const { colors } = useTheme();
  const q = useFamily();
  const person = useActivePerson();
  const list = q.data ?? [];
  const full = list.length >= MAX_FAMILY;

  return (
    <Screen title="Family" back onRefresh={() => q.refetch()} refreshing={q.isRefetching} updatedAt={q.dataUpdatedAt || undefined}
      footer={<Button label="Add family member" icon={Plus} onPress={() => router.push("/family/add")} disabled={full} disabledReason={`You can add up to ${MAX_FAMILY} family members`} />}>
      <Body muted>Book visits and keep health records for your children and other family members, from your own account.</Body>
      <QueryState query={q} skeleton={<ListSkeleton rows={2} height={84} />}>
        {list.length === 0 ? (
          <EmptyState icon={Users} title="No family members yet" text="Add a child, parent or other family member to manage their health care here." />
        ) : list.map((m) => {
          const showing = !person.isMe && person.patientId === m.patient_id;
          const sub = [ageText(m.age), relationshipLabel(m.relationship)].filter(Boolean).join(" · ");
          return (
            <Card key={m.patient_id} onPress={() => router.push({ pathname: "/family/[id]", params: { id: m.patient_id } })}
              accessibilityLabel={`${m.first_name} ${m.last_name}, ${sub}${showing ? ". Showing now" : ""}. Open`}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Strong>{m.first_name} {m.last_name}</Strong>
                  <Small>{sub}</Small>
                  {showing ? <Chip label="Showing now" tone="primary" /> : null}
                </View>
                <ChevronRight size={20} color={colors.textMuted} />
              </View>
            </Card>
          );
        })}
      </QueryState>
    </Screen>
  );
}
