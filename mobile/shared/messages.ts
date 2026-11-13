// Messages (src/pages/patient/Messages.tsx): grouping the patient_messages rows into one
// conversation per person, newest conversation first.

export interface Message {
  id: string;
  from_user_id: string;
  to_user_id: string;
  body: string;
  created_at: string;
  is_read: boolean | null;
}

export interface Thread {
  /** The other person's user id. */
  otherId: string;
  last: Message;
  /** Messages to me that I haven't opened yet. */
  unread: number;
  /** Oldest first. */
  messages: Message[];
}

export function groupThreads(messages: Message[], me: string): Thread[] {
  const byOther = new Map<string, Thread>();
  [...messages].sort((a, b) => a.created_at.localeCompare(b.created_at)).forEach((m) => {
    const otherId = m.from_user_id === me ? m.to_user_id : m.from_user_id;
    const t = byOther.get(otherId) ?? { otherId, last: m, unread: 0, messages: [] };
    t.messages.push(m);
    t.last = m;
    if (m.to_user_id === me && !m.is_read) t.unread++;
    byOther.set(otherId, t);
  });
  return [...byOther.values()].sort((a, b) => b.last.created_at.localeCompare(a.last.created_at));
}

/** Ids of the messages in a thread that were sent to me and are still unread. */
export const unreadIds = (thread: Pick<Thread, "messages"> | undefined, me: string): string[] =>
  (thread?.messages ?? []).filter((m) => m.to_user_id === me && !m.is_read).map((m) => m.id);

/** Website wording when there is nothing yet. Patients can't start a conversation; the doctor does. */
export const NO_MESSAGES_TITLE = "No conversations yet";
export const NO_MESSAGES_TEXT = "Your doctors will message you here. When a doctor you have seen writes to you, the conversation appears and you can reply.";
export const MAX_MESSAGE = 2000;
