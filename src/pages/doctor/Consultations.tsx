import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Video, FileText, MessageSquare, CheckCircle2, XCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useDoctor } from "@/hooks/useDoctor";
import { QueryState } from "@/components/common/QueryState";
import { pick, ALLOWED } from "@/lib/allowed";
import { friendlyError } from "@/lib/errors";
import { Input } from "@/components/ui/input";
import { JoinCallButton } from "@/components/JoinCallButton";

const filters = ["all", "pending", "accepted", "completed", "rejected", "cancelled"] as const;

export default function DoctorConsultations() {
  const [filter, setFilter] = useState<typeof filters[number]>("all");
  const [notesFor, setNotesFor] = useState<any>(null);
  const [note, setNote] = useState("");
  const qc = useQueryClient();
  const { data: ctx } = useDoctor();
  const { data, isLoading, isError, error, refetch } = useQuery({
    enabled: !!ctx?.doctor?.id,
    queryKey: ["doctor", "consultations", ctx?.doctor?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("consultation_requests").select("*, patients(first_name,last_name,phone,user_id)").eq("doctor_id", ctx!.doctor.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // The doctor's listed fee is the starting point; the fee is fixed when the request is accepted.
  const { data: listedFee } = useQuery({
    enabled: !!ctx?.doctor?.id,
    queryKey: ["doctor", "listed-fee", ctx?.doctor?.id],
    queryFn: async () => {
      const { data } = await supabase.from("doctor_marketplace").select("external_virtual_fee").eq("doctor_id", ctx!.doctor.id).maybeSingle();
      return data?.external_virtual_fee ?? null;
    },
  });
  const [fees, setFees] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const list = (data || []).filter((c: any) => filter === "all" || c.status === filter);

  async function update(id: string, patch: any, msg: string): Promise<boolean> {
    setSaving(true);
    const { error } = await supabase.from("consultation_requests").update(pick(patch, ALLOWED.consultationRequestUpdate) as any).eq("id", id);
    setSaving(false);
    if (error) { toast.error(friendlyError(error, "We couldn't update this request. Please try again.")); return false; }
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["doctor", "consultations"] });
    return true;
  }

  // Accepting fixes the fee: it can only change while the request is pending.
  async function accept(c: any) {
    const fee = Number(fees[c.id] ?? c.fee_agreed ?? listedFee ?? 0);
    if (!Number.isFinite(fee) || fee <= 0) {
      toast.error("Enter the consultation fee before accepting.");
      return;
    }
    await update(c.id, { fee_agreed: fee, status: "accepted" }, "Consultation accepted. The requesting hospital can now pay the fee.");
  }

  async function complete() {
    if (!notesFor) return;
    const ok = await update(notesFor.id, { status: "completed", doctor_notes: note }, "Consultation completed");
    if (ok) {
      setNotesFor(null);
      setNote("");
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

      <QueryState isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
      {list.length === 0 ? (
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
              {c.status === "pending" ? (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground mb-1">Fee (₦), fixed once you accept</div>
                  <Input
                    type="number"
                    min={0}
                    value={fees[c.id] ?? (c.fee_agreed ?? listedFee ?? "")}
                    onChange={(e) => setFees((f) => ({ ...f, [c.id]: e.target.value }))}
                  />
                </div>
              ) : c.fee_agreed ? (
                <div className="mt-3 pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground">Fee {c.paid_at ? "(paid)" : "(locked)"}</div>
                  <div className="font-bold text-primary">₦{Number(c.fee_agreed).toLocaleString()}</div>
                  <div className="text-[11px] text-muted-foreground">The fee can't be changed after acceptance.</div>
                </div>
              ) : null}
              <div className="mt-3 pt-3 border-t border-border flex gap-2 flex-wrap">
                {c.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      onClick={() => accept(c)}
                      disabled={saving}
                      className="gap-1"
                    >
                      <Zap className="w-4 h-4" />
                      {saving ? "Saving..." : "Accept"}
                    </Button>
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => update(c.id, { status: "rejected" }, "Declined")}>
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
                {c.status === "accepted" && (
                  <Button size="sm" variant="ghost" disabled={saving} onClick={() => update(c.id, { status: "cancelled" }, "Cancelled")}>Cancel</Button>
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
      </QueryState>

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
            <Button onClick={complete} disabled={saving}>
              {saving ? "Saving..." : "Mark completed"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DoctorLayout>
  );
}
