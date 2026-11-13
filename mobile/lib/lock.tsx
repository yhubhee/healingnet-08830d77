// Privacy cover and optional app lock.
// - Privacy cover: when the app leaves the foreground the screen is covered with the
//   HealingNet logo, so health details don't show in the app switcher. Android takes its
//   app-switcher picture before the app can redraw, so there the window is also marked
//   secure (which blanks the preview and blocks screenshots). The one exception is the
//   prescription screen, where screenshots are allowed (useAllowScreenshots).
// - App lock (off by default): asks for fingerprint, face or the phone's passcode after
//   5 minutes in the background, and when the app is opened fresh.
import * as LocalAuthentication from "expo-local-authentication";
import { useFocusEffect } from "expo-router";
import * as ScreenCapture from "expo-screen-capture";
import { Lock } from "lucide-react-native";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppState, Image, Platform, StyleSheet, View } from "react-native";
import { Button, Body, Title } from "@/components/ui";
import { useTheme } from "@/theme";
import { DEVICE_KEYS, setFlag } from "./storage";

/** Set to false to allow screenshots on Android (the app-switcher preview would then show the last screen). */
const ANDROID_SECURE_WINDOW = true;
const SECURE_KEY = "privacy";
export const LOCK_AFTER_MS = 5 * 60 * 1000;

const secureWindow = (on: boolean) => {
  if (Platform.OS !== "android" || !ANDROID_SECURE_WINDOW) return;
  (on ? ScreenCapture.preventScreenCaptureAsync(SECURE_KEY) : ScreenCapture.allowScreenCaptureAsync(SECURE_KEY)).catch(() => {});
};

/**
 * Allows screenshots while the calling screen is open, and blocks them again when it is
 * left. Used only on the prescription screen, so a patient can send the QR to family.
 * While that screen is open, Android's app-switcher preview can show it too.
 */
export function useAllowScreenshots() {
  useFocusEffect(
    useCallback(() => {
      secureWindow(false);
      return () => secureWindow(true);
    }, []),
  );
}

/** Does the app need unlocking now? */
export function shouldLock(enabled: boolean, backgroundedAt: number | null, now: number, coldStart: boolean): boolean {
  if (!enabled) return false;
  if (coldStart) return true;
  return backgroundedAt !== null && now - backgroundedAt >= LOCK_AFTER_MS;
}

interface LockValue {
  enabled: boolean;
  /** Turns the lock on or off. Returns a message when it can't be turned on. */
  setEnabled: (on: boolean) => Promise<string | null>;
}
const LockContext = createContext<LockValue>({ enabled: false, setEnabled: async () => null });
export const useAppLock = () => useContext(LockContext);

/** `initialEnabled` comes from the start-up read, so a locked app is covered from its very first frame. */
export function LockProvider({ children, active, initialEnabled = false }: { children: ReactNode; active: boolean; initialEnabled?: boolean }) {
  const { colors } = useTheme();
  const [enabled, setEnabledState] = useState(initialEnabled);
  const [locked, setLocked] = useState(() => shouldLock(initialEnabled, null, Date.now(), true));
  const [covered, setCovered] = useState(false);
  const [busy, setBusy] = useState(false);
  const backgroundedAt = useRef<number | null>(null);
  const enabledRef = useRef(initialEnabled);

  useEffect(() => { secureWindow(true); }, []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setCovered(state !== "active");
      if (state === "background") {
        backgroundedAt.current ??= Date.now();
      } else if (state === "active") {
        if (shouldLock(enabledRef.current, backgroundedAt.current, Date.now(), false)) setLocked(true);
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback(async () => {
    setBusy(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Unlock HealingNet" });
      if (result.success) setLocked(false);
    } catch { /* stays locked */ }
    setBusy(false);
  }, []);

  // Ask straight away when the lock appears.
  const showLock = locked && active;
  useEffect(() => { if (showLock && !covered) unlock(); }, [showLock, covered, unlock]);

  const setEnabled = useCallback(async (on: boolean): Promise<string | null> => {
    if (on) {
      const level = await LocalAuthentication.getEnrolledLevelAsync().catch(() => LocalAuthentication.SecurityLevel.NONE);
      if (level === LocalAuthentication.SecurityLevel.NONE) return "Set up a screen lock, fingerprint or face unlock in your phone's settings first.";
      const result = await LocalAuthentication.authenticateAsync({ promptMessage: "Turn on app lock" }).catch(() => null);
      if (!result?.success) return "App lock was not turned on.";
    }
    enabledRef.current = on;
    setEnabledState(on);
    await setFlag(DEVICE_KEYS.appLock, on ? "1" : null);
    return null;
  }, []);

  const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);

  return (
    <LockContext.Provider value={value}>
      {children}
      {showLock && (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background }]} accessibilityViewIsModal>
          <Lock size={40} color={colors.primaryText} />
          <Title style={{ marginTop: 16, textAlign: "center" }}>HealingNet is locked</Title>
          <Body muted style={{ textAlign: "center", marginTop: 8, marginBottom: 24 }}>Unlock to see your health information.</Body>
          <Button label="Unlock" onPress={unlock} loading={busy} />
        </View>
      )}
      {covered && (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.hero }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Image source={require("../assets/logo.png")} style={{ width: 96, height: 96 }} />
        </View>
      )}
    </LockContext.Provider>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", padding: 32 },
});
