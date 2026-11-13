// Bottom tabs: Home · Visits · Health · Messages · Me.
// A tab is built the first time it is opened and then stays mounted, so coming back to it
// is instant; freezeOnBlur stops the hidden tabs from re-rendering in the background.
import { CalendarDays, HeartPulse, House, MessageCircle, User } from "@/components/icons";
import { Tabs } from "expo-router/js-tabs";
import { fonts, useTheme } from "@/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        tabBarActiveTintColor: colors.primaryText,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border, minHeight: 64 },
        tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 12 },
        tabBarItemStyle: { minHeight: 48, paddingVertical: 4 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: ({ color, size }) => <House color={color} size={size} /> }} />
      <Tabs.Screen name="visits" options={{ title: "Visits", tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} /> }} />
      <Tabs.Screen name="health" options={{ title: "Health", tabBarIcon: ({ color, size }) => <HeartPulse color={color} size={size} /> }} />
      <Tabs.Screen name="messages" options={{ title: "Messages", tabBarIcon: ({ color, size }) => <MessageCircle color={color} size={size} /> }} />
      <Tabs.Screen name="me" options={{ title: "Me", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tabs>
  );
}
