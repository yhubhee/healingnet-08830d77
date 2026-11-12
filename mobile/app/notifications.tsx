// Notifications (src/components/common/UserNotificationsList.tsx): read and unread, tap
// to open the matching screen, mark all read.
import { router } from "expo-router";
import { Bell, CheckCheck } from "lucide-react-native";
import { View } from "react-native";
import { QueryState } from "@/components/QueryState";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Chip, EmptyState, Small, Strong } from "@/components/ui";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useRealtime } from "@/lib/data";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { useSession } from "@/lib/session";
import { fmtDateTime } from "@/shared/dates";
import { friendlyError } from "@/shared/errors";
import { screenForUrl } from "@/shared/links";
import { space, useTheme } from "@/theme";

export default function Notifications() {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const { userId } = useSession();
  const q = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  useRealtime("user_notifications", userId ? `user_id=eq.${userId}` : null, [["notifications"], ["home-summary"]]);

  const list = q.data ?? [];
  const unread = list.filter((n) => !n.is_read).length;

  return (
    <Screen title="Notifications" back onRefresh={() => q.refetch()} refreshing={q.isRefetching}>
      <View style={{ gap: space.sm }}>
        <Body muted>{unread > 0 ? `${unread} unread` : "You're all caught up"}</Body>
        <Button small variant="secondary" icon={CheckCheck} label="Mark all read" loading={markAll.isPending}
          disabled={unread === 0 || !online} disabledReason={!online ? OFFLINE_ACTION : "Nothing is unread"}
          onPress={() => markAll.mutate(undefined, { onError: (e) => toast.error(friendlyError(e)) })} />
      </View>
      <QueryState query={q}>
        {list.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications yet" text="Updates about your visits and prescriptions appear here." actionLabel="Go to Home" onAction={() => router.replace("/(tabs)")} />
        ) : list.map((n) => (
          <Card key={n.id} accessibilityLabel={`${n.is_read ? "" : "Unread. "}${n.title}. ${n.message ?? ""}`}
            style={{ gap: 4, borderColor: n.is_read ? colors.border : colors.primaryText, backgroundColor: n.is_read ? colors.card : colors.primarySoft }}
            onPress={() => { if (!n.is_read && online) markRead.mutate(n.id); router.navigate(screenForUrl(n.action_url)); }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Strong style={{ flex: 1 }}>{n.title}</Strong>
              {!n.is_read ? <Chip label="Unread" tone="coral" /> : null}
            </View>
            {n.message ? <Small muted={false}>{n.message}</Small> : null}
            <Small>{fmtDateTime(n.created_at)}</Small>
          </Card>
        ))}
      </QueryState>
    </Screen>
  );
}
