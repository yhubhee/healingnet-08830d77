import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, PhoneOff, Circle, FileText, ChevronLeft } from "lucide-react";

type Mode = "consultation" | "appointment";

export default function VideoConsult() {
  const { id } = useParams<{ id: string }>();
  const [sp] = useSearchParams();
  const mode: Mode = (sp.get("mode") as Mode) || "consultation";
  const nav = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const callRef = useRef<DailyCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState(false);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [record_, setJoined] = useState(false);
  const [meta, setMeta] = useState<any>(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!id) throw new Error("No id");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { nav("/login"); return; }

        const table = mode === "consultation" ? "consultation_requests" : "patient_appointments";
        const sel = mode === "consultation"
          ? "*, patients(first_name,last_name,user_id), doctors(first_name,last_name,user_id)"
          : "*, patients(first_name,last_name,user_id), doctors(first_name,last_name,user_id)";
        const { data: row, error } = await supabase.from(table as any).select(sel).eq("id", id).maybeSingle();
        if (error || !row) throw new Error(error?.message || "Not found");
        if (!mounted) return;
        setMeta(row);
        setNotes((row as any).doctor_notes || (row as any).notes || "");

        const owner = (row as any).doctors?.user_id === user.id;
        setIsOwner(owner);
        const userName = owner
          ? `Dr. ${(row as any).doctors?.first_name || ""} ${(row as any).doctors?.last_name || ""}`.trim()
          : `${(row as any).patients?.first_name || "Patient"} ${(row as any).patients?.last_name || ""}`.trim();

        let roomUrl = (row as any).meeting_link;
        let roomName = (row as any).daily_room_name;

        // Create room on the fly if missing or non-Daily
        if (!roomUrl || !roomUrl.includes("daily.co")) {
          const { data: created, error: cErr } = await supabase.functions.invoke("daily-room", {
            body: { action: "create", [mode === "consultation" ? "consultation_id" : "appointment_id"]: id },
          });
          if (cErr || created?.error) throw new Error(cErr?.message || created?.error);
          roomUrl = created.room_url; roomName = created.room_name;
        }

        const { data: tok, error: tErr } = await supabase.functions.invoke("daily-room", {
          body: { action: "token", room_name: roomName, user_name: userName, is_owner: owner },
        });
        if (tErr || tok?.error) throw new Error(tErr?.message || tok?.error);

        const call = DailyIframe.createFrame(containerRef.current!, {
          iframeStyle: { width: "100%", height: "100%", border: "0", borderRadius: "12px" },
          showLeaveButton: true,
          showFullscreenButton: true,
        });
        callRef.current = call;
        call.on("left-meeting", () => leave());
        call.on("joined-meeting", () => {
          setJoined(true);
          // mark call start
          supabase.from(table as any).update({ call_started_at: new Date().toISOString() }).eq("id", id);
        });
        call.on("recording-started", () => setRecord(true));
        call.on("recording-stopped", () => setRecord(false));

        await call.join({ url: roomUrl, token: tok.token });
        if (mounted) setLoading(false);
      } catch (e: any) {
        toast.error(e?.message || "Failed to join");
        setLoading(false);
      }
    })();
    return () => { mounted = false; callRef.current?.destroy(); };
  }, [id, mode]);

  async function toggleRecording() {
    const call = callRef.current; if (!call) return;
    try {
      if (record) await call.stopRecording(); else await call.startRecording();
    } catch (e: any) { toast.error(e?.message || "Recording error"); }
  }

  async function saveNotes() {
    if (!id) return;
    setSavingNotes(true);
    const table = mode === "consultation" ? "consultation_requests" : "patient_appointments";
    const field = mode === "consultation" ? "doctor_notes" : "notes";
    const { error } = await supabase.from(table as any).update({ [field]: notes }).eq("id", id);
    setSavingNotes(false);
    if (error) toast.error(error.message); else toast.success("Notes saved");
  }

  async function leave() {
    const table = mode === "consultation" ? "consultation_requests" : "patient_appointments";
    if (id) await supabase.from(table as any).update({ call_ended_at: new Date().toISOString() }).eq("id", id);
    if (isOwner) await saveNotes();
    nav(-1);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => nav(-1)}><ChevronLeft className="w-4 h-4" />Back</Button>
        <div className="flex-1 min-w-0">
          <div className="font-heading font-bold truncate">
            {meta?.patients ? `${meta.patients.first_name} ${meta.patients.last_name}` : "Video Consultation"}
          </div>
          <div className="text-xs text-muted-foreground truncate">{meta?.reason || meta?.specialty_needed || ""}</div>
        </div>
        {isOwner && (
          <Button size="sm" variant={record ? "destructive" : "outline"} onClick={toggleRecording}>
            <Circle className={`w-3 h-3 ${record ? "fill-current animate-pulse" : ""}`} />
            {record ? "Stop recording" : "Record"}
          </Button>
        )}
        <Button size="sm" variant="destructive" onClick={leave}><PhoneOff className="w-4 h-4" />End</Button>
      </header>

      <div className="flex-1 grid lg:grid-cols-[1fr_360px] gap-3 p-3">
        <div className="relative bg-card rounded-xl overflow-hidden min-h-[60vh]">
          {loading && <div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}
          <div ref={containerRef} className="w-full h-full min-h-[60vh]" />
        </div>

        {isOwner && (
          <aside className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 max-h-[calc(100vh-100px)] overflow-y-auto">
            <div className="flex items-center gap-2 font-heading font-bold"><FileText className="w-4 h-4 text-primary" />Consultation notes</div>
            <Textarea rows={16} className="flex-1 resize-none" placeholder="Subjective, objective, assessment, plan..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button size="sm" onClick={saveNotes} disabled={savingNotes}>{savingNotes ? "Saving..." : "Save notes"}</Button>
            <div className="text-[11px] text-muted-foreground">Notes auto-save when you end the call.</div>
          </aside>
        )}
      </div>
    </div>
  );
}
