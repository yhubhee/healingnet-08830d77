import { PatientLayout } from "@/layouts/PatientLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Send, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Msg { id: string; from_user_id: string; to_user_id: string; body: string; created_at: string; is_read: boolean; subject?: string | null }

export default function PatientMessages() {
  const [me, setMe] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [activeWith, setActiveWith] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setMe(user.id);
    const { data } = await supabase.from("patient_messages").select("*").or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`).order("created_at", { ascending: true });
    setMessages((data || []) as Msg[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Group by counterpart
  const threads = messages.reduce<Record<string, Msg[]>>((acc, m) => {
    const other = m.from_user_id === me ? m.to_user_id : m.from_user_id;
    (acc[other] = acc[other] || []).push(m);
    return acc;
  }, {});
  const counterparts = Object.keys(threads);
  const active = activeWith && threads[activeWith] ? threads[activeWith] : [];

  async function send() {
    if (!draft.trim() || !activeWith || !me) return;
    setSending(true);
    const { error } = await supabase.from("patient_messages").insert({ from_user_id: me, to_user_id: activeWith, body: draft.trim() });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setDraft("");
    load();
  }

  return (
    <PatientLayout>
      <div className="mb-4">
        <h1 className="text-2xl font-heading font-bold">Messages</h1>
        <p className="text-muted-foreground text-sm">Chat securely with your care team</p>
      </div>

      {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        counterparts.length === 0 ? <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm"><MessageSquare className="w-10 h-10 mx-auto mb-2" />No conversations yet. Your doctors will message you here.</div> :
        <div className="bg-card border border-border rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr] h-[calc(100vh-220px)]">
          <aside className="border-r border-border overflow-y-auto">
            {counterparts.map((id) => {
              const last = threads[id][threads[id].length - 1];
              return (
                <button key={id} onClick={() => setActiveWith(id)} className={cn("w-full text-left p-3 border-b border-border hover:bg-muted/20", activeWith === id && "bg-muted/30")}>
                  <div className="font-medium text-sm truncate">{id.slice(0, 8)}…</div>
                  <div className="text-xs text-muted-foreground truncate">{last.body}</div>
                </button>
              );
            })}
          </aside>

          <section className="flex flex-col">
            {!activeWith ? <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">Select a conversation</div> :
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
                  {active.map((m) => (
                    <div key={m.id} className={cn("flex", m.from_user_id === me ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[75%] rounded-2xl px-4 py-2", m.from_user_id === me ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm")}>
                        <p className="text-sm">{m.body}</p>
                        <p className={cn("text-[10px] mt-1", m.from_user_id === me ? "text-primary-foreground/70" : "text-muted-foreground")}>{new Date(m.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 border-t border-border flex items-center gap-2">
                  <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Type a message..." className="flex-1 px-3 py-2 bg-muted/30 rounded-lg text-sm outline-none" />
                  <button disabled={sending} onClick={send} className="bg-primary text-primary-foreground p-2 rounded-lg hover:bg-primary/90 disabled:opacity-50"><Send className="w-4 h-4" /></button>
                </div>
              </>}
          </section>
        </div>}
    </PatientLayout>
  );
}
