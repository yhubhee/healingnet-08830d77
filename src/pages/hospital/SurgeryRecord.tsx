// One surgery record, for the hospital's staff and doctors: the booking, what happens before
// the operation (admission, fasting, consent, instructions), the operation itself, and the
// follow-up. Every field the patient can see is marked "Visible to the patient". Changing
// the date, time or admission tells the patient (the database does it).
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { HospitalLayout } from "@/layouts/HospitalLayout";
import { QueryState } from "@/components/common/QueryState";
import { CarePlanSection, HospitalOnly, RecordSection, VisibleToPatient } from "@/components/hospital/CarePlanSection";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSurgeryRecord, useUpdateSurgery, type SurgeryRecord } from "@/hooks/useCareRecords";
import { useHospitalDoctors } from "@/hooks/useHospitalData";
import { careDateTime, suggestFastingFrom, SURGERY_STEPS, surgeryStatusText } from "@/lib/care";
import { ageFromDob, fmtLongDate, fromLagosInput, toLagosInput } from "@/lib/dates";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";

const NONE = "none";
const TYPES = [["elective", "Elective"], ["emergency", "Emergency"], ["day_case", "Day case"]] as const;
const ANAESTHESIA = [["general", "General"], ["local", "Local"], ["spinal", "Spinal"], ["epidural", "Epidural"], ["sedation", "Sedation"]] as const;
const labelOf = (list: readonly (readonly [string, string])[], v: string | null) => list.find(([k]) => k === v)?.[1] ?? "—";
const fail = (e: unknown) => toast.error(friendlyError(e));
const fmt12 = (time: string | null) => {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
const doctorName = (d: { first_name: string; last_name: string } | null) => (d ? `Dr. ${d.first_name} ${d.last_name}` : null);

function Fact({ label, value, badge }: { label: string; value: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div>
      <dt className="flex flex-wrap items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">{label}{badge}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}

function EditDialog({ record, open, onClose }: { record: SurgeryRecord; open: boolean; onClose: () => void }) {
  const update = useUpdateSurgery(record.id);
  const { data: doctors = [] } = useHospitalDoctors();
  const [f, setF] = useState({ procedure_name: "", procedure_type: "elective", scheduled_date: "", scheduled_time: "", theatre_number: "", surgeon_id: "", anaesthetist_id: NONE, anaesthesia_type: NONE });
  useEffect(() => {
    if (open) setF({
      procedure_name: record.procedure_name, procedure_type: record.procedure_type ?? "elective", scheduled_date: record.scheduled_date, scheduled_time: (record.scheduled_time ?? "").slice(0, 5),
      theatre_number: record.theatre_number ?? "", surgeon_id: record.surgeon_id, anaesthetist_id: record.anaesthetist_id ?? NONE, anaesthesia_type: record.anaesthesia_type ?? NONE,
    });
  }, [open, record]);
  const moved = f.scheduled_date !== record.scheduled_date || f.scheduled_time !== (record.scheduled_time ?? "").slice(0, 5);

  function save(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({
      procedure_name: f.procedure_name.trim(), procedure_type: f.procedure_type, scheduled_date: f.scheduled_date, scheduled_time: f.scheduled_time,
      theatre_number: f.theatre_number.trim() || null, surgeon_id: f.surgeon_id, anaesthetist_id: f.anaesthetist_id === NONE ? null : f.anaesthetist_id,
      anaesthesia_type: f.anaesthesia_type === NONE ? null : f.anaesthesia_type,
    }, { onSuccess: () => { toast.success(moved ? "Saved. The patient has been told about the new date." : "Surgery record updated"); onClose(); }, onError: fail });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit surgery booking</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div><Label htmlFor="s-proc">Procedure</Label><Input id="s-proc" required value={f.procedure_name} onChange={(e) => setF({ ...f, procedure_name: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label htmlFor="s-date">Date</Label><Input id="s-date" type="date" required value={f.scheduled_date} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} /></div>
            <div><Label htmlFor="s-time">Time</Label><Input id="s-time" type="time" required value={f.scheduled_time} onChange={(e) => setF({ ...f, scheduled_time: e.target.value })} /></div>
            <div><Label htmlFor="s-theatre">Theatre</Label><Input id="s-theatre" value={f.theatre_number} onChange={(e) => setF({ ...f, theatre_number: e.target.value })} /></div>
          </div>
          {moved && <p role="status" className="rounded-lg bg-info/10 p-2 text-sm">The patient will be notified of the new date and time.</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="s-type">Type</Label>
              <Select value={f.procedure_type} onValueChange={(v) => setF({ ...f, procedure_type: v })}>
                <SelectTrigger id="s-type"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="s-an-type">Anaesthesia</Label>
              <Select value={f.anaesthesia_type} onValueChange={(v) => setF({ ...f, anaesthesia_type: v })}>
                <SelectTrigger id="s-an-type"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>Not decided</SelectItem>{ANAESTHESIA.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="s-surgeon">Surgeon</Label>
              <Select value={f.surgeon_id} onValueChange={(v) => setF({ ...f, surgeon_id: v })}>
                <SelectTrigger id="s-surgeon"><SelectValue /></SelectTrigger>
                <SelectContent>{doctors.map((d: any) => <SelectItem key={d.id} value={d.doctor_id}>Dr. {d.doctors?.first_name} {d.doctors?.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="s-anaes">Anaesthetist</Label>
              <Select value={f.anaesthetist_id} onValueChange={(v) => setF({ ...f, anaesthetist_id: v })}>
                <SelectTrigger id="s-anaes"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>Not assigned</SelectItem>{doctors.map((d: any) => <SelectItem key={d.id} value={d.doctor_id}>Dr. {d.doctors?.first_name} {d.doctors?.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TextBlock({ id, value, onSave, saving, rows = 4, placeholder }: { id: string; value: string | null; onSave: (v: string | null) => void; saving: boolean; rows?: number; placeholder?: string }) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => { setText(value ?? ""); }, [value]);
  const changed = text.trim() !== (value ?? "").trim();
  return (
    <div className="space-y-2">
      <Textarea id={id} rows={rows} maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} />
      <Button size="sm" disabled={!changed || saving} onClick={() => onSave(text.trim() || null)}>{saving ? "Saving…" : "Save"}</Button>
    </div>
  );
}

/** scheduled → prep → in progress → recovery → completed, in words, with the current step marked. */
function Steps({ status }: { status: string }) {
  const at = SURGERY_STEPS.indexOf(status as (typeof SURGERY_STEPS)[number]);
  if (at < 0) return <p className="font-semibold">{surgeryStatusText(status)}</p>;
  return (
    <ol className="flex flex-wrap items-center gap-x-1 gap-y-2" aria-label={`Status: ${surgeryStatusText(status)}`}>
      {SURGERY_STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-1" aria-current={i === at ? "step" : undefined}>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold", i < at ? "bg-success/15 text-success" : i === at ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {i < at && <Check className="h-3 w-3" aria-hidden />}{surgeryStatusText(s)}{i === at && <span className="sr-only"> (now)</span>}
          </span>
          {i < SURGERY_STEPS.length - 1 && <span aria-hidden className="text-muted-foreground">→</span>}
        </li>
      ))}
    </ol>
  );
}

export default function HospitalSurgeryRecord() {
  const { id } = useParams<{ id: string }>();
  const q = useSurgeryRecord(id);
  const update = useUpdateSurgery(id);
  const [editing, setEditing] = useState(false);
  const r = q.data;

  const [before, setBefore] = useState({ admit: "", fasting: "" });
  const [op, setOp] = useState({ start: "", end: "", blood: "" });
  useEffect(() => {
    if (!r) return;
    setBefore({ admit: toLagosInput(r.admit_at), fasting: toLagosInput(r.fasting_from) });
    setOp({ start: toLagosInput(r.actual_start), end: toLagosInput(r.actual_end), blood: r.blood_loss_ml === null ? "" : String(r.blood_loss_ml) });
  }, [r]);

  const save = (patch: Parameters<typeof update.mutate>[0], message: string) => update.mutate(patch, { onSuccess: () => toast.success(message), onError: fail });
  const suggestion = r ? suggestFastingFrom(r.scheduled_date, r.scheduled_time) : null;
  const age = ageFromDob(r?.patients?.date_of_birth);
  const at = r ? SURGERY_STEPS.indexOf((r.status ?? "scheduled") as (typeof SURGERY_STEPS)[number]) : -1;
  const next = at >= 0 && at < SURGERY_STEPS.length - 1 ? SURGERY_STEPS[at + 1] : null;
  const duration = (start: string | null, end: string | null) => {
    if (!start || !end) return null;
    const mins = Math.round((Date.parse(end) - Date.parse(start)) / 60_000);
    return mins >= 0 && mins < 48 * 60 ? mins : null;
  };

  function saveTimes(startIso: string | null, endIso: string | null, extra: Parameters<typeof update.mutate>[0] = {}, message = "Operation times saved") {
    if (startIso && endIso && Date.parse(endIso) < Date.parse(startIso)) { toast.error("The end time is before the start time."); return; }
    save({ actual_start: startIso, actual_end: endIso, duration_minutes: duration(startIso, endIso), ...extra }, message);
  }

  return (
    <HospitalLayout>
      <Link to="/hospital/surgery" className="mb-4 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"><ArrowLeft className="h-4 w-4" />All surgery records</Link>
      <QueryState isLoading={q.isLoading} isError={q.isError} error={q.error} onRetry={() => q.refetch()}>
        {!r ? <p className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">This record was not found, or it belongs to another hospital.</p> : (
          <div className="space-y-6">
            <RecordSection title={`${r.patients?.first_name ?? ""} ${r.patients?.last_name ?? ""}`.trim() || "Patient"} action={<Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-1 h-4 w-4" />Edit</Button>}>
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Fact label="Procedure" value={r.procedure_name} badge={<VisibleToPatient />} />
                <Fact label="Type" value={labelOf(TYPES, r.procedure_type)} badge={<VisibleToPatient />} />
                <Fact label="Date and time" value={`${fmtLongDate(r.scheduled_date)}, ${fmt12(r.scheduled_time)}`} badge={<VisibleToPatient />} />
                <Fact label="Theatre" value={r.theatre_number} badge={<HospitalOnly />} />
                <Fact label="Surgeon" value={doctorName(r.doctors)} badge={<VisibleToPatient />} />
                <Fact label="Anaesthetist" value={doctorName(r.anaesthetist)} badge={<HospitalOnly />} />
                <Fact label="Anaesthesia" value={labelOf(ANAESTHESIA, r.anaesthesia_type)} badge={<VisibleToPatient />} />
                <Fact label="Patient" value={[age === null ? null : `${age} years`, r.patients?.phone, [r.patients?.blood_group, r.patients?.genotype].filter(Boolean).join(" / ")].filter(Boolean).join(" · ")} />
              </dl>
              <div className="mt-5 space-y-3 border-t border-border pt-4">
                <p className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">Status <VisibleToPatient /></p>
                <Steps status={r.status ?? "scheduled"} />
                <div className="flex flex-wrap gap-2">
                  {next && <Button size="sm" disabled={update.isPending} onClick={() => save({ status: next }, `Status: ${surgeryStatusText(next)}`)}>Move to: {surgeryStatusText(next)}</Button>}
                  {r.status !== "completed" && r.status !== "cancelled" && (
                    <>
                      {r.status !== "postponed" && <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => save({ status: "postponed" }, "Marked as postponed")}>Postpone</Button>}
                      <Button size="sm" variant="outline" className="text-destructive" disabled={update.isPending} onClick={() => { if (window.confirm("Cancel this surgery? The patient will see it as cancelled.")) save({ status: "cancelled" }, "Surgery cancelled"); }}>Cancel surgery</Button>
                    </>
                  )}
                  {(r.status === "postponed" || r.status === "cancelled") && <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => save({ status: "scheduled" }, "Back to scheduled")}>Back to scheduled</Button>}
                </div>
              </div>
            </RecordSection>

            <RecordSection title="Before the operation">
              <div className="grid gap-5 md:grid-cols-2">
                <form className="space-y-3" onSubmit={(e) => {
                  e.preventDefault();
                  save({ admit_at: fromLagosInput(before.admit), fasting_from: fromLagosInput(before.fasting) }, "Saved. The patient sees the new times.");
                }}>
                  <div>
                    <Label htmlFor="s-admit" className="flex flex-wrap items-center gap-1.5">Admission date and time <VisibleToPatient /></Label>
                    <Input id="s-admit" type="datetime-local" value={before.admit} onChange={(e) => setBefore({ ...before, admit: e.target.value })} />
                    <p className="mt-1 text-xs text-muted-foreground">Changing this notifies the patient. Times are Nigerian time.</p>
                  </div>
                  <div>
                    <Label htmlFor="s-fast" className="flex flex-wrap items-center gap-1.5">Fasting from <VisibleToPatient /></Label>
                    <Input id="s-fast" type="datetime-local" value={before.fasting} onChange={(e) => setBefore({ ...before, fasting: e.target.value })} />
                    {suggestion && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Suggested: {careDateTime(suggestion.toISOString())} (6 hours before the start).{" "}
                        <button type="button" className="font-medium text-primary underline-offset-2 hover:underline" onClick={() => setBefore({ ...before, fasting: toLagosInput(suggestion.toISOString()) })}>Use this</button>
                      </p>
                    )}
                  </div>
                  <Button type="submit" size="sm" disabled={update.isPending}>Save times</Button>
                </form>
                <div className="space-y-4">
                  <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
                    <Checkbox className="mt-0.5" checked={!!r.consent_signed_at} disabled={update.isPending}
                      onCheckedChange={(v) => save({ consent_signed_at: v === true ? new Date().toISOString() : null }, v === true ? "Consent marked as signed" : "Consent mark removed")} />
                    <span><span className="flex flex-wrap items-center gap-1.5 font-medium">Consent form signed <VisibleToPatient /></span>
                      <span className="text-muted-foreground">{r.consent_signed_at ? `Signed ${careDateTime(r.consent_signed_at)}` : "Not signed yet. The patient is told they will sign at the hospital."}</span></span>
                  </label>
                  <div>
                    <Label htmlFor="s-preop" className="mb-2 flex flex-wrap items-center gap-1.5">Pre-op diagnosis <HospitalOnly /></Label>
                    <TextBlock id="s-preop" rows={2} value={r.pre_op_diagnosis} saving={update.isPending} onSave={(v) => save({ pre_op_diagnosis: v }, "Diagnosis saved")} />
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <Label htmlFor="s-instr" className="mb-2 flex flex-wrap items-center gap-1.5">Instructions for the patient <VisibleToPatient /></Label>
                <TextBlock id="s-instr" value={r.patient_instructions} saving={update.isPending} placeholder="What to bring, when to arrive, who to call."
                  onSave={(v) => save({ patient_instructions: v }, "Instructions saved. The patient can see them.")} />
              </div>
            </RecordSection>

            <CarePlanSection source="surgery" sourceId={r.id}
              intro="The pre-op checklist (tests, medicines to stop or continue) and the follow-ups after the operation (wound check, stitches removal, clinic review). The patient sees each one and is reminded before it." />

            <RecordSection title="Operation" badge={<HospitalOnly />}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <Label htmlFor="s-start">Actual start</Label>
                  <Input id="s-start" type="datetime-local" value={op.start} onChange={(e) => setOp({ ...op, start: e.target.value })} />
                  <Button type="button" size="sm" variant="outline" className="mt-2" disabled={update.isPending}
                    onClick={() => saveTimes(new Date().toISOString(), null, at >= 0 && at < 2 ? { status: "in_progress" } : {}, "Operation started")}>Start now</Button>
                </div>
                <div>
                  <Label htmlFor="s-end">Actual end</Label>
                  <Input id="s-end" type="datetime-local" value={op.end} onChange={(e) => setOp({ ...op, end: e.target.value })} />
                  <Button type="button" size="sm" variant="outline" className="mt-2" disabled={update.isPending || !r.actual_start}
                    onClick={() => saveTimes(r.actual_start, new Date().toISOString(), r.status === "in_progress" ? { status: "recovery" } : {}, "Operation ended")}>End now</Button>
                </div>
                <div>
                  <p className="text-sm font-medium">Duration</p>
                  <p className="mt-2 font-heading text-xl font-bold">{r.duration_minutes === null ? "—" : `${Math.floor(r.duration_minutes / 60)} h ${r.duration_minutes % 60} min`}</p>
                  <p className="text-xs text-muted-foreground">Worked out from the start and end.</p>
                </div>
                <div>
                  <Label htmlFor="s-blood">Blood loss (ml)</Label>
                  <Input id="s-blood" type="number" min={0} max={20000} value={op.blood} onChange={(e) => setOp({ ...op, blood: e.target.value })} />
                </div>
              </div>
              <Button size="sm" className="mt-3" disabled={update.isPending}
                onClick={() => saveTimes(fromLagosInput(op.start), fromLagosInput(op.end), { blood_loss_ml: op.blood.trim() === "" ? null : Math.round(Number(op.blood)) })}>Save operation details</Button>
              <div className="mt-5 grid gap-5 md:grid-cols-3">
                <div><Label htmlFor="s-postdx" className="mb-2 block">Post-op diagnosis</Label><TextBlock id="s-postdx" rows={3} value={r.post_op_diagnosis} saving={update.isPending} onSave={(v) => save({ post_op_diagnosis: v }, "Saved")} /></div>
                <div><Label htmlFor="s-find" className="mb-2 block">Operative findings</Label><TextBlock id="s-find" rows={3} value={r.operative_findings} saving={update.isPending} onSave={(v) => save({ operative_findings: v }, "Saved")} /></div>
                <div><Label htmlFor="s-comp" className="mb-2 block">Complications</Label><TextBlock id="s-comp" rows={3} value={r.complications} saving={update.isPending} onSave={(v) => save({ complications: v }, "Saved")} /></div>
              </div>
            </RecordSection>

            <RecordSection title="After the operation">
              <Label htmlFor="s-postop" className="mb-2 flex flex-wrap items-center gap-1.5">Post-op instructions <VisibleToPatient /></Label>
              <TextBlock id="s-postop" value={r.post_op_instructions} saving={update.isPending} placeholder="How to look after the wound, what to watch for, when to come back."
                onSave={(v) => save({ post_op_instructions: v }, "Instructions saved. The patient can see them.")} />
              <p className="mt-3 text-sm text-muted-foreground">Add follow-ups (wound check, stitches removal, clinic review) in the care plan above, so the patient is reminded.</p>
              <div className="mt-5">
                <Label htmlFor="s-notes" className="mb-2 flex flex-wrap items-center gap-1.5">Internal notes <HospitalOnly /></Label>
                <TextBlock id="s-notes" rows={3} value={r.notes} saving={update.isPending} onSave={(v) => save({ notes: v }, "Notes saved")} />
              </div>
            </RecordSection>

            <EditDialog record={r} open={editing} onClose={() => setEditing(false)} />
          </div>
        )}
      </QueryState>
    </HospitalLayout>
  );
}
