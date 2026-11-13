// "Who is this for?": the chip at the top of the patient screens ("For: Me ▾" or
// "For: Tobi ▾") and the sheet it opens, with Me, each family member, and Add family member.
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { activePerson } from "@/lib/activePerson";
import { useActivePerson } from "@/lib/family";
import { ageText, MAX_FAMILY, relationshipLabel } from "@/shared/family";
import { fonts, MIN_TOUCH, radius, space, useTheme } from "@/theme";
import { Sheet } from "./form";
import { Check, ChevronDown, Plus } from "./icons";
import { Divider, Small, Strong } from "./ui";

function Row({ title, sub, selected, onPress }: { title: string; sub?: string; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} accessibilityLabel={sub ? `${title}, ${sub}` : title} onPress={onPress}
      style={({ pressed }) => ({ minHeight: MIN_TOUCH + 12, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ flex: 1 }}>
        <Strong>{title}</Strong>
        {sub ? <Small>{sub}</Small> : null}
      </View>
      {selected ? <Check size={22} color={colors.primaryText} /> : null}
    </Pressable>
  );
}

/** The list of people. Choosing one closes the sheet; the screens behind follow at once. */
export function PersonSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const person = useActivePerson();
  const choose = (id: string | null) => { activePerson.set(id); onClose(); };
  return (
    <Sheet visible={visible} onClose={onClose} title="Who is this for?">
      <ScrollView accessibilityRole="radiogroup">
        <Row title="Me" selected={person.isMe} onPress={() => choose(null)} />
        {person.family.map((m) => (
          <View key={m.patient_id}>
            <Divider />
            <Row title={m.first_name} sub={[ageText(m.age), relationshipLabel(m.relationship)].filter(Boolean).join(" · ")}
              selected={!person.isMe && person.patientId === m.patient_id} onPress={() => choose(m.patient_id)} />
          </View>
        ))}
        <Divider />
        {person.family.length < MAX_FAMILY ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Add family member" onPress={() => { onClose(); router.push("/family/add"); }}
            style={({ pressed }) => ({ minHeight: MIN_TOUCH + 12, flexDirection: "row", alignItems: "center", gap: space.sm, opacity: pressed ? 0.6 : 1 })}>
            <Plus size={20} color={colors.primaryText} />
            <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: colors.primaryText }}>Add family member</Text>
          </Pressable>
        ) : <Small style={{ paddingVertical: space.md }}>You can add up to {MAX_FAMILY} family members.</Small>}
      </ScrollView>
    </Sheet>
  );
}

/**
 * The chip. `locked` shows who the screen is about without offering a change (a single
 * record, or a form that is half filled in).
 */
export function PersonChip({ locked }: { locked?: boolean }) {
  const { colors } = useTheme();
  const person = useActivePerson();
  const [open, setOpen] = useState(false);
  const text = `For: ${person.label}`;
  const look = {
    alignSelf: "flex-start" as const, minHeight: locked ? 32 : MIN_TOUCH, flexDirection: "row" as const, alignItems: "center" as const, gap: 6,
    paddingHorizontal: space.md, borderRadius: radius.button, borderWidth: 1,
    borderColor: person.isMe ? colors.border : colors.primaryText, backgroundColor: person.isMe ? colors.card : colors.primarySoft,
  };
  const label = <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: person.isMe ? colors.text : colors.primaryText }} numberOfLines={1}>{text}</Text>;
  if (locked) {
    // Nothing to say on a single record that is the patient's own.
    return person.isMe ? null : <View style={look} accessible accessibilityLabel={text}>{label}</View>;
  }
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${text}. Change who this is for`} onPress={() => setOpen(true)}
        style={({ pressed }) => [look, { opacity: pressed ? 0.7 : 1 }]}>
        {label}
        <ChevronDown size={18} color={person.isMe ? colors.textMuted : colors.primaryText} />
      </Pressable>
      <PersonSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
