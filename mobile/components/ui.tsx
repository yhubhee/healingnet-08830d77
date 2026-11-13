// Building blocks of the design system: text, buttons, cards, chips and the loading,
// empty and error states. Text follows the phone's text size; touch targets are at least 48.
import { CircleAlert, WifiOff } from "./icons";
import type { LucideIcon } from "./icons";
import type { ReactNode } from "react";
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View,
  type StyleProp, type TextProps, type TextStyle, type ViewStyle,
} from "react-native";
import { fonts, MIN_TOUCH, radius, space, useTheme } from "@/theme";
import type { Tone } from "@/shared/appointments";

// ---- Text ------------------------------------------------------------------------------
type TProps = TextProps & { muted?: boolean; color?: string; style?: StyleProp<TextStyle> };

/** Screen titles only (Fraunces). */
export function Title({ style, color, ...rest }: TProps) {
  const { colors } = useTheme();
  return <Text accessibilityRole="header" {...rest} style={[{ fontFamily: fonts.title, fontSize: 28, lineHeight: 34, color: color ?? colors.text }, style]} />;
}
export function Heading({ style, color, ...rest }: TProps) {
  const { colors } = useTheme();
  return <Text accessibilityRole="header" {...rest} style={[{ fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, color: color ?? colors.text }, style]} />;
}
export function Body({ style, muted, color, ...rest }: TProps) {
  const { colors } = useTheme();
  return <Text {...rest} style={[{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: color ?? (muted ? colors.textMuted : colors.text) }, style]} />;
}
export function Strong({ style, color, ...rest }: TProps) {
  const { colors } = useTheme();
  return <Text {...rest} style={[{ fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23, color: color ?? colors.text }, style]} />;
}
export function Small({ style, muted = true, color, ...rest }: TProps) {
  const { colors } = useTheme();
  return <Text {...rest} style={[{ fontFamily: fonts.regular, fontSize: 14, lineHeight: 20, color: color ?? (muted ? colors.textMuted : colors.text) }, style]} />;
}
export function Label({ style, color, ...rest }: TProps) {
  const { colors } = useTheme();
  return <Text {...rest} style={[{ fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0.6, textTransform: "uppercase", color: color ?? colors.textMuted }, style]} />;
}
export function Mono({ style, color, ...rest }: TProps) {
  const { colors } = useTheme();
  return <Text {...rest} style={[{ fontFamily: fonts.mono, fontSize: 22, letterSpacing: 2, fontWeight: "700", color: color ?? colors.text }, style]} />;
}

// ---- Buttons ---------------------------------------------------------------------------
type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerGhost" | "onHero";

export function Button({
  label, onPress, variant = "primary", icon: Icon, loading, disabled, disabledReason, small, style, accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** Read out by screen readers when the button is disabled (e.g. offline). */
  disabledReason?: string;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const off = disabled || loading;
  const look: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    secondary: { bg: colors.card, fg: colors.primaryText, border: colors.border },
    ghost: { bg: "transparent", fg: colors.primaryText },
    danger: { bg: colors.danger, fg: colors.background },
    dangerGhost: { bg: "transparent", fg: colors.danger, border: colors.border },
    onHero: { bg: "rgba(255,255,255,0.16)", fg: colors.onHero },
  };
  const v = look[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      accessibilityHint={off && disabledReason ? disabledReason : undefined}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border ?? "transparent", borderWidth: v.border ? 1 : 0, opacity: off ? 0.5 : pressed ? 0.85 : 1 },
        small && { paddingHorizontal: space.md },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : Icon ? <Icon size={20} color={v.fg} /> : null}
      <Text style={{ fontFamily: fonts.semibold, fontSize: small ? 15 : 16, color: v.fg, textAlign: "center", flexShrink: 1 }}>{label}</Text>
    </Pressable>
  );
}

/** An icon-only button. The label is required: it is what a screen reader says. */
export function IconButton({ icon: Icon, label, onPress, color, badge }: {
  icon: LucideIcon; label: string; onPress?: () => void; color?: string; badge?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={4}
      style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon size={24} color={color ?? colors.text} />
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.coral }]}>
          <Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.onCoral }}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function LinkText({ label, onPress, color }: { label: string; onPress: () => void; color?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress} style={styles.linkTouch} hitSlop={6}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 16, color: color ?? colors.primaryText }}>{label}</Text>
    </Pressable>
  );
}

