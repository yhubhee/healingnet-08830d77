// Step 1 of a password reset (src/pages/ForgotPassword.tsx): email a link that opens the
// app's reset screen. Whether the email has an account is never revealed.
import { MailCheck } from "@/components/icons";
import { router } from "expo-router";
import { useState } from "react";
import { Field } from "@/components/form";
import { Screen } from "@/components/Screen";
import { Body, Button, LinkText, Notice, Title } from "@/components/ui";
import { RESET_PASSWORD_LINK } from "@/lib/env";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme";

export default function ForgotPassword() {
  const { colors } = useTheme();
  const online = useOnline();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!email.trim()) return setError("Enter your email.");
    setError(null);
    setLoading(true);
    const { error: e } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: RESET_PASSWORD_LINK });
    setLoading(false);
    if (e && /rate limit|too many|429/i.test(`${e.message} ${e.status ?? ""}`)) {
      return setError("Too many reset emails were sent. Please wait a few minutes and try again.");
    }
    if (e && /fetch|network/i.test(e.message)) return setError("Network problem. Check your connection and try again.");
    setSent(true);
  }

  if (sent) {
    return (
      <Screen back>
        <MailCheck size={44} color={colors.primaryText} />
        <Title>Check your email</Title>
        <Body muted>
          If {email.trim()} has a HealingNet account, we've sent a link to choose a new password. Open it on this phone. It can take a few minutes; check your spam folder too.
        </Body>
        <Button label="Use a different email" variant="secondary" onPress={() => setSent(false)} />
        <LinkText label="Back to sign in" onPress={() => router.replace("/(auth)/sign-in")} />
      </Screen>
    );
  }

  return (
    <Screen title="Forgot your password?" back>
      <Body muted>Enter your email and we'll send you a link to choose a new one.</Body>
      {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={error ?? undefined} />
      <Button label={loading ? "Sending…" : "Send reset link"} onPress={send} loading={loading} disabled={!online} disabledReason={OFFLINE_ACTION} />
      <LinkText label="Back to sign in" onPress={() => router.replace("/(auth)/sign-in")} />
    </Screen>
  );
}
