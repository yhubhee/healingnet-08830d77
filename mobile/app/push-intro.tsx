// Shown once after the first sign-in, before the phone's own permission prompt.
import { router } from "expo-router";
import { BellRing } from "lucide-react-native";
import { useState } from "react";
import { Screen } from "@/components/Screen";
import { Body, Button, Small, Title } from "@/components/ui";
import { askPushPermission, registerForPush } from "@/lib/push";
import { DEVICE_KEYS, setFlag } from "@/lib/storage";
import { useTheme } from "@/theme";

export default function PushIntro() {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const close = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));

  async function allow() {
    setBusy(true);
    await setFlag(DEVICE_KEYS.pushAsked, "1");
    if ((await askPushPermission()) === "granted") await registerForPush();
    setBusy(false);
    close();
  }
  async function later() {
    await setFlag(DEVICE_KEYS.pushAsked, "1");
    close();
  }

  return (
    <Screen
      footer={
        <>
          <Button label="Turn on notifications" onPress={allow} loading={busy} />
          <Button label="Not now" variant="ghost" onPress={later} />
        </>
      }
    >
      <BellRing size={48} color={colors.primaryText} style={{ marginTop: 48 }} />
      <Title>Get appointment updates and reminders</Title>
      <Body muted>
        We'll tell you when a hospital confirms your visit, remind you 24 hours and 1 hour before, and let you know when a pharmacy replies.
      </Body>
      <Small>Notifications on your lock screen say only "Appointment update" unless you choose to show details in Settings. You can change this any time.</Small>
    </Screen>
  );
}
