// healingnet://auth-callback: where Google sign-in and email-confirmation links land.
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator } from "react-native";
import { Screen } from "@/components/Screen";
import { Body, Button, Title } from "@/components/ui";
import { finishAuthLink } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/theme";

export default function AuthCallback() {
  const { colors } = useTheme();
  const url = Linking.useLinkingURL();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      const result = await finishAuthLink(url);
      if (!live) return;
      const { data } = await supabase.auth.getSession();
      if (!live) return;
      // The root layout sends a signed-in person to the right place.
      if (data.session) router.replace("/(tabs)");
      else if (typeof result === "object") setFailed(true);
      else router.replace("/(auth)/sign-in");
    })();
    return () => { live = false; };
  }, [url]);

  if (failed) {
    return (
      <Screen>
        <Title>That link didn't work</Title>
        <Body muted>It may have expired or been used already. If you were confirming your email, you can now sign in.</Body>
        <Button label="Go to sign in" onPress={() => router.replace("/(auth)/sign-in")} />
      </Screen>
    );
  }
  return (
    <Screen>
      <ActivityIndicator color={colors.primaryText} accessibilityLabel="Signing you in" style={{ marginTop: 80 }} />
      <Body muted style={{ textAlign: "center" }}>Signing you in…</Body>
    </Screen>
  );
}
