// A family member's verification status: always an icon and words together, never colour
// alone. Used in the switcher sheet, the Family list and the member's profile.
import { Text, View } from "react-native";
import { verifyState, type Verifiable, type VerifyKind } from "@/shared/verification";
import { fonts, useTheme } from "@/theme";
import { BadgeCheck, CircleAlert, Clock, Hourglass, Lock, type LucideIcon } from "./icons";

const ICON: Record<VerifyKind, LucideIcon> = { verified: BadgeCheck, pending: Hourglass, due: Clock, locked: Lock, rejected: CircleAlert };

export function VerifyBadge({ member, lines = 2 }: { member: Verifiable; lines?: number }) {
  const { colors } = useTheme();
  const state = verifyState(member);
  const color = { success: colors.successText, neutral: colors.textMuted, warning: colors.warningText, danger: colors.danger }[state.tone];
  const Icon = ICON[state.kind];
  return (
    <View accessible accessibilityLabel={`Verification: ${state.label}`} style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
      <Icon size={16} color={color} style={{ marginTop: 2 }} />
      <Text numberOfLines={lines} style={{ flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color }}>{state.label}</Text>
    </View>
  );
}
