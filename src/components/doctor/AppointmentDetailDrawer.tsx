import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calendar, Clock, User, CheckCircle2, XCircle, Loader2, Play, MessageSquare, Video, ExternalLink } from "lucide-react";
import { NewPrescriptionDialog } from "./NewPrescriptionDialog";
import { OrderLabTestDialog } from "./OrderLabTestDialog";

export function AppointmentDetailDrawer({ appointment, onClose }: { appointment: any | null; onClose: () => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  if (!appointment) return null;
  const a = appointment;
  const p = a.patients;
  const isTelemedicine = a.is_telemedicine === true;

  async function update(patch: any, msg: string) {
    setSaving(true);
    const { error } = await supabase.from("patient_appointments").update(patch).eq("id", a.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["doctor", "appointments"] });
    qc.invalidateQueries({ queryKey: ["doctor", "dashboard"] });
    onClose();
  }

  async function startCall() {
    if (!a.meeting_link) {
      toast.error("No video room created for this appointment");
      return;
    }
    // Record call start time
    await supabase
      .from("patient_appointments")
      .update({ call_started_at: new Date().toISOString() })
      .eq("id", a.id);
    window.open(a.meeting_link, "_blank");
  }

  async function completeCall() {
    if (!note.trim()) {
      toast.error("Please add consultation notes");
      return;
    }
    await update(
      {
        status: "completed",
        call_ended_at: new Date().toISOString(),
        consultation_notes: note,
      },
      "Consultation completed"
    );
  }

  return (
    <Sheet open={!!appointment} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader><SheetTitle>Appointment</SheetTitle></SheetHeader>
        <div className="mt-5 space-y-4">
          <div className="bg-muted/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><User className="w-4 h-4 text-primary" /><span className="font-medium">{p ? `${p.first_name} ${p.last_name}` : "Patient"}</span></div>
            <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(a.requested_date).toDateString()}</span>
              {a.requested_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{a.requested_time}</span>}
              {isTelemedicine && <span className="flex items-center gap-1"><Video className="w-3.5 h-3.5" />Online</span>}
            </div>
          </div>

          {a.reason && (<div><div className="text-xs text-muted-foreground mb-1">Reason</div><p className="text-sm">{a.reason}</p></div>)}
          {a.notes && (<div><div className="text-xs text-muted-foreground mb-1">Notes</div><p className="text-sm">{a.notes}</p></div>)}

          <div className="text-xs">Current status: <span className="capitalize font-medium">{a.status}</span></div>

          <Textarea placeholder="Add a note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />

          <div className="space-y-2">
            {a.status === "pending" && (
              <div className="grid grid-cols-2 gap-2">
                <Button disabled={saving} onClick={() => update({ status: "accepted" }, "Accepted")} className="bg-success text-success-foreground hover:bg-success/90"><CheckCircle2 className="w-4 h-4" />Accept</Button>
                <Button disabled={saving} variant="outline" onClick={() => update({ status: "cancelled" }, "Declined")}><XCircle className="w-4 h-4" />Decline</Button>
              </div>
            )}
            {a.status === "accepted" && isTelemedicine && (
              <>
                <Button disabled={saving} onClick={startCall} className="w-full"><Video className="w-4 h-4" />Join video call</Button>
                <Textarea placeholder="Add consultation summary..." value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
                <Button disabled={saving || !note.trim()} onClick={completeCall} className="w-full bg-success text-success-foreground hover:bg-success/90"><CheckCircle2 className="w-4 h-4" />Complete consultation</Button>
                <Button disabled={saving} variant="outline" className="w-full" onClick={() => update({ status: "cancelled" }, "Cancelled")}>Cancel appointment</Button>
              </>
            )}
            {a.status === "accepted" && !isTelemedicine && (
              <>
                <Button disabled={saving} onClick={() => update({ status: "completed" }, "Completed")} className="w-full"><Play className="w-4 h-4" />Complete consultation</Button>
                <div className="grid grid-cols-2 gap-2">
                  <NewPrescriptionDialog patientId={a.patient_id} trigger={<Button variant="outline">+ Rx</Button>} />
                  <OrderLabTestDialog patientId={a.patient_id} trigger={<Button variant="outline">+ Lab</Button>} />
                </div>
                <Button disabled={saving} variant="outline" className="w-full" onClick={() => update({ status: "cancelled" }, "Cancelled")}>Cancel appointment</Button>
              </>
            )}
            {a.status === "completed" && a.consultation_notes && (
              <div className="p-3 bg-muted/30 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Consultation Summary</div>
                <p className="text-sm">{a.consultation_notes}</p>
              </div>
            )}
            {p?.user_id && (
              <a href={`/doctor/messages?to=${p.user_id}`} className="block">
                <Button variant="outline" className="w-full"><MessageSquare className="w-4 h-4" />Message patient</Button>
              </a>
            )}
            {saving && <div className="text-xs text-muted-foreground flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" />Saving…</div>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
