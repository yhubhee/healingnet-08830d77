// Before a video visit: say what is about to happen and why the camera and microphone are
// needed. "Join now" opens the call inside the app (app/call/[appointmentId].tsx), which
// asks for the camera and microphone at that moment. The 0.4 way, the website's call page
// in the phone's browser, stays available as "Open in browser instead".
import { Camera, Globe, Mic, Video, Wifi } from "./icons";
import type { LucideIcon } from "./icons";
import { router } from "expo-router";
import { View } from "react-native";
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
  /** Called when the patient comes back from a call opened in the browser, to refresh the visit. */
  onReturned: () => void;
}) {
  const online = useOnline();

  function join() {
    if (!appointment) return;
    const a = appointment;
    onClose();
    router.push({ pathname: "/call/[appointmentId]", params: { appointmentId: a.id, with: a.doctors ? doctorOrPending(a) : "" } });
  }

  async function inBrowser() {
    if (!appointment) return;
    const id = appointment.id;
    onClose();
    await openUrl(consultUrl(WEB_URL, id));
    onReturned();
  }

  return (
    <Sheet visible={!!appointment} onClose={onClose} title="Join your video visit"
      footer={
        <>
          {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
          <Button label="Join now" icon={Video} onPress={join} disabled={!online} disabledReason={OFFLINE_ACTION} />
          <Button label="Open in browser instead" variant="ghost" icon={Globe} onPress={inBrowser} disabled={!online} disabledReason={OFFLINE_ACTION} />
          <Button label="Not now" variant="ghost" onPress={onClose} />
        </>
      }>
      <View style={{ gap: space.lg }}>
        <Body>{appointment ? `With ${doctorOrPending(appointment)}. ` : ""}The call opens here, inside the app.</Body>
        <Point icon={Camera} title="Allow the camera" text="HealingNet will ask to use the camera. Choose Allow, so the doctor can see you." />
        <Point icon={Mic} title="Allow the microphone" text="Choose Allow for the microphone too, so the doctor can hear you." />
        <Point icon={Wifi} title="Find a good connection" text="Wi-Fi or strong mobile data, somewhere quiet and private." />
        <Small>The camera and microphone are used only during the call. Nothing is recorded.</Small>
      </View>
    </Sheet>
  );
}
