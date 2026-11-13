// Messages data (src/pages/patient/Messages.tsx): the same patient_messages rows, the same
// insert to send, and the same is_read update the doctor's page uses to mark as read.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { groupThreads, type Message, type Thread } from "@/shared/messages";
import { useSession } from "./session";
import { supabase } from "./supabase";

export interface Person { name: string; detail: string | null; first: string | null; last: string | null; photo: string | null }
export interface Conversations { threads: Thread[]; people: Record<string, Person> }

const messagesKey = (userId: string | null) => ["messages", userId] as const;

/** Everyone the patient has messages with, newest conversation first, with the doctors' names. */
export function useConversations() {
  const { userId } = useSession();
  const q = useQuery({
    queryKey: messagesKey(userId),
    enabled: !!userId,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<{ messages: Message[]; people: Record<string, Person> }> => {
      const { data, error } = await supabase.from("patient_messages")
        .select("id, from_user_id, to_user_id, body, created_at, is_read")
        .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      const messages = (data ?? []) as Message[];
      const others = [...new Set(messages.map((m) => (m.from_user_id === userId ? m.to_user_id : m.from_user_id)))];
      const people: Record<string, Person> = {};
      if (others.length) {
        // The website shows the start of the id; the app shows the doctor's name instead.
        const doctors = await supabase.from("doctors").select("user_id, first_name, last_name, specialty, profile_image_url").in("user_id", others);
        (doctors.data ?? []).forEach((d) => {
          if (d.user_id) people[d.user_id] = { name: `Dr. ${d.first_name} ${d.last_name}`, detail: d.specialty, first: d.first_name, last: d.last_name, photo: d.profile_image_url };
        });
      }
      return { messages, people };
    },
  });
  const data = q.data;
  const conversations = useMemo<Conversations | undefined>(
    () => (data && userId ? { threads: groupThreads(data.messages, userId), people: data.people } : undefined),
    [data, userId],
  );
  return { ...q, data: conversations };
}

export const personFor = (people: Record<string, Person> | undefined, id: string): Person =>
  people?.[id] ?? { name: "Your care team", detail: null, first: "C", last: "T", photo: null };

/** Same insert as the website; the database only allows it inside a care relationship. */
export function useSendMessage(otherId: string) {
  const { userId } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!userId) throw new Error("Not authenticated");
      const { error } = await supabase.from("patient_messages").insert({ from_user_id: userId, to_user_id: otherId, body });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}

export function useMarkMessagesRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { error } = await supabase.from("patient_messages").update({ is_read: true }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}
