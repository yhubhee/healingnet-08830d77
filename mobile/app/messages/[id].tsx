// One conversation (the chat pane of src/pages/patient/Messages.tsx). Newest at the bottom,
// live while open, messages to me are marked as read, and the box to type in stays above
// the keyboard.
import { ArrowLeft, MessageCircle, Send } from "@/components/icons";
import { router, useLocalSearchParams } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View, type ListRenderItem } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OfflineBar } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { EmptyState, IconButton, Small, Strong } from "@/components/ui";
import { useRealtime } from "@/lib/data";
import { personFor, useConversations, useMarkMessagesRead, useSendMessage } from "@/lib/messages";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { useSession } from "@/lib/session";
import { fmtDateTime } from "@/shared/dates";
import { friendlyError } from "@/shared/errors";
import { MAX_MESSAGE, MESSAGES_FALLBACK_MS, unreadIds, type Message } from "@/shared/messages";
import { fonts, MIN_TOUCH, radius, space, useTheme } from "@/theme";

const keyOf = (m: Message) => m.id;

const Bubble = memo(function Bubble({ m, mine }: { m: Message; mine: boolean }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${mine ? "You" : "Them"}: ${m.body}. ${fmtDateTime(m.created_at)}`}
      style={[styles.bubble, mine
        ? { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 6 }
        : { alignSelf: "flex-start", backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 6 }]}>
      <Text selectable style={{ fontFamily: fonts.regular, fontSize: 16, lineHeight: 23, color: mine ? colors.onPrimary : colors.text }}>{m.body}</Text>
      <Text style={{ fontFamily: fonts.regular, fontSize: 12, marginTop: 4, color: mine ? colors.onPrimary : colors.textMuted, opacity: mine ? 0.8 : 1 }}>{fmtDateTime(m.created_at)}</Text>
    </View>
  );
});

export default function Conversation() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const online = useOnline();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { userId } = useSession();
  const q = useConversations();
  const send = useSendMessage(id);
  const { mutate: markRead } = useMarkMessagesRead();
  const [draft, setDraft] = useState("");

  // Live while this screen is in front (Realtime). Only if that connection drops is the list
  // refreshed on a slow timer, until it is back.
  useRealtime("patient_messages", userId ? `to_user_id=eq.${userId}` : null, [["messages"]], true, MESSAGES_FALLBACK_MS);

  const thread = q.data?.threads.find((t) => t.otherId === id);
  const person = personFor(q.data?.people, id);
  // The list is drawn upside down so it opens on the newest message and stays there.
  const newestFirst = useMemo(() => [...(thread?.messages ?? [])].reverse(), [thread]);

  // Mark what was sent to me as read, now and whenever something new arrives while this is open.
  const unread = userId ? unreadIds(thread, userId).join(",") : "";
  useEffect(() => { if (unread && online) markRead(unread.split(",")); }, [unread, online, markRead]);

  const renderItem = useCallback<ListRenderItem<Message>>(({ item }) => <Bubble m={item} mine={item.from_user_id === userId} />, [userId]);

  async function submit() {
    const body = draft.trim();
    if (!body || send.isPending) return;
    try {
      await send.mutateAsync(body);
      setDraft("");
    } catch (e) {
      toast.error(`Message not sent. ${friendlyError(e)}`);
    }
  }

  const canSend = !!draft.trim() && online && !send.isPending;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <OfflineBar updatedAt={q.dataUpdatedAt || undefined} />
      <View style={styles.header}>
        <IconButton icon={ArrowLeft} label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/messages"))} />
        <View style={{ flex: 1 }}>
          <Strong numberOfLines={1} accessibilityRole="header">{person.name}</Strong>
          {person.detail ? <Small numberOfLines={1}>{person.detail}</Small> : null}
        </View>
      </View>

      <FlatList
        inverted={newestFirst.length > 0}
        data={newestFirst}
        keyExtractor={keyOf}
        renderItem={renderItem}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: space.lg, gap: space.sm, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={14}
        ListEmptyComponent={q.data ? <EmptyState icon={MessageCircle} title="No messages yet" text="Messages from this doctor will appear here." /> : undefined}
      />

      <View style={[styles.composer, { borderTopColor: colors.divider, paddingBottom: insets.bottom + space.sm, backgroundColor: colors.background }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={online ? "Type a message" : "You're offline"}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={`Message to ${person.name}`}
          accessibilityHint={online ? undefined : OFFLINE_ACTION}
          editable={online}
          multiline
          maxLength={MAX_MESSAGE}
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Send message" accessibilityState={{ disabled: !canSend, busy: send.isPending }}
          disabled={!canSend} onPress={submit}
          style={[styles.send, { backgroundColor: colors.primary, opacity: canSend ? 1 : 0.4 }]}>
          <Send size={22} color={colors.onPrimary} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", minHeight: 56, paddingHorizontal: space.md, gap: space.xs },
  bubble: { maxWidth: "82%", borderRadius: 20, paddingHorizontal: space.lg, paddingVertical: space.sm + 2 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm, borderTopWidth: 1 },
  input: {
    flex: 1, minHeight: MIN_TOUCH + 4, maxHeight: 140, borderWidth: 1, borderRadius: radius.input,
    paddingHorizontal: space.lg, paddingVertical: space.md, fontFamily: fonts.regular, fontSize: 16, textAlignVertical: "center",
  },
  send: { width: MIN_TOUCH + 4, height: MIN_TOUCH + 4, borderRadius: radius.button, alignItems: "center", justifyContent: "center" },
});
