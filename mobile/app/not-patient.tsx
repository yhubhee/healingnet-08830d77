// Doctors, hospital staff, pharmacies and admins who sign in to the patient app.
import { Stethoscope } from "lucide-react-native";
import { useState } from "react";
import { Screen } from "@/components/Screen";
import { Body, Button, Title } from "@/components/ui";
import { WEB_URL } from "@/lib/env";
import { useSession } from "@/lib/session";
import { openUrl } from "@/lib/web";
import { useTheme } from "@/theme";

export default function NotPatient() {
  const { colors } = useTheme();
  const { signOut } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <Screen>
      <Stethoscope size={44} color={colors.primaryText} style={{ marginTop: 48 }} />
      <Title>This app is for patients</Title>
      <Body muted>This app is for patients. Please use the HealingNet website.</Body>
      <Button label="Open the HealingNet website" onPress={() => openUrl(WEB_URL)} />
      <Button label="Sign out" variant="secondary" loading={busy} onPress={async () => { setBusy(true); await signOut(); }} />
    </Screen>
  );
}
