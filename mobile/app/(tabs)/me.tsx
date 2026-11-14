// Me: profile summary and settings (src/pages/patient/Profile.tsx and Settings.tsx).
import { Bell, FileText, Gauge, Lock, LogOut, Shield, Trash2, UserRound, Users } from "@/components/icons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { NavRow, Segmented, ToggleRow } from "@/components/form";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Button, Card, Divider, Heading, Label, Small } from "@/components/ui";
import { APP_VERSION } from "@/lib/env";
import { useAppLock } from "@/lib/lock";
import { setSpeedDataEnabled, useScreenReady, useSpeedDataEnabled } from "@/lib/perf";
import { useFamily } from "@/lib/family";
import { useSession } from "@/lib/session";
import { openWeb } from "@/lib/web";
import { space, useTheme, type ThemeChoice } from "@/theme";

export default function Me() {
  const { choice, setChoice } = useTheme();
  const toast = useToast();
  // Me is always the account holder, whoever "Who is this for?" is set to.
  const { profile: p, signOut } = useSession();
  const family = useFamily();
  const familyCount = family.data?.length ?? 0;
  const lock = useAppLock();
  const [leaving, setLeaving] = useState(false);
  const speedData = useSpeedDataEnabled();
  useScreenReady("/(tabs)/me", true);

  function confirmSignOut() {
    Alert.alert("Sign out?", "Your saved data is removed from this phone. You can sign in again any time.", [
      { text: "Stay signed in", style: "cancel" },
      { text: "Sign out", onPress: async () => { setLeaving(true); await signOut(); } },
    ]);
  }

  async function toggleLock(on: boolean) {
    const problem = await lock.setEnabled(on);
    if (problem) toast.error(problem);
    else toast.success(on ? "App lock is on" : "App lock is off");
  }

  return (
    <Screen tab title="Me">
      <Card style={{ gap: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.lg }}>
          <Avatar url={p?.profile_image_url} first={p?.first_name} last={p?.last_name} size={68} />
          <View style={{ flex: 1 }}>
            <Heading>{p ? `${p.first_name} ${p.last_name}` : "Your profile"}</Heading>
            {p?.email ? <Small>{p.email}</Small> : null}
            {p?.phone ? <Small>{p.phone}</Small> : null}
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: space.sm }}>
          <Button small variant="secondary" label="View profile" style={{ flex: 1 }} onPress={() => router.push("/profile")} />
          <Button small variant="secondary" label="Edit profile" style={{ flex: 1 }} onPress={() => router.push("/complete-profile?edit=1")} />
        </View>
      </Card>

      <Card style={{ gap: space.xs }}>
        <Label>Family</Label>
        <NavRow icon={Users} label="Family" hint="Manage health care for your children and other family members"
          value={familyCount ? String(familyCount) : undefined} onPress={() => router.push("/family")} />
      </Card>

      <Card style={{ gap: space.md }}>
        <Label>Appearance</Label>
        <Segmented<ThemeChoice> label="Appearance" value={choice} onChange={setChoice}
          options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
      </Card>

      <Card style={{ gap: space.xs }}>
        <Label>Settings</Label>
        <NavRow icon={Bell} label="Notifications" hint="Choose which alerts reach this phone" onPress={() => router.push("/settings/notifications")} />
        <Divider />
        <ToggleRow icon={Lock} label="App lock" hint="Ask for fingerprint, face or passcode after 5 minutes away" value={lock.enabled} onChange={toggleLock} />
        <Divider />
        <ToggleRow icon={Gauge} label="Share speed data" hint="Helps us find slow screens. No health or personal information is sent."
          value={speedData} onChange={setSpeedDataEnabled} />
      </Card>

      <Card style={{ gap: space.xs }}>
        <Label>About</Label>
        <NavRow icon={Shield} label="Privacy policy" hint="Opens the website" onPress={() => openWeb("/privacy")} />
        <Divider />
        <NavRow icon={FileText} label="Terms" hint="Opens the website" onPress={() => openWeb("/terms")} />
      </Card>

      <Card style={{ gap: space.xs }}>
        <Label>Account</Label>
        <NavRow icon={UserRound} label="Share my records" onPress={() => router.push("/share-records")} />
        <Divider />
        <NavRow icon={Trash2} label="Delete my account" danger onPress={() => router.push("/delete-account")} />
      </Card>

      <Button label="Sign out" variant="secondary" icon={LogOut} onPress={confirmSignOut} loading={leaving} />
      <Small style={{ textAlign: "center" }}>HealingNet version {APP_VERSION}</Small>
    </Screen>
  );
}
