import { Image } from "expo-image";
import { Text, View } from "react-native";
import { fonts, useTheme } from "@/theme";

/** A round profile photo, or the person's initials. Decorative: the name is always shown next to it. */
export function Avatar({ url, first, last, size = 64 }: { url?: string | null; first?: string | null; last?: string | null; size?: number }) {
  const { colors } = useTheme();
  const initials = `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
      {url ? <Image source={{ uri: url }} style={{ width: size, height: size }} contentFit="cover" />
        : <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.36, color: colors.primaryText }}>{initials}</Text>}
    </View>
  );
}
