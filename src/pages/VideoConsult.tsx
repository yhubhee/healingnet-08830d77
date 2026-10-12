import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import DailyIframe, { DailyCall } from "@daily-co/daily-js";
import { getMyDoctorId } from "@/lib/roles";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, PhoneOff, Circle, FileText, ChevronLeft } from "lucide-react";

const CALL_NOT_AVAILABLE = "The video call opens once the doctor has accepted the appointment.";

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
  const endedRef = useRef(false);
  const tokenRef = useRef<string | null>(null);
  const callKind = mode === "consultation" ? "consultation_request" : "appointment";

  // Mark the call as ended (once). The database only sets it if the call had started.
  async function endCall() {
    if (!id || endedRef.current) return;
    endedRef.current = true;
    try { await supabase.rpc("end_call", { _kind: callKind, _id: id }); } catch { /* best effort */ }
  }

  // Best effort when the tab is closed: a keepalive request outlives the page.
  useEffect(() => {
    function onPageHide() {
      if (!id || endedRef.current || !tokenRef.current) return;
      endedRef.current = true;
      try {
        fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/end_call`, {
          method: "POST",
          keepalive: true,
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${tokenRef.current}`,
          },
          body: JSON.stringify({ _kind: callKind, _id: id }),
        }).catch(() => {});
      } catch { /* best effort */ }
    }
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [id, callKind]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!id) throw new Error("No id");
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { nav("/login"); return; }

        const table = mode === "consultation" ? "consultation_requests" : "patient_appointments";
        const sel = "*, patients(first_name,last_name), doctors(first_name,last_name)";
        const { data: row, error } = await supabase.from(table as any).select(sel).eq("id", id).maybeSingle();
        if (error || !row) throw new Error("We couldn't find this video call.");
        if (!mounted) return;
        setMeta(row);
        setNotes((row as any).doctor_notes || (row as any).notes || "");

        setIsOwner((await getMyDoctorId()) === (row as any).doctor_id);

        // One call: the server creates the room on first join and decides who owns it.
        const { data: join, error: jErr } = await supabase.functions.invoke("daily-room", {
          body: { kind: mode === "consultation" ? "consultation_request" : "appointment", id },
        });
        if (jErr || !join?.url || !join?.token) {
          const status = (jErr as any)?.context?.status;
          if (status === 403) throw new Error(CALL_NOT_AVAILABLE);
          throw new Error("We couldn't start the video call. Please try again.");
        }

        const call = DailyIframe.createFrame(containerRef.current!, {
          iframeStyle: { width: "100%", height: "100%", border: "0", borderRadius: "12px" },
          showLeaveButton: true,
          showFullscreenButton: true,
        });
        callRef.current = call;
        call.on("left-meeting", () => leave());
        call.on("joined-meeting", () => setJoined(true));
        call.on("recording-started", () => setRecord(true));
        call.on("recording-stopped", () => setRecord(false));

        await call.join({ url: join.url, token: join.token });
        tokenRef.current = (await supabase.auth.getSession()).data.session?.access_token ?? null;
        if (mounted) setLoading(false);
      } catch (e: any) {
        toast.error(e?.message || "We couldn't join the video call.");
        setLoading(false);
      }
    })();
    return () => { mounted = false; callRef.current?.destroy(); };
  }, [id, mode]);

  async function toggleRecording() {
    const call = callRef.current; if (!call) return;
    try {
      if (record) await call.stopRecording(); else await call.startRecording();
    } catch { toast.error("Recording could not be changed."); }
  }

  async function saveNotes() {
    if (!id) return;
    setSavingNotes(true);
    const table = mode === "consultation" ? "consultation_requests" : "patient_appointments";
    const field = mode === "consultation" ? "doctor_notes" : "notes";
    const { error } = await supabase.from(table as any).update({ [field]: notes }).eq("id", id);
    setSavingNotes(false);
    if (error) toast.error("We couldn't save the notes. Please try again."); else toast.success("Notes saved");
  }

  async function leave() {
    if (isOwner) await saveNotes();
    await endCall();
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
