// Sign in. Same rules and messages as the website's login page (src/pages/Login.tsx).
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Field } from "@/components/form";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, LinkText, Notice, Small } from "@/components/ui";
import { signInWithGoogle } from "@/lib/auth";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { supabase } from "@/lib/supabase";
import { space, useTheme } from "@/theme";

export default function SignIn() {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [google, setGoogle] = useState(false);
  const [tried, setTried] = useState(false);

  async function signIn() {
    setTried(true);
    if (!email.trim() || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      toast.error(/fetch|network/i.test(error.message) ? "Network problem. Check your connection and try again." : "Login failed. Check your email and password and try again.");
    }
    // On success the root layout moves to the right screen for this account.
  }

  async function withGoogle() {
    setGoogle(true);
    const result = await signInWithGoogle();
    setGoogle(false);
    if (typeof result === "object") toast.error("Google sign-in didn't finish. Please try again.");
  }

  return (
    <Screen title="Welcome back" back onBack={() => router.replace("/(auth)")}>
      <Body muted>Sign in to see your appointments and prescriptions.</Body>
      {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"
        textContentType="emailAddress" error={tried && !email.trim() ? "Enter your email." : undefined} />
      <View>
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password"
          textContentType="password" error={tried && !password ? "Enter your password." : undefined} onSubmitEditing={signIn} returnKeyType="go" />
        <View style={{ alignItems: "flex-end" }}>
          <LinkText label="Forgot password?" onPress={() => router.push("/(auth)/forgot-password")} />
        </View>
      </View>
      <Button label={loading ? "Signing in…" : "Sign in"} onPress={signIn} loading={loading} disabled={!online} disabledReason={OFFLINE_ACTION} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
        <Small>OR</Small>
        <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      </View>
      <Button label="Continue with Google" variant="secondary" onPress={withGoogle} loading={google} disabled={!online} disabledReason={OFFLINE_ACTION} />
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
        <Body muted>Don't have an account?</Body>
        <LinkText label="Sign up" onPress={() => router.replace("/(auth)/sign-up")} />
      </View>
    </Screen>
  );
}
