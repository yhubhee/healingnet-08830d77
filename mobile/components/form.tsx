// Form controls: text field, picker, date field, switch row, segmented tabs and sheets.
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Check, ChevronDown, ChevronRight, X } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import {
  FlatList, Modal, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View, type TextInputProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fmtLongDate } from "@/shared/dates";
import { fonts, MIN_TOUCH, radius, space, useTheme } from "@/theme";
import { Body, Button, Heading, IconButton, Small, Strong } from "./ui";

function FieldFrame({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: colors.text }}>{label}</Text>
      {children}
      {error ? <Small color={colors.danger} accessibilityRole="alert">{error}</Small> : hint ? <Small>{hint}</Small> : null}
    </View>
  );
}

export function Field({ label, error, hint, style, ...input }: TextInputProps & { label: string; error?: string; hint?: string }) {
  const { colors } = useTheme();
  return (
    <FieldFrame label={label} error={error} hint={hint}>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        placeholderTextColor={colors.textMuted}
        {...input}
        style={[
          styles.input,
          { backgroundColor: colors.card, borderColor: error ? colors.danger : colors.border, color: colors.text },
          input.multiline && { minHeight: 96, textAlignVertical: "top", paddingTop: space.md },
          style,
        ]}
      />
    </FieldFrame>
  );
}

/** A bottom sheet. */
export function Sheet({ visible, onClose, title, children, footer }: {
  visible: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + space.lg }]} accessibilityViewIsModal>
          <View style={styles.sheetHeader}>
            <Heading style={{ flex: 1 }}>{title}</Heading>
            <IconButton icon={X} label="Close" onPress={onClose} />
          </View>
          <View style={{ flexShrink: 1 }}>{children}</View>
          {footer ? <View style={{ paddingTop: space.md, gap: space.sm }}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export interface Option { value: string; label: string }

export function SelectField({ label, value, options, onChange, placeholder = "Choose…", error, hint }: {
  label: string; value: string; options: Option[]; onChange: (v: string) => void; placeholder?: string; error?: string; hint?: string;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  return (
    <FieldFrame label={label} error={error} hint={hint}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${current?.label ?? value ?? placeholder}`} accessibilityHint="Opens a list to choose from"
        onPress={() => setOpen(true)}
        style={[styles.input, styles.select, { backgroundColor: colors.card, borderColor: error ? colors.danger : colors.border }]}>
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: current || value ? colors.text : colors.textMuted }}>{current?.label ?? (value || placeholder)}</Text>
        <ChevronDown size={20} color={colors.textMuted} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <FlatList
          data={options}
          keyExtractor={(o) => o.value || "__none"}
          style={{ maxHeight: 420 }}
          renderItem={({ item }) => {
            const selected = item.value === value;
            return (
              <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => { onChange(item.value); setOpen(false); }}
                style={[styles.option, { borderBottomColor: colors.divider }]}>
                <Body style={{ flex: 1 }}>{item.label}</Body>
                {selected ? <Check size={20} color={colors.primaryText} /> : null}
              </Pressable>
            );
          }}
        />
      </Sheet>
    </FieldFrame>
  );
}

const toDate = (iso: string) => new Date(`${iso}T12:00:00`);
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** A "YYYY-MM-DD" date chosen with the phone's own date picker. */
export function DateField({ label, value, onChange, min, max, error, placeholder = "Choose a date" }: {
  label: string; value: string; onChange: (iso: string) => void; min?: string; max?: string; error?: string; placeholder?: string;
}) {
  const { colors, scheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date | null>(null);
  const initial = toDate(value || max || toIso(new Date()));
  const limits = { minimumDate: min ? toDate(min) : undefined, maximumDate: max ? toDate(max) : undefined };

  const openPicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({ value: initial, mode: "date", ...limits, onChange: (e, d) => { if (e.type === "set" && d) onChange(toIso(d)); } });
    } else {
      setDraft(initial);
      setOpen(true);
    }
  };

  return (
    <FieldFrame label={label} error={error}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ? fmtLongDate(value) : placeholder}`} accessibilityHint="Opens a date picker"
        onPress={openPicker}
        style={[styles.input, styles.select, { backgroundColor: colors.card, borderColor: error ? colors.danger : colors.border }]}>
        <Text style={{ flex: 1, fontFamily: fonts.regular, fontSize: 16, color: value ? colors.text : colors.textMuted }}>{value ? fmtLongDate(value) : placeholder}</Text>
        <ChevronDown size={20} color={colors.textMuted} />
      </Pressable>
      {Platform.OS === "ios" ? (
        <Sheet visible={open} onClose={() => setOpen(false)} title={label}
          footer={<Button label="Done" onPress={() => { if (draft) onChange(toIso(draft)); setOpen(false); }} />}>
          <DateTimePicker value={draft ?? initial} mode="date" display="spinner" themeVariant={scheme} {...limits}
            onChange={(_e, d) => { if (d) setDraft(d); }} />
        </Sheet>
      ) : null}
    </FieldFrame>
  );
}

export function ToggleRow({ label, hint, value, onChange, disabled, icon: Icon }: {
  label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean; icon?: LucideIcon;
}) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled} onPress={() => onChange(!value)} style={[styles.row, { opacity: disabled ? 0.5 : 1 }]}>
      {Icon ? <Icon size={22} color={colors.textMuted} /> : null}
      <View style={{ flex: 1 }}>
        <Strong>{label}</Strong>
        {hint ? <Small>{hint}</Small> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }} thumbColor="#FFFFFF"
        importantForAccessibility="no-hide-descendants" accessibilityElementsHidden />
    </Pressable>
  );
}

/** A settings row that opens something. */
export function NavRow({ label, hint, icon: Icon, onPress, danger, value }: {
  label: string; hint?: string; icon?: LucideIcon; onPress: () => void; danger?: boolean; value?: string;
}) {
  const { colors } = useTheme();
  const fg = danger ? colors.danger : colors.text;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={value ? `${label}: ${value}` : label} accessibilityHint={hint} onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      {Icon ? <Icon size={22} color={danger ? colors.danger : colors.textMuted} /> : null}
      <View style={{ flex: 1 }}>
        <Strong color={fg}>{label}</Strong>
        {hint ? <Small>{hint}</Small> : null}
      </View>
      {value ? <Small>{value}</Small> : null}
      <ChevronRight size={20} color={colors.textMuted} />
    </Pressable>
  );
}

/** Two or three choices side by side (tabs, or System / Light / Dark). */
export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: colors.surface }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected }} onPress={() => onChange(o.value)}
            style={[styles.segment, selected && { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
            <Text style={{ fontFamily: selected ? fonts.bold : fonts.medium, fontSize: 15, color: selected ? colors.primaryText : colors.textMuted }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: MIN_TOUCH + 4, borderWidth: 1, borderRadius: radius.input, paddingHorizontal: space.lg, paddingVertical: space.sm,
    fontFamily: fonts.regular, fontSize: 16,
  },
  select: { flexDirection: "row", alignItems: "center", gap: space.sm },
  option: { minHeight: MIN_TOUCH + 4, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingVertical: space.sm, gap: space.sm },
  backdrop: { flex: 1, justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: space.lg, paddingTop: space.sm, maxHeight: "88%" },
  sheetHeader: { flexDirection: "row", alignItems: "center", minHeight: 56 },
  row: { minHeight: MIN_TOUCH + 8, flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  segmented: { flexDirection: "row", borderRadius: radius.button, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: MIN_TOUCH, borderRadius: radius.button - 3, alignItems: "center", justifyContent: "center", paddingHorizontal: space.sm },
});
