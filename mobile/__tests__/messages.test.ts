import { groupThreads, unreadIds, type Message } from "../shared/messages";

const msg = (id: string, from: string, to: string, at: string, read = false): Message =>
  ({ id, from_user_id: from, to_user_id: to, body: `body ${id}`, created_at: at, is_read: read });

describe("conversations", () => {
  const me = "me";
  const all = [
    msg("1", "docA", me, "2026-11-01T10:00:00Z", true),
    msg("2", me, "docA", "2026-11-01T10:05:00Z"),
    msg("3", "docB", me, "2026-11-02T09:00:00Z"),
    msg("4", "docB", me, "2026-11-02T09:01:00Z"),
    msg("5", "docA", me, "2026-11-03T08:00:00Z"),
  ];

  it("makes one conversation per person, newest first, messages oldest first", () => {
    const threads = groupThreads([...all].reverse(), me);
    expect(threads.map((t) => t.otherId)).toEqual(["docA", "docB"]);
    expect(threads[0].messages.map((m) => m.id)).toEqual(["1", "2", "5"]);
    expect(threads[0].last.id).toBe("5");
  });

  it("counts only messages sent to me that I haven't read", () => {
    const [a, b] = groupThreads(all, me);
    expect(a.unread).toBe(1); // my own unread message to the doctor does not count
    expect(b.unread).toBe(2);
    expect(unreadIds(b, me)).toEqual(["3", "4"]);
    expect(unreadIds(undefined, me)).toEqual([]);
  });

  it("handles no messages", () => {
    expect(groupThreads([], me)).toEqual([]);
  });
});
