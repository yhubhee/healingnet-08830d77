// Before a video visit: say what is about to happen and why the camera and microphone are
// needed, show "Joining…" while the call page opens, and refresh the visit on the way back.
//
// The call itself stays in the phone's browser, opened inside the app (a Chrome Custom Tab
// on Android). A native video SDK would add tens of MB to the app. The camera and
// microphone permission therefore belongs to the browser, not to this app: the app cannot
// read or grant it, so it explains it instead.
import { Camera, Mic, Video, Wifi } from "./icons";
import type { LucideIcon } from "./icons";
import { useEffect, useRef, useState } from "react";
import { AppState, Platform, View } from "react-native";
import { WEB_URL } from "@/lib/env";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { openUrl } from "@/lib/web";
import { doctorOrPending, type Appointment } from "@/shared/appointments";
import { consultUrl } from "@/shared/links";
import { space, useTheme } from "@/theme";
import { Sheet } from "./form";
import { Body, Button, Notice, Small, Strong } from "./ui";

function Point({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
      <Icon size={24} color={colors.primaryText} />
      <View style={{ flex: 1 }}>
        <Strong>{title}</Strong>
        <Small>{text}</Small>
      </View>
    </View>
  );
}

export function JoinCallSheet({ appointment, onClose, onReturned }: {
  appointment: Appointment | null;
  onClose: () => void;
  /** Called when the patient comes back from the call, to refresh the visit. */
  onReturned: () => void;
}) {
  const online = useOnline();
  const [joining, setJoining] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => cleanup.current?.(), []);
  useEffect(() => { if (!appointment) setJoining(false); }, [appointment]);

  async function join() {
    if (!appointment || joining) return;
    setJoining(true);
    let away = false;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      cleanup.current?.();
      cleanup.current = null;
      setJoining(false);
      onReturned();
      onClose();
    };
    // Android: the browser opens over the app, so "came back" is the app becoming active again.
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") away = true;
      else if (away) finish();
    });
    const giveUp = setTimeout(() => { if (!away) finish(); }, 8000);
    cleanup.current = () => { sub.remove(); clearTimeout(giveUp); };
    await openUrl(consultUrl(WEB_URL, appointment.id));
    // iPhone: the promise itself resolves when the browser sheet is closed.
    if (Platform.OS === "ios") finish();
  }

  return (
    <Sheet visible={!!appointment} onClose={joining ? () => {} : onClose} title="Join your video visit"
      footer={
        <>
          {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
          <Button label={joining ? "Joining…" : "Join now"} icon={Video} onPress={join} loading={joining} disabled={!online} disabledReason={OFFLINE_ACTION} />
          {!joining ? <Button label="Not now" variant="ghost" onPress={onClose} /> : null}
        </>
      }>
      <View style={{ gap: space.lg }}>
        <Body>{appointment ? `With ${doctorOrPending(appointment)}. ` : ""}The call opens in your phone's browser, inside the app.</Body>
        <Point icon={Camera} title="Allow the camera" text="Your browser will ask to use the camera. Choose Allow, so the doctor can see you." />
        <Point icon={Mic} title="Allow the microphone" text="Choose Allow for the microphone too, so the doctor can hear you." />
        <Point icon={Wifi} title="Find a good connection" text="Wi-Fi or strong mobile data, somewhere quiet and private." />
        <Small>If you tapped Block before, open your browser's settings, find Site settings, and allow the camera and microphone for HealingNet.</Small>
        {joining ? <Small accessibilityLiveRegion="polite" muted={false}>Joining… When the call ends, close the browser to come back here.</Small> : null}
      </View>
    </Sheet>
  );
}
