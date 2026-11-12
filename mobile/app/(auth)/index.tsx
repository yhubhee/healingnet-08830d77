// Welcome: the first screen for someone who is not signed in.
import { router } from "expo-router";
import { Image, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Body, Button, Title } from "@/components/ui";
import { space, useTheme } from "@/theme";

export default function Welcome() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.hero, paddingTop: insets.top, paddingBottom: insets.bottom + space.xl, paddingHorizontal: space.xl }}>
      <View style={{ flex: 1, justifyContent: "center", gap: space.lg }}>
        <Image source={require("../../assets/logo.png")} style={{ width: 88, height: 88 }} accessibilityLabel="HealingNet logo" />
        <Title color={colors.onHero} style={{ fontSize: 36, lineHeight: 42 }}>Your health, in your pocket</Title>
        <Body color={colors.onHeroMuted}>Book a doctor, see your visits and show your prescriptions at the pharmacy.</Body>
      </View>
      <View style={{ gap: space.md }}>
        <Button label="Sign in" variant="secondary" onPress={() => router.push("/(auth)/sign-in")} />
        <Button label="Create a patient account" variant="onHero" onPress={() => router.push("/(auth)/sign-up")} />
      </View>
    </View>
  );
}
