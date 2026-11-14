// Root of the app: fonts, theme, saved data, session, and the gate that decides which
// group of screens a person may see. The first screen is chosen from what is stored on the
// phone (shared/startup.ts), behind the native splash; the network is only used afterwards.
// Each weight is imported on its own, so only the five fonts in use are packed into the app.
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { router, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider } from "@/components/toast";
import { Body, Button, Title } from "@/components/ui";
import { boot as bootRead, type Boot } from "@/lib/boot";
import { useNotificationArrivals, usePrefetchTabs } from "@/lib/data";
import { isConfigured } from "@/lib/env";
import { useKeepActivePersonValid, useShowPersonFor } from "@/lib/family";
import { LockProvider } from "@/lib/lock";
import { useOnline } from "@/lib/net";
import { markStartup, noteTouch, startPerf } from "@/lib/perf";
import { listenForNotificationTaps, pushPermission, registerForPush } from "@/lib/push";
import { cacheReady, queryClient } from "@/lib/query";
import { useReminderSync } from "@/lib/reminderSync";
import { SessionProvider, useSession } from "@/lib/session";
import { DEVICE_KEYS, getFlag } from "@/lib/storage";
import { friendlyError } from "@/shared/errors";
import { gateTarget, OPEN_ROUTES, waitingForCheck } from "@/shared/startup";
import { ThemeProvider, useTheme } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

function FullScreen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background }]}>{children}</View>;
}

const hideSplash = () => { SplashScreen.hideAsync().catch(() => {}); };

function Gate({ appLock }: { appLock: boolean }) {
  const { colors } = useTheme();
  const { session, returning, kind, kindError, profileComplete, profileError, retry, signOut } = useSession();
  const segments = useSegments() as string[];
  const online = useOnline();
  const first = segments[0] ?? "";
  const askedPush = useRef(false);

  const signedIn = !!session;
  const state = { signedIn, returning, kind, profileComplete };
  const target = gateTarget({ ...state, first });
  const waiting = waitingForCheck(state);
  const inApp = signedIn && kind === "patient" && (profileComplete === true || (returning && profileComplete === undefined));

  useEffect(() => { if (target) router.replace(target); }, [target]);

  // The native splash stays up until the right first screen is in place (the saved data is
  // already in the cache by now), so a signed-in patient goes from the icon straight to Home.
  const settled = !target;
  useEffect(() => {
    if (!settled) return;
    hideSplash();
    // Start-up time: the process start to the first screen (Home, or Welcome when signed out).
    if (first === "(tabs)") markStartup("home");
    else if (first === "(auth)") markStartup("welcome");
  }, [settled, first]);
  useEffect(startPerf, []);
  useEffect(() => { const t = setTimeout(hideSplash, 4000); return () => clearTimeout(t); }, []);

  // Warm the Visits and Prescriptions lists while Home is on screen.
  usePrefetchTabs(inApp);
  // A notification arriving refreshes the bell, the Home cards and the family list.
  useNotificationArrivals(inApp);
  // Medicine reminders: top the phone's list back up whenever the app opens.
  useReminderSync(inApp);
  // "Who is this for?": someone removed from the family falls back to Me.
  useKeepActivePersonValid(inApp);
  const showPersonFor = useShowPersonFor();

  // Push: register on every start and after sign-in; explain before the first permission prompt.
  useEffect(() => {
    if (!inApp) { askedPush.current = false; return; }
    registerForPush();
    const stop = listenForNotificationTaps(showPersonFor);
    if (!askedPush.current) {
      askedPush.current = true;
      Promise.all([getFlag(DEVICE_KEYS.pushAsked), pushPermission()]).then(([asked, permission]) => {
        if (!asked && permission === "undetermined") router.push("/push-intro");
      });
    }
    return stop;
  }, [inApp, showPersonFor]);

  // Only a fresh sign-in waits for its first check; a returning patient never sees this.
  const loadError = waiting ? (kindError ?? profileError) : null;
  const open = OPEN_ROUTES.includes(first);

  return (
    <LockProvider active={signedIn} initialEnabled={appLock}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        {/* No slide when the app opens or the account changes: the first screen is simply there. */}
        <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
        <Stack.Screen name="(auth)" options={{ animation: "none" }} />
      </Stack>
      {waiting && !open && !loadError && online ? (
        <FullScreen>
          <Image source={require("../assets/logo.png")} style={{ width: 72, height: 72, marginBottom: 24 }} accessibilityLabel="HealingNet" />
          <ActivityIndicator color={colors.primaryText} accessibilityLabel="Loading" />
        </FullScreen>
      ) : waiting && !open ? (
        <FullScreen>
          <Title style={{ textAlign: "center" }}>{online ? "We couldn't load your account" : "You're offline"}</Title>
          <Body muted style={{ textAlign: "center", marginVertical: 12 }}>
            {online ? friendlyError(loadError) : "Connect to the internet to open HealingNet for the first time on this phone."}
          </Body>
          <Button label="Try again" onPress={retry} style={{ alignSelf: "stretch" }} />
          <Button label="Sign out" variant="ghost" onPress={signOut} style={{ alignSelf: "stretch", marginTop: 8 }} />
        </FullScreen>
      ) : null}
    </LockProvider>
  );
}

function SetupNeeded() {
  useEffect(hideSplash, []);
  return (
    <FullScreen>
      <Title style={{ textAlign: "center" }}>HealingNet isn't set up yet</Title>
      <Body muted style={{ textAlign: "center", marginTop: 12 }}>
        Copy mobile/.env.example to mobile/.env, fill in the publishable key, then restart the app.
      </Body>
    </FullScreen>
  );
}

function Shell({ boot }: { boot: Boot }) {
  const { scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {isConfigured ? (
        <QueryClientProvider client={queryClient}>
          <SessionProvider boot={boot}>
            <ToastProvider>
              <Gate appLock={boot.appLock} />
            </ToastProvider>
          </SessionProvider>
        </QueryClientProvider>
      ) : <SetupNeeded />}
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, Fraunces_600SemiBold,
  });
  // The stored session, the saved account check, the app-lock switch and the saved lists:
  // read from the phone while the fonts load. Nothing here touches the network.
  const [boot, setBoot] = useState<Boot | null>(null);
  useEffect(() => { Promise.all([bootRead, cacheReady]).then(([b]) => setBoot(b)); }, []);
  if (!(loaded || error) || !boot) return null;

  return (
    <SafeAreaProvider>
      {/* Every tap is noted (the time only), so a screen can be timed from the tap that opened it. */}
      <View style={{ flex: 1 }} onTouchStart={noteTouch}>
        <ThemeProvider>
          <Shell boot={boot} />
        </ThemeProvider>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", padding: 32 },
});
