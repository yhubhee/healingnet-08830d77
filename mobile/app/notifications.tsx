// Notifications (src/components/common/UserNotificationsList.tsx): read and unread, tap
// to open the matching screen, mark all read.
import { Bell, CheckCheck } from "@/components/icons";
import { router } from "expo-router";
import { memo, useCallback } from "react";
import { View, type ListRenderItem } from "react-native";
import { loadState } from "@/components/QueryState";
import { ListScreen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Chip, EmptyState, ErrorState, ListSkeleton, Small, Strong } from "@/components/ui";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications, useRealtime, type UserNotification } from "@/lib/data";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { useSession } from "@/lib/session";
import { fmtDateTime } from "@/shared/dates";
import { friendlyError } from "@/shared/errors";
import { screenForUrl } from "@/shared/links";
import { space, useTheme } from "@/theme";

const keyOf = (n: UserNotification) => n.id;

const NotificationCard = memo(function NotificationCard({ n, onOpen }: { n: UserNotification; onOpen: (n: UserNotification) => void }) {
  const { colors } = useTheme();
  return (
    <Card accessibilityLabel={`${n.is_read ? "" : "Unread. "}${n.title}. ${n.message ?? ""}`}
      style={{ gap: 4, borderColor: n.is_read ? colors.border : colors.primaryText, backgroundColor: n.is_read ? colors.card : colors.primarySoft }}
      onPress={() => onOpen(n)}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <Strong style={{ flex: 1 }}>{n.title}</Strong>
        {!n.is_read ? <Chip label="Unread" tone="coral" /> : null}
      </View>
      {n.message ? <Small muted={false}>{n.message}</Small> : null}
      <Small>{fmtDateTime(n.created_at)}</Small>
    </Card>
  );
});

export default function Notifications() {
  const toast = useToast();
  const online = useOnline();
  const { userId } = useSession();
  const q = useNotifications();
  const { mutate: markRead } = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  useRealtime("user_notifications", userId ? `user_id=eq.${userId}` : null, [["notifications"], ["home-summary"]]);

  const list = q.data ?? [];
  const unread = list.filter((n) => !n.is_read).length;
  const open = useCallback((n: UserNotification) => {
    if (!n.is_read && online) markRead(n.id);
    router.navigate(screenForUrl(n.action_url));
  }, [online, markRead]);
  const renderItem = useCallback<ListRenderItem<UserNotification>>(({ item }) => <NotificationCard n={item} onOpen={open} />, [open]);

  const state = loadState(q);
  const header = (
    <View style={{ gap: space.sm }}>
      <Body muted>{unread > 0 ? `${unread} unread` : "You're all caught up"}</Body>
      <Button small variant="secondary" icon={CheckCheck} label="Mark all read" loading={markAll.isPending}
        disabled={unread === 0 || !online} disabledReason={!online ? OFFLINE_ACTION : "Nothing is unread"}
        onPress={() => markAll.mutate(undefined, { onError: (e) => toast.error(friendlyError(e)) })} />
    </View>
  );
  const empty = state === "loading" ? <ListSkeleton />
    : state !== "ready" ? <ErrorState offline={state === "offline"} message={friendlyError(q.error)} onRetry={() => q.refetch()} />
    : <EmptyState icon={Bell} title="No notifications yet" text="Updates about your visits and prescriptions appear here." actionLabel="Go to Home" onAction={() => router.replace("/(tabs)")} />;

  return (
    <ListScreen title="Notifications" back data={list} keyExtractor={keyOf} renderItem={renderItem} header={header} empty={empty}
      onRefresh={() => q.refetch()} refreshing={q.isRefetching} />
  );
}
