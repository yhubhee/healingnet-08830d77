import { PatientLayout } from "@/layouts/PatientLayout";
import { useState } from "react";
import { mockMessageThreads } from "@/lib/mockData";
import { Send, Paperclip, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PatientMessages() {
  const [activeId, setActiveId] = useState(mockMessageThreads[0].id);
  const active = mockMessageThreads.find((t) => t.id === activeId)!;
  const [draft, setDraft] = useState("");

  return (
    <PatientLayout>
      <div className="mb-4">
        <h1 className="text-2xl font-heading font-bold">Messages</h1>
        <p className="text-muted-foreground text-sm">Chat securely with your care team</p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-[300px_1fr] h-[calc(100vh-220px)]">
        <aside className="border-r border-border flex flex-col">
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input placeholder="Search conversations" className="w-full pl-9 pr-3 py-2 bg-muted/30 rounded-lg text-sm outline-none" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {mockMessageThreads.map((t) => (
              <button key={t.id} onClick={() => setActiveId(t.id)} className={cn("w-full text-left p-3 border-b border-border hover:bg-muted/20 flex gap-3", activeId === t.id && "bg-muted/30")}>
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-info flex items-center justify-center text-primary-foreground font-bold">{t.with[0]}</div>
                  {t.online && <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-success border-2 border-card" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between"><span className="font-medium text-sm truncate">{t.with}</span><span className="text-xs text-muted-foreground">{t.time}</span></div>
                  <div className="text-xs text-muted-foreground truncate">{t.lastMessage}</div>
                </div>
                {t.unread > 0 && <span className="bg-primary text-primary-foreground text-xs rounded-full w-5 h-5 flex items-center justify-center self-center">{t.unread}</span>}
              </button>
            ))}
          </div>
        </aside>

        <section className="flex flex-col">
          <div className="p-3 border-b border-border flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-info flex items-center justify-center text-primary-foreground font-bold">{active.with[0]}</div>
            <div><div className="font-medium text-sm">{active.with}</div><div className="text-xs text-muted-foreground">{active.role} {active.online && "• Online"}</div></div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/10">
            {active.messages.map((m, i) => (
              <div key={i} className={cn("flex", m.from === "me" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[75%] rounded-2xl px-4 py-2", m.from === "me" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm")}>
                  <p className="text-sm">{m.body}</p>
                  <p className={cn("text-[10px] mt-1", m.from === "me" ? "text-primary-foreground/70" : "text-muted-foreground")}>{m.time}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="p-3 border-t border-border flex items-center gap-2">
            <button className="p-2 hover:bg-muted/30 rounded-lg"><Paperclip className="w-4 h-4 text-muted-foreground" /></button>
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a message..." className="flex-1 px-3 py-2 bg-muted/30 rounded-lg text-sm outline-none" />
            <button className="bg-primary text-primary-foreground p-2 rounded-lg hover:bg-primary/90"><Send className="w-4 h-4" /></button>
          </div>
        </section>
      </div>
    </PatientLayout>
  );
}
