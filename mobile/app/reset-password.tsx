// Step 2 of a password reset (src/pages/ResetPassword.tsx). The emailed link opens this
// screen signed in; the person then chooses a new password.
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Field } from "@/components/form";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, LinkText, Title } from "@/components/ui";
import { finishAuthLink } from "@/lib/auth";
import { clearEverything } from "@/lib/query";
import { supabase } from "@/lib/supabase";
import { friendlyError } from "@/shared/errors";
import { useTheme } from "@/theme";

export default function ResetPassword() {
  const { colors } = useTheme();
  const toast = useToast();
  const url = Linking.useLinkingURL();
  const [ready, setReady] = useState<"checking" | "yes" | "no">("checking");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [mismatch, setMismatch] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const result = await finishAuthLink(url);
      if (!live) return;
      if (typeof result === "object") {
        setLinkError(result.error);
        setReady("no");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (live) setReady(data.session ? "yes" : "no");
    })();
    return () => { live = false; };
  }, [url]);

  async function save() {
    if (password.length < 6) return toast.error("Choose a stronger password (at least 6 characters).");
    if (password !== confirm) { setMismatch(true); return toast.error("Passwords don't match. Type the same new password twice."); }
    setMismatch(false);
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      const description = /different from the old/i.test(error.message) ? "Choose a password you haven't used before."
        : /at least|short|weak/i.test(error.message) ? "Choose a stronger password (at least 6 characters)."
        : friendlyError(error);
      return toast.error(`Couldn't update your password. ${description}`);
    }
    await clearEverything();
    toast.success("Password updated. Sign in with your new password.");
    router.replace("/(auth)/sign-in");
  }

  if (ready === "checking") {
    return (
      <Screen>
        <ActivityIndicator color={colors.primaryText} style={{ marginTop: 80 }} />
        <Body muted style={{ textAlign: "center" }}>Checking your reset link…</Body>
      </Screen>
    );
  }
  if (ready === "no") {
    return (
      <Screen>
        <Title>This link doesn't work</Title>
        <Body muted>{linkError ? `${linkError}. ` : ""}Reset links work once and expire after a while. Ask for a new one.</Body>
        <Button label="Send a new reset link" onPress={() => router.replace("/(auth)/forgot-password")} />
        <View style={{ alignItems: "center" }}>
          <LinkText label="Back to sign in" onPress={() => router.replace("/(auth)/sign-in")} />
        </View>
      </Screen>
    );
  }
  return (
    <Screen title="Set new password">
      <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword" hint="At least 6 characters." />
      <Field label="Type it again" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" textContentType="newPassword"
        error={mismatch ? "Passwords don't match." : undefined} />
      <Button label={loading ? "Updating…" : "Update password"} onPress={save} loading={loading} />
    </Screen>
  );
}
