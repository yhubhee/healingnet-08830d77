// Messages (src/pages/patient/Messages.tsx): one row per conversation with who it is, the
// last message and how many are unread. Tapping a row opens the chat.
import { MessageCircle } from "@/components/icons";
import { router } from "expo-router";
import { memo, useCallback } from "react";
import { View, type ListRenderItem } from "react-native";
import { Avatar } from "@/components/Avatar";
import { loadState } from "@/components/QueryState";
import { ListScreen } from "@/components/Screen";
import { Card, Chip, EmptyState, ErrorState, ListSkeleton, Small, Strong } from "@/components/ui";
import { usePollWhileFocused, useRealtime } from "@/lib/data";
import { useOnline } from "@/lib/net";
import { personFor, useConversations, type Person } from "@/lib/messages";
import { useSession } from "@/lib/session";
import { timeAgo } from "@/shared/dates";
import { friendlyError } from "@/shared/errors";
import { NO_MESSAGES_TEXT, NO_MESSAGES_TITLE, type Thread } from "@/shared/messages";
import { space } from "@/theme";

const keyOf = (t: Thread) => t.otherId;

const ThreadRow = memo(function ThreadRow({ thread, person, mine }: { thread: Thread; person: Person; mine: boolean }) {
  const unread = thread.unread;
  return (
    <Card onPress={() => router.push(`/messages/${thread.otherId}`)}
      accessibilityLabel={`${person.name}. ${unread ? `${unread} unread. ` : ""}${mine ? "You: " : ""}${thread.last.body}`}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Avatar url={person.photo} first={person.first} last={person.last} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
            <Strong style={{ flex: 1 }} numberOfLines={1}>{person.name}</Strong>
            <Small>{timeAgo(thread.last.created_at)}</Small>
          </View>
          <Small muted={!unread} numberOfLines={2}>{mine ? "You: " : ""}{thread.last.body}</Small>
          {/* The dot is always paired with words, so it does not rely on colour. */}
          {unread ? <Chip label={`● ${unread} new`} tone="coral" /> : null}
        </View>
      </View>
    </Card>
  );
});

export default function Messages() {
  const { userId } = useSession();
  const online = useOnline();
  const q = useConversations();
  // Live while this tab is in front. patient_messages is not in the Realtime publication
  // yet, so the list is also checked every 10 seconds, as the website's doctor page does.
  useRealtime("patient_messages", userId ? `to_user_id=eq.${userId}` : null, [["messages"]]);
  usePollWhileFocused(["messages"], 10_000, online);

  const people = q.data?.people;
  const renderItem = useCallback<ListRenderItem<Thread>>(({ item }) => (
    <ThreadRow thread={item} person={personFor(people, item.otherId)} mine={item.last.from_user_id === userId} />
  ), [people, userId]);

  const state = loadState(q);
  const empty = state === "loading" ? <ListSkeleton />
    : state !== "ready" ? <ErrorState offline={state === "offline"} message={friendlyError(q.error)} onRetry={() => q.refetch()} />
    : <EmptyState icon={MessageCircle} title={NO_MESSAGES_TITLE} text={NO_MESSAGES_TEXT} actionLabel="Book a doctor" onAction={() => router.push("/book")} />;

  return (
    <ListScreen tab title="Messages" data={q.data?.threads ?? []} keyExtractor={keyOf} renderItem={renderItem} empty={empty}
      header={q.data?.threads.length ? <Small>Chat securely with your care team.</Small> : null}
      onRefresh={() => q.refetch()} refreshing={q.isRefetching} />
  );
}
