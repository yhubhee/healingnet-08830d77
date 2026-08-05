import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Video, FileText, MessageSquare, Loader2, CheckCircle2, XCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useDoctor } from "@/hooks/useDoctor";
import { useInitializeConsultationPayment, useCompleteConsultationTransfer, useConsultationPaymentStatus } from "@/hooks/useConsultationPayment";
import { JoinCallButton } from "@/components/JoinCallButton";

const filters = ["all", "pending", "accepted", "completed", "cancelled"] as const;

export default function DoctorConsultations() {
  const [filter, setFilter] = useState<typeof filters[number]>("all");
  const [notesFor, setNotesFor] = useState<any>(null);
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const { data: ctx } = useDoctor();
  const { data, isLoading } = useQuery({
    enabled: !!ctx?.doctor?.id,
    queryKey: ["doctor", "consultations", ctx?.doctor?.id],
    queryFn: async () => {
      const { data } = await supabase.from("consultation_requests").select("*, patients(first_name,last_name,phone,user_id)").eq("doctor_id", ctx!.doctor.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const initPaymentMut = useInitializeConsultationPayment();
  const completeTransferMut = useCompleteConsultationTransfer();

  const list = (data || []).filter((c: any) => filter === "all" || c.status === filter);

  async function update(id: string, patch: any, msg: string) {
    const { error } = await supabase.from("consultation_requests").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["doctor", "consultations"] });
  }

  async function accept(c: any) {
    // Initiate payment for consultation
    try {
      // Get patient info including email
      const { data: patientInfo } = await supabase
        .from("patients")
        .select("*, users!inner(email)")
        .eq("id", c.patient_id)
        .single();

      const patientEmail = (patientInfo as any)?.users?.[0]?.email || patientInfo?.email;

      if (!patientEmail) {
        toast.error("Unable to process payment - patient email not found");
        return;
      }

      // Initialize payment
      await initPaymentMut.mutateAsync({
        email: patientEmail,
        amount: Number(c.fee_agreed) || 0,
        consultation_id: c.id,
        patient_id: c.patient_id,
        doctor_id: c.doctor_id,
      });

      // Update consultation status to accepted
      await update(c.id, { status: "accepted" }, "Consultation accepted. Payment initiated for patient.");
      toast.info("Payment link sent to patient");
    } catch (error: any) {
      toast.error(error.message || "Failed to process payment");
    }
  }

  async function complete() {
    if (!notesFor) return;
    try {
      // Complete consultation first
      await update(notesFor.id, { status: "completed", doctor_notes: note, call_ended_at: new Date().toISOString() }, "Consultation completed");

      // Transfer funds to doctor
      try {
        // Get doctor's bank details (you'll need to add this to doctor profile)
        // For now, we'll show a message that payment transfer should be configured
        toast.info("Consultation marked complete. Admin will process payment transfer.");
      } catch (error: any) {
        toast.error("Consultation marked complete, but payment transfer failed");
      }

      setNotesFor(null);
      setNote("");
    } catch (error: any) {
      toast.error(error.message || "Failed to complete consultation");
    }
  }

  return (
    <DoctorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Consultation Requests</h1>
        <p className="text-muted-foreground text-sm">External consults via the Care Zone marketplace</p>
      </div>

      <div className="flex gap-1 mb-5 bg-muted/30 p-1 rounded-lg w-fit flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("px-3 py-1.5 rounded-md text-sm capitalize", filter === f ? "bg-card shadow" : "text-muted-foreground")}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : list.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
          <MessageSquare className="w-10 h-10 mx-auto mb-2" />
          No consultation requests.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {list.map((c: any) => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-5 flex flex-col">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center",
                    c.request_type === "virtual" ? "bg-info/10 text-info" : "bg-warning/10 text-warning"
                  )}
                >
                  {c.request_type === "virtual" ? <Video className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-heading font-bold">
                    {c.patients ? `${c.patients.first_name} ${c.patients.last_name}` : "Patient"}
                  </h3>
                  <p className="text-xs text-muted-foreground">{c.specialty_needed || "—"}</p>
                </div>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium capitalize",
                    c.urgency === "urgent"
                      ? "bg-destructive/15 text-destructive"
                      : c.urgency === "moderate"
                        ? "bg-warning/15 text-warning"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {c.urgency}
                </span>
              </div>
              <p className="text-sm mt-3 italic text-muted-foreground flex-1">"{c.reason}"</p>
              {c.fee_agreed && (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground">Fee</div>
                  <div className="font-bold text-primary">₦{Number(c.fee_agreed).toLocaleString()}</div>
                </div>
              )}
              <div className="mt-3 pt-3 border-t border-border flex gap-2 flex-wrap">
                {c.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => accept(c)}
                      disabled={initPaymentMut.isPending}
                      className="gap-1"
                    >
                      <Zap className="w-4 h-4" />
                      {initPaymentMut.isPending ? "Processing..." : "Accept"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => update(c.id, { status: "cancelled" }, "Declined")}>
                      <XCircle className="w-4 h-4" />
                      Decline
                    </Button>
                  </>
                )}
                {c.status === "accepted" && c.request_type === "virtual" && (
                  <>
                    <JoinCallButton
                      consultationId={c.id}
                      meetingLink={c.meeting_link}
                      patientPhone={c.patients?.phone}
                      patientName={c.patients ? `${c.patients.first_name} ${c.patients.last_name}` : undefined}
                      scheduledFor={c.scheduled_for}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNotesFor(c);
                        setNote(c.doctor_notes || "");
                      }}
                    >
                      Complete
                    </Button>
                  </>
                )}
                {c.status === "accepted" && c.request_type !== "virtual" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNotesFor(c);
                      setNote(c.doctor_notes || "");
                    }}
                  >
                    Complete
                  </Button>
                )}
                {c.status === "completed" && c.doctor_notes && (
                  <span className="text-xs text-muted-foreground">Notes: {c.doctor_notes.slice(0, 80)}</span>
                )}
                <span
                  className={cn(
                    "ml-auto text-xs capitalize px-2 py-0.5 rounded-full",
                    c.status === "pending"
                      ? "bg-warning/15 text-warning"
                      : c.status === "accepted"
                        ? "bg-success/15 text-success"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {c.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!notesFor} onOpenChange={(o) => !o && setNotesFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete consultation</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={5}
            placeholder="Consultation summary / advice given..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setNotesFor(null)}>
              Cancel
            </Button>
            <Button onClick={complete} disabled={completeTransferMut.isPending}>
              {completeTransferMut.isPending ? "Processing..." : "Mark completed"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DoctorLayout>
  );
}
