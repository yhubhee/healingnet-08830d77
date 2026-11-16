// The video visit, inside the app (0.5). The room and the meeting token come from the same
// daily-room function the website uses; Daily's own call page is then shown in a WebView.
//   - The camera and microphone are asked for here, with the reason, before the page loads.
//     The WebView hands them to the page it shows, and that page can only be Daily's or our
//     own website (shared/callNav.ts); any other link opens in the phone's browser.
//   - The screen stays awake while the call is open. Back asks before leaving.
//   - If the page will not load or the camera is blocked, "Open in browser instead" uses the
//     0.4 way (the website's call page in the phone's browser).
// Nothing here logs the room, the token or who is calling.
import { useQueryClient } from "@tanstack/react-query";
import { Camera } from "expo-camera";
import { useKeepAwake } from "expo-keep-awake";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Linking, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { Globe, PhoneOff } from "@/components/icons";
import { Body, Button, Heading, Small, Strong } from "@/components/ui";
import { WEB_URL } from "@/lib/env";
import { useOnline } from "@/lib/net";
import { supabase } from "@/lib/supabase";
import { openUrl } from "@/lib/web";
import { callMayNavigate, callPageUrl, opensInBrowser } from "@/shared/callNav";
import { consultUrl } from "@/shared/links";
import { fonts, MIN_TOUCH, space, useTheme } from "@/theme";

