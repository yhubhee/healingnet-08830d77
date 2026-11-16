// Check in at a hospital: scan the QR code at the front desk. Only HealingNet check-in
// links are accepted; anything else is refused in words. The camera is asked for here,
// with the reason, and never earlier. A torch button helps in a dim reception, and the
// code can be typed when the camera will not work. Nothing scanned is logged or kept.
import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useIsFocused } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Linking, View } from "react-native";
import { Field } from "@/components/form";
import { Camera, Flashlight, Keyboard, QrCode } from "@/components/icons";
import { Screen } from "@/components/Screen";
import { Body, Button, Card, Notice, Small, Strong } from "@/components/ui";
import { WEB_URL } from "@/lib/env";
import { useOnline } from "@/lib/net";
import { cleanCheckinToken, NOT_A_CHECKIN_CODE, parseCheckinUrl, SCANNER_OFFLINE } from "@/shared/checkin";
import { radius, space, useTheme } from "@/theme";

const SITES = [WEB_URL];

export default function CheckInScan() {
  const { colors } = useTheme();
  const online = useOnline();
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [typing, setTyping] = useState(false);
  const [code, setCode] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const handled = useRef(false);

  const open = useCallback((token: string) => {
    handled.current = true;
    setTorch(false);
    router.replace({ pathname: "/checkin/[token]", params: { token } });
  }, []);

  const onScanned = useCallback(({ data }: { data: string }) => {
    if (handled.current) return;
    const token = parseCheckinUrl(data, SITES);
    if (token) open(token);
    else setProblem(NOT_A_CHECKIN_CODE);
  }, [open]);

  function submitTyped() {
    const token = parseCheckinUrl(code, SITES) ?? cleanCheckinToken(code);
    if (token) open(token);
    else setProblem("That code doesn't look right. Check the letters under the QR code, or ask the front desk.");
  }

  const granted = permission?.granted === true;
  const blocked = permission && !permission.granted && !permission.canAskAgain;

  return (
    <Screen title="Check in" back person="switch">
      {!online ? <Notice tone="warning" text={SCANNER_OFFLINE} /> : null}

      {typing ? (
        <Card style={{ gap: space.md }}>
          <Strong>Type the code</Strong>
          <Small>Ask the front desk for the hospital's check-in code, or type the link printed under the QR code.</Small>
          <Field label="Check-in code" value={code} onChangeText={(t) => { setCode(t); setProblem(null); }} autoCapitalize="none" autoCorrect={false}
            placeholder="For example abcd efgh jkmn p234" returnKeyType="go" onSubmitEditing={submitTyped} />
          <Button label="Continue" onPress={submitTyped} disabled={!online || !code.trim()} disabledReason={!online ? SCANNER_OFFLINE : "Type the code first."} />
          <Button label="Scan the code instead" variant="ghost" icon={QrCode} onPress={() => { setTyping(false); setProblem(null); }} />
        </Card>
      ) : granted ? (
        <View style={{ gap: space.md }}>
          <Body muted>Point the camera at the QR code at the hospital's front desk.</Body>
          <View style={{ aspectRatio: 1, borderRadius: radius.card, overflow: "hidden", backgroundColor: "#000" }} accessible accessibilityLabel="Camera, looking for the check-in code">
            {focused && online ? (
              <CameraView style={{ flex: 1 }} facing="back" enableTorch={torch} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} onBarcodeScanned={onScanned} />
            ) : null}
          </View>
          <Button label={torch ? "Turn the torch off" : "Turn the torch on"} variant="secondary" icon={Flashlight} onPress={() => setTorch((t) => !t)} />
        </View>
      ) : (
        <Card style={{ gap: space.md }}>
          <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
            <Camera size={28} color={colors.primaryText} />
          </View>
          <Strong>Allow the camera to scan the code</Strong>
          <Body muted>HealingNet uses the camera only to read the hospital's check-in code. No photo is taken or saved.</Body>
          {blocked ? (
            <>
              <Small>The camera is turned off for HealingNet. Turn it on in your phone's settings, or type the code instead.</Small>
              <Button label="Open settings" icon={Camera} onPress={() => { Linking.openSettings().catch(() => {}); }} />
            </>
          ) : (
            <Button label="Allow camera" icon={Camera} onPress={() => { requestPermission().catch(() => {}); }} />
          )}
        </Card>
      )}

      {problem ? <Notice tone="danger" text={problem} /> : null}
      {!typing ? <Button label="Type the code instead" variant="ghost" icon={Keyboard} onPress={() => { setTyping(true); setProblem(null); }} /> : null}
    </Screen>
  );
}
