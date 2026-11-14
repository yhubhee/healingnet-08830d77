// Page frame: safe areas, an optional header with a back button, the offline bar,
// scrolling and pull to refresh. ListScreen is the same frame around a FlatList, for
// lists that can grow long: only the rows on screen are mounted.
import { ArrowLeft, WifiOff } from "./icons";
import { router } from "expo-router";
import type { ReactElement, ReactNode } from "react";
import { FlatList, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View, type ListRenderItem } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnline } from "@/lib/net";
import { fmtClock } from "@/shared/dates";
import { fonts, space, useTheme } from "@/theme";
import { PersonChip } from "./PersonSwitcher";
import { IconButton, Title } from "./ui";

/** "switch": the "For: Me ▾" chip. "show": only says who a single record is about. */
export type PersonMode = "switch" | "show";

function PersonBar({ mode }: { mode?: PersonMode }) {
  if (!mode) return null;
  const chip = <PersonChip locked={mode === "show"} />;
  return <View style={styles.person}>{chip}</View>;
}

/** "Offline · last updated 10:42", shown above saved data while the phone is offline. */
export function OfflineBar({ updatedAt }: { updatedAt?: number }) {
  const { colors } = useTheme();
  const online = useOnline();
  if (online) return null;
  const text = updatedAt ? `Offline · last updated ${fmtClock(updatedAt)}` : "Offline";
  return (
    <View accessibilityRole="alert" style={[styles.offline, { backgroundColor: colors.warningBg }]}>
      <WifiOff size={16} color={colors.warningText} />
      <Text style={{ fontFamily: fonts.semibold, fontSize: 14, color: colors.warningText }}>{text}</Text>
    </View>
  );
}

export function Screen({
  title, back, onBack, right, children, onRefresh, refreshing, updatedAt, scroll = true, footer, tab, person,
}: {
  /** Patient screens: who the screen is for. Left out on account screens (Messages, Me, sign-in). */
  person?: PersonMode;
  title?: string;
  /** Show a back button in the header. */
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** When the data on this screen was last fetched, for the offline bar. */
  updatedAt?: number;
  scroll?: boolean;
  /** Pinned below the content (e.g. the main button of a form). */
  footer?: ReactNode;
  /** Tab screens sit above the tab bar, which handles the bottom safe area itself. */
  tab?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace("/(tabs)")));

  const header = (title || back || right) ? (
    <View style={styles.header}>
      {back ? <IconButton icon={ArrowLeft} label="Back" onPress={goBack} /> : null}
      <View style={{ flex: 1, paddingLeft: back ? 0 : space.xs }}>
        {title ? <Title numberOfLines={2}>{title}</Title> : null}
      </View>
      {right}
    </View>
  ) : null;

  const padBottom = (tab ? 0 : insets.bottom) + space.xl;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <OfflineBar updatedAt={updatedAt} />
      {header}
      <PersonBar mode={person} />
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: footer ? space.lg : padBottom, gap: space.lg }}
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primaryText} colors={[colors.primary]} /> : undefined}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingHorizontal: space.lg, paddingTop: space.sm }}>{children}</View>
      )}
      {footer ? (
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: padBottom, gap: space.sm, borderTopWidth: 1, borderTopColor: colors.divider, backgroundColor: colors.background }}>
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** The page frame around a virtualised list. `header` scrolls with the rows; `empty` shows when there are none. */
export function ListScreen<T>({
  title, back, right, tab, updatedAt, onRefresh, refreshing, data, renderItem, keyExtractor, header, empty, footer, extraData, person, listFooter,
}: {
  /** After the last row, inside the scroll (e.g. "Show older visits"). */
  listFooter?: ReactElement | null;
  person?: PersonMode;
  title?: string;
  back?: boolean;
  right?: ReactNode;
  tab?: boolean;
  updatedAt?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
  data: readonly T[];
  renderItem: ListRenderItem<T>;
  keyExtractor: (item: T) => string;
  header?: ReactElement | null;
  empty?: ReactElement | null;
  /** Below the list, outside the scroll (sheets and dialogs). */
  footer?: ReactNode;
  /** Anything outside `data` that the rows draw from; a change redraws them. */
  extraData?: unknown;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <OfflineBar updatedAt={updatedAt} />
      {(title || back || right) ? (
        <View style={styles.header}>
          {back ? <IconButton icon={ArrowLeft} label="Back" onPress={goBack} /> : null}
          <View style={{ flex: 1, paddingLeft: back ? 0 : space.xs }}>
            {title ? <Title numberOfLines={2}>{title}</Title> : null}
          </View>
          {right}
        </View>
      ) : null}
      <PersonBar mode={person} />
      <FlatList
        data={data}
        extraData={extraData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={header ?? undefined}
        ListHeaderComponentStyle={header ? { marginBottom: space.lg } : undefined}
        ListEmptyComponent={empty ?? undefined}
        ListFooterComponent={listFooter ?? undefined}
        ListFooterComponentStyle={listFooter ? { marginTop: space.lg } : undefined}
        ItemSeparatorComponent={ListGap}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews={Platform.OS === "android"}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: (tab ? 0 : insets.bottom) + space.xl }}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primaryText} colors={[colors.primary]} /> : undefined}
      />
      {footer}
    </View>
  );
}

function ListGap() {
  return <View style={{ height: space.lg }} />;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", minHeight: 56, paddingHorizontal: space.md, gap: space.xs },
  person: { paddingHorizontal: space.lg, paddingBottom: space.xs },
  offline: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, paddingVertical: space.sm, paddingHorizontal: space.lg },
});