type Stage =
  | { at: "starting" }
  | { at: "blocked" } // camera or microphone refused
  | { at: "failed"; message: string }
  | { at: "call"; url: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_OPEN_YET = "The video call opens once the doctor has accepted the appointment.";

export default function CallScreen() {
  useKeepAwake("hn-call");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const online = useOnline();
  const { appointmentId, with: doctor } = useLocalSearchParams<{ appointmentId: string; with?: string }>();
  const id = UUID.test(appointmentId ?? "") ? appointmentId : null;
  const [stage, setStage] = useState<Stage>({ at: "starting" });
  const [pageReady, setPageReady] = useState(false);
  const left = useRef(false);

  const start = useCallback(async () => {
    setStage({ at: "starting" });
    setPageReady(false);
    if (!id) { setStage({ at: "failed", message: "We couldn't find this video visit." }); return; }
    try {
      // Asked only now, with the reason on the sheet before this screen.
      const camera = await Camera.requestCameraPermissionsAsync();
      const mic = await Camera.requestMicrophonePermissionsAsync();
      if (!camera.granted || !mic.granted) { setStage({ at: "blocked" }); return; }
      const { data, error } = await supabase.functions.invoke("daily-room", { body: { kind: "appointment", id } });
      const url = !error && data?.url && data?.token ? callPageUrl(String(data.url), String(data.token)) : null;
      if (!url) {
        const status = (error as { context?: { status?: number } } | null)?.context?.status;
        setStage({ at: "failed", message: status === 403 ? NOT_OPEN_YET : "We couldn't start the video call. Please try again." });
        return;
      }
      setStage({ at: "call", url });
    } catch {
      setStage({ at: "failed", message: "We couldn't start the video call. Check your connection and try again." });
    }
  }, [id]);
  useEffect(() => { start(); }, [start]);

  /** Closes the screen; marks the call as ended (as the website does) and refreshes the visit. */
  const leave = useCallback(async (endCall: boolean) => {
    if (left.current) return;
    left.current = true;
    if (endCall && id) { try { await supabase.rpc("end_call", { _kind: "appointment", _id: id }); } catch { /* best effort */ } }
    qc.invalidateQueries({ queryKey: ["appointments"] });
    if (router.canGoBack()) router.back(); else router.replace("/(tabs)/visits");
  }, [id, qc]);

  const inCall = stage.at === "call";
  const confirmLeave = useCallback((title: string) => {
    if (!inCall) { leave(false); return; }
    Alert.alert(title, "The call will close on this phone. You can join again from Visits while the doctor is still there.", [
      { text: "Stay in the call", style: "cancel" },
      { text: "End call", style: "destructive", onPress: () => { leave(true); } },
    ]);
  }, [inCall, leave]);

  // Android back asks first.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { confirmLeave("Leave the call?"); return true; });
    return () => sub.remove();
  }, [confirmLeave]);

  const browser = useCallback(async () => {
    if (!id) return;
    left.current = true;
    await openUrl(consultUrl(WEB_URL, id));
    qc.invalidateQueries({ queryKey: ["appointments"] });
    if (router.canGoBack()) router.back(); else router.replace("/(tabs)/visits");
  }, [id, qc]);

  const title = doctor ? `Video visit with ${doctor}` : "Video visit";

  return (
    <View style={{ flex: 1, backgroundColor: "#0B1413", paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.md, minHeight: 60, backgroundColor: colors.background }}>
        <View style={{ flex: 1 }}>
          <Strong numberOfLines={1} accessibilityRole="header">{title}</Strong>
          <Small>{inCall ? (pageReady ? "The screen stays on during the call." : "Joining…") : "Getting ready…"}</Small>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="End call" onPress={() => confirmLeave("End the call?")}
          style={({ pressed }) => ({
            minHeight: MIN_TOUCH, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: space.md, borderRadius: 999,
            backgroundColor: "#C62828", opacity: pressed ? 0.8 : 1,
          })}>
          <PhoneOff size={18} color="#FFFFFF" />
          <Text style={{ fontFamily: fonts.bold, fontSize: 15, color: "#FFFFFF" }}>End call</Text>
        </Pressable>
      </View>

      {stage.at === "call" ? (
        <View style={{ flex: 1, paddingBottom: insets.bottom }}>
          <WebView
            source={{ uri: stage.url }}
            style={{ flex: 1, backgroundColor: "#0B1413" }}
            originWhitelist={["https://*"]}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grant"
            allowsFullscreenVideo
            setSupportMultipleWindows={false}
            allowFileAccess={false}
            geolocationEnabled={false}
            // The page may only move within Daily and our website; anything else goes to the browser.
            onShouldStartLoadWithRequest={(request) => {
              if (callMayNavigate(request.url, WEB_URL)) return true;
              if (opensInBrowser(request.url)) Linking.openURL(request.url).catch(() => {});
              return false;
            }}
            onLoadEnd={() => setPageReady(true)}
            onError={() => setStage({ at: "failed", message: "The call page didn't load." })}
            onHttpError={(e) => { if (e.nativeEvent.statusCode >= 400 && callMayNavigate(e.nativeEvent.url, WEB_URL)) setStage({ at: "failed", message: "The call page didn't load." }); }}
            onRenderProcessGone={() => setStage({ at: "failed", message: "The call stopped unexpectedly." })}
            onContentProcessDidTerminate={() => setStage({ at: "failed", message: "The call stopped unexpectedly." })}
          />
          {!pageReady ? (
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color="#FFFFFF" size="large" accessibilityLabel="Joining the call" />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.background, padding: space.xl, gap: space.md, justifyContent: "center" }}>
          {stage.at === "starting" ? (
            <>
              <ActivityIndicator color={colors.primaryText} size="large" accessibilityLabel="Starting the call" />
              <Body muted style={{ textAlign: "center" }}>Starting your video visit…</Body>
            </>
          ) : stage.at === "blocked" ? (
            <>
              <Heading style={{ textAlign: "center" }}>The camera or microphone is turned off</Heading>
              <Body muted style={{ textAlign: "center" }}>Your doctor needs to see and hear you. Allow the camera and microphone for HealingNet in your phone's settings, then try again.</Body>
              <Button label="Open settings" onPress={() => { Linking.openSettings().catch(() => {}); }} />
              <Button label="Try again" variant="secondary" onPress={start} />
              <Button label="Open in browser instead" variant="ghost" icon={Globe} onPress={browser} />
            </>
          ) : (
            <>
              <Heading style={{ textAlign: "center" }}>{online ? stage.message : "You're offline"}</Heading>
              <Body muted style={{ textAlign: "center" }}>{online ? "You can try again, or open the call in your phone's browser." : "Connect to the internet, then try again."}</Body>
              <Button label="Try again" onPress={start} />
              {id && stage.message !== NOT_OPEN_YET ? <Button label="Open in browser instead" variant="secondary" icon={Globe} onPress={browser} /> : null}
              <Button label="Close" variant="ghost" onPress={() => leave(false)} />
            </>
          )}
        </View>
      )}
    </View>
  );
}
