// Share my records with a hospital (src/components/patient/ShareRecordsCard.tsx): a
// one-time code from create_patient_share_code that expires after 15 minutes, shown
// large with its countdown and as a QR of the code.
import { ShieldCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Mono, Notice, Small, Strong } from "@/components/ui";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { supabase } from "@/lib/supabase";
import { fmtRemaining } from "@/shared/dates";
import { QR_BACKGROUND, QR_FOREGROUND, space, useTheme } from "@/theme";

export default function ShareRecords() {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const [share, setShare] = useState<{ code: string; expiresAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!share) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [share]);

  async function getCode() {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_patient_share_code");
    setBusy(false);
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row?.code) {
      toast.error(/too many codes/i.test(error?.message ?? "") ? "You've asked for too many codes. Please try again in a little while." : "We couldn't create a code. Please try again.");
      return;
    }
    setNow(Date.now());
    setShare({ code: row.code, expiresAt: new Date(row.expires_at).getTime() });
  }

  const remaining = share ? share.expiresAt - now : 0;
  const expired = !!share && remaining <= 0;
  const live = !!share && !expired;

  return (
    <Screen title="Share my records" back>
      <View style={{ flexDirection: "row", gap: space.md, alignItems: "flex-start" }}>
        <ShieldCheck size={28} color={colors.primaryText} />
        <Body muted style={{ flex: 1 }}>Show this code at the front desk. It works once and expires in 15 minutes.</Body>
      </View>

      {live ? (
        <Card style={{ alignItems: "center", gap: space.lg }}>
          <Mono accessibilityLabel={`Code: ${share!.code.split("").join(" ")}`} style={{ fontSize: 40, letterSpacing: 8 }}>{share!.code}</Mono>
          <Strong accessibilityLiveRegion="none">Expires in {fmtRemaining(remaining)}</Strong>
          <View style={{ backgroundColor: QR_BACKGROUND, padding: space.lg, borderRadius: 16 }} accessible accessibilityRole="image" accessibilityLabel="QR code of your share code">
            <QRCode value={share!.code} size={200} backgroundColor={QR_BACKGROUND} color={QR_FOREGROUND} />
          </View>
          <Small style={{ textAlign: "center" }}>The hospital types the code or scans the QR.</Small>
        </Card>
      ) : expired ? <Notice tone="danger" text="This code has expired." /> : null}

      {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
      <Button label={share ? "Get a new code" : "Get a code"} variant={live ? "secondary" : "primary"} onPress={getCode} loading={busy} disabled={!online} disabledReason={OFFLINE_ACTION} />
    </Screen>
  );
}
