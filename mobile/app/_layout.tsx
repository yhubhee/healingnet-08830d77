// Root of the app: fonts, theme, saved data, session, and the gate that decides which
// group of screens a person may see.
// Each weight is imported on its own, so only the five fonts in use are packed into the app.
import { Fraunces_600SemiBold } from "@expo-google-fonts/fraunces/600SemiBold";
import { PlusJakartaSans_400Regular } from "@expo-google-fonts/plus-jakarta-sans/400Regular";
import { PlusJakartaSans_500Medium } from "@expo-google-fonts/plus-jakarta-sans/500Medium";
import { PlusJakartaSans_600SemiBold } from "@expo-google-fonts/plus-jakarta-sans/600SemiBold";
import { PlusJakartaSans_700Bold } from "@expo-google-fonts/plus-jakarta-sans/700Bold";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useFonts } from "expo-font";
import { router, Stack, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, type ReactNode } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ToastProvider } from "@/components/toast";
import { Body, Button, Title } from "@/components/ui";
import { isConfigured } from "@/lib/env";
import { LockProvider } from "@/lib/lock";
import { useOnline } from "@/lib/net";
import { listenForNotificationTaps, pushPermission, registerForPush } from "@/lib/push";
import { persistOptions, queryClient } from "@/lib/query";
import { SessionProvider, useSession } from "@/lib/session";
import { DEVICE_KEYS, getFlag } from "@/lib/storage";
import { friendlyError } from "@/shared/errors";
import { missingPatientFields } from "@/shared/patientProfile";
import { ThemeProvider, useTheme } from "@/theme";

SplashScreen.preventAutoHideAsync().catch(() => {});

/** Screens that are open to anyone, signed in or not. */
const OPEN_ROUTES = ["reset-password", "auth-callback"];

function FullScreen({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background }]}>{children}</View>;
}

function Gate() {
  const { colors } = useTheme();
  const { ready, session, kind, kindError, profile, profileError, resolving, retry, signOut } = useSession();
  const segments = useSegments() as string[];
  const online = useOnline();
  const first = segments[0] ?? "";
  const askedPush = useRef(false);

  const signedIn = !!session;
  const isPatient = kind === "patient";
  const profileMissing = isPatient && profile !== undefined && (profile === null || missingPatientFields(profile).length > 0);
  const inApp = signedIn && isPatient && profile != null && !profileMissing;

  useEffect(() => {
    if (!ready || resolving || OPEN_ROUTES.includes(first)) return;
    let target: string | null = null;
    if (!signedIn) {
      if (first !== "(auth)") target = "/(auth)";
    } else if (kind === undefined || (isPatient && profile === undefined)) {
      target = null; // an error screen is shown below
    } else if (kind === "new") {
      if (first !== "finish-signup") target = "/finish-signup";
    } else if (!isPatient) {
      if (first !== "not-patient") target = "/not-patient";
    } else if (profileMissing) {
      if (first !== "complete-profile") target = "/complete-profile";
    } else if (["(auth)", "not-patient", "finish-signup", ""].includes(first)) {
      target = "/(tabs)";
    }
    if (target) router.replace(target);
  }, [ready, resolving, signedIn, kind, isPatient, profile, profileMissing, first]);

  // Push: register on every start and after sign-in; explain before the first permission prompt.
  useEffect(() => {
    if (!inApp) { askedPush.current = false; return; }
    registerForPush();
    const stop = listenForNotificationTaps();
    if (!askedPush.current) {
      askedPush.current = true;
      Promise.all([getFlag(DEVICE_KEYS.pushAsked), pushPermission()]).then(([asked, permission]) => {
        if (!asked && permission === "undetermined") router.push("/push-intro");
      });
    }
    return stop;
  }, [inApp]);

  const loadError = signedIn && !resolving ? (kindError ?? profileError) : null;

  return (
    <LockProvider active={signedIn}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
      {(!ready || (resolving && online)) && !OPEN_ROUTES.includes(first) ? (
        <FullScreen>
          <Image source={require("../assets/logo.png")} style={{ width: 72, height: 72, marginBottom: 24 }} accessibilityLabel="HealingNet" />
          <ActivityIndicator color={colors.primaryText} accessibilityLabel="Loading" />
        </FullScreen>
      ) : (loadError || (resolving && !online)) && !OPEN_ROUTES.includes(first) ? (
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
  return (
    <FullScreen>
      <Title style={{ textAlign: "center" }}>HealingNet isn't set up yet</Title>
      <Body muted style={{ textAlign: "center", marginTop: 12 }}>
        Copy mobile/.env.example to mobile/.env, fill in the publishable key, then restart the app.
      </Body>
    </FullScreen>
  );
}

function Shell() {
  const { scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {isConfigured ? (
        <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
          <SessionProvider>
            <ToastProvider>
              <Gate />
            </ToastProvider>
          </SessionProvider>
        </PersistQueryClientProvider>
      ) : <SetupNeeded />}
    </>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, Fraunces_600SemiBold,
  });
  const fontsReady = loaded || !!error;
  useEffect(() => { if (fontsReady) SplashScreen.hideAsync().catch(() => {}); }, [fontsReady]);
  if (!fontsReady) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", padding: 32 },
});
