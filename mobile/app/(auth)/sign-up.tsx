// Patient sign-up: the same fields the website's patient sign-up sends (first name, last
// name, phone, email, password). A database trigger creates the patient record.
import { MailCheck } from "@/components/icons";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Field } from "@/components/form";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, LinkText, Notice, Small, Title } from "@/components/ui";
import { signInWithGoogle, signupErrorMessage } from "@/lib/auth";
import { AUTH_CALLBACK } from "@/lib/env";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { supabase } from "@/lib/supabase";
import { openWeb } from "@/lib/web";
import { space, useTheme } from "@/theme";

export default function SignUp() {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tried, setTried] = useState(false);
  const [loading, setLoading] = useState(false);
  const [google, setGoogle] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const errors = {
    first: !first.trim() ? "Enter your first name." : undefined,
    last: !last.trim() ? "Enter your last name." : undefined,
    email: !/^\S+@\S+\.\S+$/.test(email.trim()) ? "Enter a valid email address." : undefined,
    password: password.length < 6 ? "Use at least 6 characters." : undefined,
  };

  async function submit() {
    setTried(true);
    if (Object.values(errors).some(Boolean)) return;
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: AUTH_CALLBACK,
        data: { role: "patient", first_name: first.trim(), last_name: last.trim(), phone: phone.trim() },
      },
    });
    setLoading(false);
    if (error || !data.user) {
      toast.error(/fetch|network/i.test(error?.message ?? "") ? "Network problem. Check your connection and try again." : signupErrorMessage(error?.message));
      return;
    }
    if (data.session) toast.success("Account created! Welcome to HealingNet.");
    else setConfirm(true);
  }

  async function withGoogle() {
    setGoogle(true);
    const result = await signInWithGoogle();
    setGoogle(false);
    if (typeof result === "object") toast.error("Google sign-in didn't finish. Please try again.");
  }

  if (confirm) {
    return (
      <Screen back onBack={() => router.replace("/(auth)")}>
        <MailCheck size={44} color={colors.primaryText} />
        <Title>Check your email</Title>
        <Body muted>We've sent a link to {email.trim()} to confirm your address. Open it on this phone, then sign in.</Body>
        <Button label="Go to sign in" onPress={() => router.replace("/(auth)/sign-in")} />
      </Screen>
    );
  }

  return (
    <Screen title="Create your patient account" back onBack={() => router.replace("/(auth)")}>
      <Body muted>Free forever. No card needed.</Body>
      {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
      <View style={{ flexDirection: "row", gap: space.md }}>
        <View style={{ flex: 1 }}>
          <Field label="First name" value={first} onChangeText={setFirst} autoComplete="given-name" textContentType="givenName" error={tried ? errors.first : undefined} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Last name" value={last} onChangeText={setLast} autoComplete="family-name" textContentType="familyName" error={tried ? errors.last : undefined} />
        </View>
      </View>
      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" placeholder="e.g., 0803 000 0000" />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={tried ? errors.email : undefined} />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" textContentType="newPassword"
        error={tried ? errors.password : undefined} hint="At least 6 characters." />
      <Button label={loading ? "Creating account…" : "Create account"} onPress={submit} loading={loading} disabled={!online} disabledReason={OFFLINE_ACTION} />
      <Button label="Continue with Google" variant="secondary" onPress={withGoogle} loading={google} disabled={!online} disabledReason={OFFLINE_ACTION} />
      <Small style={{ textAlign: "center" }}>By creating an account you agree to the Terms and Privacy policy.</Small>
      <View style={{ flexDirection: "row", justifyContent: "center", gap: space.xl }}>
        <LinkText label="Terms" onPress={() => openWeb("/terms")} />
        <LinkText label="Privacy policy" onPress={() => openWeb("/privacy")} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}>
        <Body muted>Already have an account?</Body>
        <LinkText label="Sign in" onPress={() => router.replace("/(auth)/sign-in")} />
      </View>
      <Small style={{ textAlign: "center" }}>Doctors, hospitals and pharmacies sign up on the HealingNet website.</Small>
    </Screen>
  );
}