// ---- Surfaces --------------------------------------------------------------------------
export function Card({ children, style, onPress, accessibilityLabel }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const base = [styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress}
      style={({ pressed }) => [...base, { opacity: pressed ? 0.85 : 1 }]}>
      {children}
    </Pressable>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.divider }} />;
}

/** A fully rounded status chip. The words carry the meaning; colour only supports them. */
export function Chip({ label, tone = "neutral", onHero }: { label: string; tone?: Tone | "primary" | "coral"; onHero?: boolean }) {
  const { colors } = useTheme();
  const look = {
    success: { bg: colors.successBg, fg: colors.successText },
    warning: { bg: colors.warningBg, fg: colors.warningText },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    neutral: { bg: colors.surface, fg: colors.textMuted },
    primary: { bg: colors.primarySoft, fg: colors.primaryText },
    coral: { bg: colors.coral, fg: colors.onCoral },
  }[tone];
  const bg = onHero ? "rgba(255,255,255,0.18)" : look.bg;
  const fg = onHero ? colors.onHero : look.fg;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: fg }}>{label}</Text>
    </View>
  );
}

// ---- States ----------------------------------------------------------------------------
export function Skeleton({ height = 88, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height, borderRadius: radius.card, backgroundColor: colors.skeleton }, style]} />;
}

export function ListSkeleton({ rows = 3, height = 96 }: { rows?: number; height?: number }) {
  return (
    <View accessibilityLabel="Loading" accessibilityState={{ busy: true }} style={{ gap: space.md }}>
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={height} />)}
    </View>
  );
}

export function EmptyState({ icon: Icon, title, text, actionLabel, onAction }: {
  icon: LucideIcon; title: string; text?: string; actionLabel?: string; onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.state, { borderColor: colors.border }]}>
      <Icon size={36} color={colors.textMuted} />
      <Strong style={{ textAlign: "center", marginTop: space.md }}>{title}</Strong>
      {text ? <Small style={{ textAlign: "center", marginTop: 4 }}>{text}</Small> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} style={{ marginTop: space.lg }} /> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry, offline }: { message: string; onRetry?: () => void; offline?: boolean }) {
  const { colors } = useTheme();
  const Icon = offline ? WifiOff : CircleAlert;
  return (
    <View accessibilityRole="alert" style={[styles.state, { borderColor: colors.border }]}>
      <Icon size={36} color={colors.textMuted} />
      <Strong style={{ textAlign: "center", marginTop: space.md }}>{offline ? "You're offline" : "We couldn't load this"}</Strong>
      <Small style={{ textAlign: "center", marginTop: 4 }}>{offline ? "Connect to the internet and try again." : message}</Small>
      {onRetry ? <Button label="Try again" variant="secondary" onPress={onRetry} style={{ marginTop: space.lg }} /> : null}
    </View>
  );
}

/** An inline note, e.g. why a button is disabled. */
export function Notice({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "warning" | "danger" | "success" }) {
  const { colors } = useTheme();
  const look = {
    neutral: { bg: colors.surface, fg: colors.textMuted },
    warning: { bg: colors.warningBg, fg: colors.warningText },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    success: { bg: colors.successBg, fg: colors.successText },
  }[tone];
  return (
    <View style={{ backgroundColor: look.bg, borderRadius: radius.input, padding: space.md }}>
      <Text style={{ fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: look.fg }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH + 4, borderRadius: radius.button, paddingHorizontal: space.xl, paddingVertical: space.md,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm,
  },
  iconButton: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: 4, right: 2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: "center", justifyContent: "center" },
  linkTouch: { minHeight: MIN_TOUCH, justifyContent: "center" },
  card: { borderRadius: radius.card, borderWidth: 1, padding: space.lg },
  chip: { alignSelf: "flex-start", borderRadius: radius.chip, paddingHorizontal: 12, paddingVertical: 5, maxWidth: "100%" },
  state: { alignItems: "center", borderWidth: 1, borderStyle: "dashed", borderRadius: radius.card, padding: space.xxl },
});
