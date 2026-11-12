// A new account with no profile yet (for example, the first Google sign-in). The website
// asks which kind of account to create (src/pages/CompleteSignup.tsx); the app only
// creates patient accounts, through the same complete_signup function.
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { View } from "react-native";
import { Field } from "@/components/form";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Notice, Small } from "@/components/ui";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/shared/errors";
import { space } from "@/theme";

export default function FinishSignup() {
  const qc = useQueryClient();
  const toast = useToast();
  const online = useOnline();
  const { session, signOut } = useSession();
  const meta = (session?.user.user_metadata ?? {}) as { full_name?: string; name?: string };
  const [given, ...rest] = String(meta.full_name ?? meta.name ?? "").trim().split(/\s+/);
  const [first, setFirst] = useState(given ?? "");
  const [last, setLast] = useState(rest.join(" "));
  const [phone, setPhone] = useState("");
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setTried(true);
    if (!first.trim() || !last.trim()) return;
    setLoading(true);
    const { error } = await supabase.rpc("complete_signup", {
      p_role: "patient",
      p_data: { first_name: first.trim(), last_name: last.trim(), phone: phone.trim() },
    });
    setLoading(false);
    if (error) return toast.error(`Couldn't finish setup. ${friendlyError(error)}`);
    await qc.invalidateQueries({ queryKey: ["role"] });
  }

  return (
    <Screen title="Finish setting up">
      <Body muted>Tell us your name to create your patient account.</Body>
      {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
      <View style={{ flexDirection: "row", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Field label="First name" value={first} onChangeText={setFirst} autoComplete="given-name" error={tried && !first.trim() ? "Enter your first name." : undefined} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Last name" value={last} onChangeText={setLast} autoComplete="family-name" error={tried && !last.trim() ? "Enter your last name." : undefined} />
        </View>
      </View>
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="e.g., 0803 000 0000" />
      <Button label="Create patient account" onPress={submit} loading={loading} disabled={!online} disabledReason={OFFLINE_ACTION} />
      <Small>Doctors, hospitals and pharmacies set up their accounts on the HealingNet website.</Small>
      <Button label="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}
