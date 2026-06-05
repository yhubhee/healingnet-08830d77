import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useEffect, useState, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDoctor, useDoctorPatients } from "@/hooks/useDoctor";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, Loader2, MessageSquare, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSearchParams } from "react-router-dom";

export default function DoctorMessages() {
  const { data: ctx } = useDoctor();
  const userId = ctx?.user?.id;
  const { data: patients = [] } = useDoctorPatients(ctx?.doctor?.id);
  const [search] = useSearchParams();
  const initialTo = search.get("to");
  const [activeUserId, setActiveUserId] = useState<string | null>(initialTo);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const qc = useQueryClient();
  const endRef = useRef<HTMLDivElement>(null);

  const patientByUserId = useMemo(() => {
    const map = new Map<string, any>();
    (patients as any[]).forEach((p) => p.user_id && map.set(p.user_id, p));
    return map;
  }, [patients]);

  const { data: threads = [] } = useQuery({
    enabled: !!userId,
    queryKey: ["doctor", "msg-threads", userId],
    refetchInterval: 10000,
    queryFn: async () => {
      const { data } = await supabase.from("patient_messages")
        .select("*").or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
        .order("created_at", { ascending: false }).limit(200);
      const map = new Map<string, any>();
      (data || []).forEach((m: any) => {
        const other = m.from_user_id === userId ? m.to_user_id : m.from_user_id;
        if (!map.has(other)) map.set(other, { other_user_id: other, last: m, unread: 0 });
        if (m.to_user_id === userId && !m.is_read) map.get(other).unread++;
      });
      return Array.from(map.values());
    },
  });

  const { data: messages = [] } = useQuery({
    enabled: !!userId && !!activeUserId,
    queryKey: ["doctor", "msg-thread", userId, activeUserId],
    refetchInterval: 5000,
    queryFn: async () => {
      const { data } = await supabase.from("patient_messages").select("*")
        .or(`and(from_user_id.eq.${userId},to_user_id.eq.${activeUserId}),and(from_user_id.eq.${activeUserId},to_user_id.eq.${userId})`)
        .order("created_at");
      // mark received as read
      const unreadIds = (data || []).filter((m: any) => m.to_user_id === userId && !m.is_read).map((m: any) => m.id);
      if (unreadIds.length) {
        await supabase.from("patient_messages").update({ is_read: true }).in("id", unreadIds);
        qc.invalidateQueries({ queryKey: ["doctor", "msg-threads"] });
        qc.invalidateQueries({ queryKey: ["doctor", "badges"] });
      }
      return data || [];
    },
  });

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send() {
    if (!draft.trim() || !activeUserId || !userId) return;
    setSending(true);
    const { error } = await supabase.from("patient_messages").insert({ from_user_id: userId, to_user_id: activeUserId, body: draft });
    setSending(false);
    if (error) return;
    setDraft("");
    qc.invalidateQueries({ queryKey: ["doctor", "msg-thread"] });
    qc.invalidateQueries({ queryKey: ["doctor", "msg-threads"] });
  }

  const filteredPatients = (patients as any[]).filter((p) => p.user_id && `${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <DoctorLayout>
      <div className="mb-4"><h1 className="text-2xl font-heading font-bold">Messages</h1></div>
      <div className="grid lg:grid-cols-[280px_1fr] gap-4 h-[calc(100vh-180px)]">
        <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          <div className="p-2 border-b border-border relative">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="New message to..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex-1 overflow-auto">
            {q && filteredPatients.length > 0 && (
              <div className="p-2 border-b border-border">
                <div className="text-xs text-muted-foreground px-2 pb-1">Start a chat</div>
                {filteredPatients.slice(0, 6).map((p) => (
                  <button key={p.id} onClick={() => { setActiveUserId(p.user_id); setQ(""); }}
                    className="w-full text-left px-2 py-2 rounded-lg hover:bg-muted/30 text-sm">{p.first_name} {p.last_name}</button>
                ))}
              </div>
            )}
            {threads.length === 0 ? <div className="p-6 text-center text-sm text-muted-foreground">No conversations yet.</div> :
              threads.map((t: any) => {
                const p = patientByUserId.get(t.other_user_id);
                const name = p ? `${p.first_name} ${p.last_name}` : "Patient";
                return (
                  <button key={t.other_user_id} onClick={() => setActiveUserId(t.other_user_id)}
                    className={cn("w-full text-left px-3 py-3 border-b border-border flex gap-3 items-start hover:bg-muted/30", activeUserId === t.other_user_id && "bg-muted/40")}>
                    <div className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-sm shrink-0">{name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2"><span className="text-sm font-medium truncate">{name}</span>{t.unread > 0 && <span className="bg-primary text-primary-foreground text-xs rounded-full px-1.5">{t.unread}</span>}</div>
                      <div className="text-xs text-muted-foreground truncate">{t.last.body}</div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl flex flex-col overflow-hidden">
          {!activeUserId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-2"><MessageSquare className="w-10 h-10" /><span className="text-sm">Pick a conversation</span></div>
          ) : (
            <>
              <div className="px-4 py-3 border-b border-border font-medium text-sm">
                {(() => { const p = patientByUserId.get(activeUserId); return p ? `${p.first_name} ${p.last_name}` : "Patient"; })()}
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-2">
                {messages.length === 0 && <div className="text-center text-sm text-muted-foreground">Say hello 👋</div>}
                {messages.map((m: any) => (
                  <div key={m.id} className={cn("flex", m.from_user_id === userId ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[75%] px-3 py-2 rounded-2xl text-sm", m.from_user_id === userId ? "bg-primary text-primary-foreground" : "bg-muted")}>{m.body}</div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="border-t border-border p-3 flex gap-2">
                <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message..." />
                <Button onClick={send} disabled={sending || !draft.trim()}>{sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}</Button>
              </div>
            </>
          )}
        </div>
      </div>
    </DoctorLayout>
  );
}
