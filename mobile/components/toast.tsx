// Short confirmations and errors at the top of the screen, announced to screen readers.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, radius, space, useTheme } from "@/theme";

type ToastTone = "success" | "error" | "info";
interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}
const ToastContext = createContext<ToastApi>({ success: () => {}, error: () => {}, info: () => {} });
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, tone: ToastTone) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ message, tone });
    AccessibilityInfo.announceForAccessibility(message);
    timer.current = setTimeout(() => setToast(null), tone === "error" ? 6000 : 4000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const api = useRef<ToastApi>({
    success: (m) => show(m, "success"),
    error: (m) => show(m, "error"),
    info: (m) => show(m, "info"),
  }).current;

  const look = toast && {
    success: { bg: colors.successBg, fg: colors.successText },
    error: { bg: colors.dangerSoft, fg: colors.danger },
    info: { bg: colors.surface, fg: colors.text },
  }[toast.tone];

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && look ? (
        <Pressable accessibilityRole="alert" accessibilityLabel={toast.message} accessibilityHint="Double tap to dismiss"
          onPress={() => setToast(null)}
          style={[styles.toast, { top: insets.top + space.sm, backgroundColor: look.bg, borderColor: colors.border }]}>
          <Text style={{ fontFamily: fonts.semibold, fontSize: 15, lineHeight: 21, color: look.fg }}>{toast.message}</Text>
        </Pressable>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute", left: space.lg, right: space.lg, borderRadius: radius.button, borderWidth: 1,
    paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 48, justifyContent: "center",
    elevation: 6, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
});
