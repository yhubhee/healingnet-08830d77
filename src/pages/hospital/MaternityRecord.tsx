// One pregnancy record, for the hospital's staff and doctors: the mother's details, antenatal
// visits (with a chart of blood pressure and weight), the care plan she sees, delivery, the
// message for her, and the notes that stay inside the hospital. Every field the patient can
// see is marked "Visible to the patient".
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CalendarPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { HospitalLayout } from "@/layouts/HospitalLayout";
import { QueryState } from "@/components/common/QueryState";
import { CarePlanSection, HospitalOnly, RecordSection, VisibleToPatient, type CareItemDraft } from "@/components/hospital/CarePlanSection";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  useCareItemActions, useDeleteVisit, useMaternityRecord, useMaternityVisits, useRecordVisit, useUpdateMaternity, type MaternityRecord, type VisitInput,
} from "@/hooks/useCareRecords";
import { useHospitalDoctors } from "@/hooks/useHospitalData";
import { bpFlag, careDay, eddFromLmp, gestationOn, gestationText, lmpFromEdd } from "@/lib/care";
import { ageFromDob, fmtLongDate, lagosToday } from "@/lib/dates";
import { friendlyError } from "@/lib/errors";

const STATUSES = [
  ["anc_registered", "ANC registered"], ["active_anc", "Active ANC"], ["labour", "In labour"], ["delivered", "Delivered"], ["postnatal", "Postnatal"], ["discharged", "Discharged"],
] as const;
const statusLabel = (s: string | null) => STATUSES.find(([v]) => v === s)?.[1] ?? "—";
const PRESENTATIONS = [["cephalic", "Cephalic (head down)"], ["breech", "Breech"], ["transverse", "Transverse"], ["oblique", "Oblique"], ["not_determined", "Not determined"]] as const;
const URINE = ["negative", "trace", "1+", "2+", "3+", "4+"];
const NONE = "none";
const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
const fail = (e: unknown) => toast.error(friendlyError(e));

function Fact({ label, value, badge }: { label: string; value: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div>
      <dt className="flex flex-wrap items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">{label}{badge}</dt>
      <dd className="font-medium">{value || "—"}</dd>
    </div>
  );
}

// ---- Edit the pregnancy ---------------------------------------------------------------------
function EditDialog({ record, open, onClose }: { record: MaternityRecord; open: boolean; onClose: () => void }) {
  const update = useUpdateMaternity(record.id);
  const { data: doctors = [] } = useHospitalDoctors();
  const [f, setF] = useState({ lmp_date: "", edd: "", gravida: "", para: "", risk_level: "low", status: "anc_registered", doctor_id: NONE });
  useEffect(() => {
    if (open) setF({
      lmp_date: record.lmp_date ?? "", edd: record.edd ?? "", gravida: String(record.gravida ?? ""), para: String(record.para ?? ""),
      risk_level: record.risk_level ?? "low", status: record.status ?? "anc_registered", doctor_id: record.doctor_id ?? NONE,
    });
  }, [open, record]);

  function save(e: React.FormEvent) {
    e.preventDefault();
    update.mutate({
      lmp_date: f.lmp_date || null, edd: f.edd || null, gravida: num(f.gravida), para: num(f.para),
      risk_level: f.risk_level, status: f.status, doctor_id: f.doctor_id === NONE ? null : f.doctor_id,
    }, { onSuccess: () => { toast.success("Pregnancy record updated"); onClose(); }, onError: fail });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Edit pregnancy record</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="m-lmp">LMP (last period)</Label>
              {/* Filling one date fills the other: EDD = LMP + 280 days. */}
              <Input id="m-lmp" type="date" max={lagosToday()} value={f.lmp_date} onChange={(e) => setF({ ...f, lmp_date: e.target.value, edd: eddFromLmp(e.target.value) ?? f.edd })} />
            </div>
            <div>
              <Label htmlFor="m-edd">EDD (due date)</Label>
              <Input id="m-edd" type="date" value={f.edd} onChange={(e) => setF({ ...f, edd: e.target.value, lmp_date: lmpFromEdd(e.target.value) ?? f.lmp_date })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Fill either date and the other is worked out (EDD = LMP + 280 days). Both stay editable.</p>
          <div className="grid grid-cols-3 gap-3">
            <div><Label htmlFor="m-g">Gravida</Label><Input id="m-g" type="number" min={0} max={30} value={f.gravida} onChange={(e) => setF({ ...f, gravida: e.target.value })} /></div>
            <div><Label htmlFor="m-p">Para</Label><Input id="m-p" type="number" min={0} max={30} value={f.para} onChange={(e) => setF({ ...f, para: e.target.value })} /></div>
            <div>
              <Label htmlFor="m-risk">Risk level</Label>
              <Select value={f.risk_level} onValueChange={(v) => setF({ ...f, risk_level: v })}>
                <SelectTrigger id="m-risk"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="m-status">Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger id="m-status"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="m-doc">Doctor</Label>
              <Select value={f.doctor_id} onValueChange={(v) => setF({ ...f, doctor_id: v })}>
                <SelectTrigger id="m-doc"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No doctor yet</SelectItem>
                  {doctors.map((d: any) => <SelectItem key={d.id} value={d.doctor_id}>Dr. {d.doctors?.first_name} {d.doctors?.last_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- Record an antenatal visit --------------------------------------------------------------
const emptyVisit = (weeks: number | null) => ({
  visit_date: lagosToday(), weeks: weeks === null ? "" : String(weeks), sys: "", dia: "", weight: "", fundal: "", fhr: "",
  presentation: NONE, urine: NONE, oedema: false, notes: "", next: "",
});

function VisitDialog({ record, open, onClose, onRecorded }: { record: MaternityRecord; open: boolean; onClose: () => void; onRecorded: (nextVisitDate: string | null) => void }) {
  const save = useRecordVisit(record.id);
  const weeksOn = useCallback((date: string) => gestationOn(record.lmp_date, record.edd, date)?.weeks ?? null, [record.lmp_date, record.edd]);
  const [f, setF] = useState(() => emptyVisit(null));
  useEffect(() => { if (open) setF(emptyVisit(weeksOn(lagosToday()))); }, [open, weeksOn]);
  const flag = bpFlag(num(f.sys), num(f.dia));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if ((f.sys.trim() === "") !== (f.dia.trim() === "")) { toast.error("Enter both blood pressure numbers, or leave both empty."); return; }
    const visit: VisitInput = {
      visit_date: f.visit_date, gestational_weeks: num(f.weeks), bp_systolic: num(f.sys), bp_diastolic: num(f.dia), weight_kg: num(f.weight),
      fundal_height_cm: num(f.fundal), fetal_heart_rate: num(f.fhr), presentation: f.presentation === NONE ? null : f.presentation,
      urine_protein: f.urine === NONE ? null : f.urine, oedema: f.oedema, notes: f.notes.trim() || null, next_visit_date: f.next || null,
    };
    save.mutate(visit, { onSuccess: () => { toast.success("Visit recorded"); onClose(); onRecorded(visit.next_visit_date ?? null); }, onError: fail });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Record antenatal visit</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div><Label htmlFor="v-date">Date</Label><Input id="v-date" type="date" required max={lagosToday()} value={f.visit_date}
              onChange={(e) => { const w = weeksOn(e.target.value); setF({ ...f, visit_date: e.target.value, weeks: w === null ? f.weeks : String(w) }); }} /></div>
            <div><Label htmlFor="v-weeks">Weeks</Label><Input id="v-weeks" type="number" min={0} max={45} value={f.weeks} onChange={(e) => setF({ ...f, weeks: e.target.value })} />
              <p className="mt-1 text-xs text-muted-foreground">Worked out from the LMP; change it if needed.</p></div>
            <div><Label htmlFor="v-weight">Weight (kg)</Label><Input id="v-weight" type="number" step="0.1" min={20} max={300} value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} /></div>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Blood pressure (mmHg)</legend>
            <div className="flex items-center gap-2">
              <Input aria-label="Systolic (top number)" type="number" min={40} max={300} placeholder="120" className="w-28" value={f.sys} onChange={(e) => setF({ ...f, sys: e.target.value })} />
              <span aria-hidden>/</span>
              <Input aria-label="Diastolic (bottom number)" type="number" min={20} max={200} placeholder="80" className="w-28" value={f.dia} onChange={(e) => setF({ ...f, dia: e.target.value })} />
              {flag && <span role="status" className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-bold text-destructive"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />{flag}</span>}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div><Label htmlFor="v-fundal">Fundal height (cm)</Label><Input id="v-fundal" type="number" step="0.1" min={0} max={60} value={f.fundal} onChange={(e) => setF({ ...f, fundal: e.target.value })} /></div>
            <div><Label htmlFor="v-fhr">Fetal heart rate</Label><Input id="v-fhr" type="number" min={50} max={250} value={f.fhr} onChange={(e) => setF({ ...f, fhr: e.target.value })} /></div>
            <div>
              <Label htmlFor="v-pres">Presentation</Label>
              <Select value={f.presentation} onValueChange={(v) => setF({ ...f, presentation: v })}>
                <SelectTrigger id="v-pres"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>Not recorded</SelectItem>{PRESENTATIONS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="v-urine">Urine protein</Label>
              <Select value={f.urine} onValueChange={(v) => setF({ ...f, urine: v })}>
                <SelectTrigger id="v-urine"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={NONE}>Not recorded</SelectItem>{URINE.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.oedema} onCheckedChange={(v) => setF({ ...f, oedema: v === true })} />Oedema (swelling) present</label>
          <div>
            <Label htmlFor="v-notes" className="flex flex-wrap items-center gap-2">Notes <HospitalOnly /></Label>
            <Textarea id="v-notes" rows={2} maxLength={2000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
          <div className="max-w-xs"><Label htmlFor="v-next">Next visit date</Label><Input id="v-next" type="date" min={f.visit_date} value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></div>
          <p className="text-xs text-muted-foreground">The patient sees the date, weeks, blood pressure, weight, baby's heart rate and next visit date. The other fields stay with the hospital.</p>
          <Button type="submit" className="w-full" disabled={save.isPending}>{save.isPending ? "Saving…" : "Record visit"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---- A text box saved with its own button ---------------------------------------------------
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

export default function HospitalMaternityRecord() {
  const { id } = useParams<{ id: string }>();
  const q = useMaternityRecord(id);
  const visits = useMaternityVisits(id);
  const update = useUpdateMaternity(id);
  const removeVisit = useDeleteVisit(id);
  const { standardSchedule } = useCareItemActions("maternity", id);
  const [editing, setEditing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [offerNext, setOfferNext] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<Partial<CareItemDraft> | null>(null);
  const clearPrefill = useCallback(() => setPrefill(null), []);
  const r = q.data;

  const chart = useMemo(() => [...(visits.data ?? [])].reverse().map((v) => ({
    date: careDay(v.visit_date), Systolic: v.bp_systolic, Diastolic: v.bp_diastolic, "Weight (kg)": v.weight_kg === null ? null : Number(v.weight_kg),
  })), [visits.data]);

  const today = r ? gestationOn(r.lmp_date, r.edd, lagosToday()) : null;
  const active = r ? ["anc_registered", "active_anc", "labour"].includes(r.status ?? "") : false;
  const age = ageFromDob(r?.patients?.date_of_birth);
  const [delivery, setDelivery] = useState({ delivery_date: "", delivery_type: NONE, baby_gender: NONE, baby_weight: "", apgar_score: "" });
  useEffect(() => {
    if (r) setDelivery({ delivery_date: r.delivery_date ?? "", delivery_type: r.delivery_type ?? NONE, baby_gender: r.baby_gender ?? NONE, baby_weight: r.baby_weight === null ? "" : String(r.baby_weight), apgar_score: r.apgar_score ?? "" });
  }, [r]);

  return (
    <HospitalLayout>
      <Link to="/hospital/maternity" className="mb-4 inline-flex items-center gap-1 text-sm text-primary underline-offset-4 hover:underline"><ArrowLeft className="h-4 w-4" />All maternity records</Link>
      <QueryState isLoading={q.isLoading} isError={q.isError} error={q.error} onRetry={() => q.refetch()}>
        {!r ? <p className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">This record was not found, or it belongs to another hospital.</p> : (
          <div className="space-y-6">
            <RecordSection title={`${r.patients?.first_name ?? ""} ${r.patients?.last_name ?? ""}`.trim() || "Patient"} action={<Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="mr-1 h-4 w-4" />Edit</Button>}>
              <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Fact label="Age" value={age === null ? null : `${age} years`} />
                <Fact label="Phone" value={r.patients?.phone} />
                <Fact label="Blood group / genotype" value={[r.patients?.blood_group ?? r.blood_group, r.patients?.genotype ?? r.genotype].filter(Boolean).join(" / ")} />
                <Fact label="Doctor" value={r.doctors ? `Dr. ${r.doctors.first_name} ${r.doctors.last_name}` : null} badge={<VisibleToPatient />} />
                <Fact label="EDD (due date)" value={r.edd ? fmtLongDate(r.edd) : null} badge={<VisibleToPatient />} />
                <Fact label="Today" value={active && today ? gestationText(today) : null} badge={<VisibleToPatient />} />
                <Fact label="Status" value={statusLabel(r.status)} badge={<VisibleToPatient />} />
                <Fact label="Risk level" value={<span className="capitalize">{r.risk_level ?? "low"} risk</span>} badge={<HospitalOnly />} />
                <Fact label="Gravida / para" value={`G${r.gravida ?? 0} P${r.para ?? 0}`} badge={<HospitalOnly />} />
                <Fact label="LMP" value={r.lmp_date ? fmtLongDate(r.lmp_date) : null} />
              </dl>
              {!r.lmp_date && !r.edd && <p role="status" className="mt-4 rounded-lg bg-warning/10 p-3 text-sm font-medium text-warning">Add the LMP or the EDD (Edit) so the weeks and the standard schedule can be worked out.</p>}
            </RecordSection>

            <RecordSection title="Antenatal visits" action={<Button size="sm" onClick={() => setRecording(true)}><Plus className="mr-1 h-4 w-4" />Record visit</Button>}>
              {offerNext && (
                <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3">
                  <p className="text-sm font-medium">Next visit is {careDay(offerNext)}. Add to care plan?</p>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => { setPrefill({ kind: "visit", title: "Antenatal visit", due: `${offerNext}T09:00`, remind: true }); setOfferNext(null); }}><CalendarPlus className="mr-1 h-4 w-4" />Add to care plan</Button>
                    <Button size="sm" variant="ghost" onClick={() => setOfferNext(null)}>Not now</Button>
                  </div>
                </div>
              )}
              {visits.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
                : (visits.data ?? []).length === 0 ? <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No visits recorded yet.</p> : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <caption className="sr-only">Past antenatal visits, newest first</caption>
                        <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                          {["Date", "Weeks", "BP", "Weight", "Fundal ht", "FHR", "Presentation", "Urine protein", "Oedema", "Next visit", ""].map((h) => <th key={h} className="p-2 font-semibold">{h}</th>)}
                        </tr></thead>
                        <tbody>
                          {(visits.data ?? []).map((v) => {
                            const flag = bpFlag(v.bp_systolic, v.bp_diastolic);
                            return (
                              <tr key={v.id} className="border-b border-border/50 align-top">
                                <td className="whitespace-nowrap p-2 font-medium">{fmtLongDate(v.visit_date)}{v.notes && <p className="max-w-[16rem] whitespace-normal text-xs font-normal text-muted-foreground">{v.notes}</p>}</td>
                                <td className="p-2">{v.gestational_weeks ?? "—"}</td>
                                <td className="whitespace-nowrap p-2">{v.bp_systolic ? `${v.bp_systolic}/${v.bp_diastolic}` : "—"}{flag && <span className="ml-1.5 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">{flag}</span>}</td>
                                <td className="p-2">{v.weight_kg === null ? "—" : `${v.weight_kg} kg`}</td>
                                <td className="p-2">{v.fundal_height_cm === null ? "—" : `${v.fundal_height_cm} cm`}</td>
                                <td className="p-2">{v.fetal_heart_rate ?? "—"}</td>
                                <td className="p-2 capitalize">{(v.presentation ?? "—").replace(/_/g, " ")}</td>
                                <td className="p-2">{v.urine_protein ?? "—"}</td>
                                <td className="p-2">{v.oedema === null ? "—" : v.oedema ? "Yes" : "No"}</td>
                                <td className="whitespace-nowrap p-2">{v.next_visit_date ? careDay(v.next_visit_date) : "—"}</td>
                                <td className="p-2"><Button size="icon" variant="ghost" aria-label={`Delete the visit of ${fmtLongDate(v.visit_date)}`} onClick={() => { if (window.confirm("Delete this visit? This cannot be undone.")) removeVisit.mutate(v.id, { onError: fail, onSuccess: () => toast.success("Visit deleted") }); }}><Trash2 className="h-4 w-4" /></Button></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {chart.length >= 2 && (
                      <div className="mt-5 grid gap-5 lg:grid-cols-2">
                        <figure>
                          <figcaption className="mb-2 text-sm font-medium">Blood pressure over time</figcaption>
                          <div className="h-56" role="img" aria-label="Line chart of systolic and diastolic blood pressure at each visit. The same numbers are in the table above.">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chart} margin={{ left: -16, right: 8, top: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                <YAxis domain={[40, "auto"]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                                <Legend />
                                <Line type="monotone" dataKey="Systolic" stroke="hsl(var(--primary))" strokeWidth={2} connectNulls />
                                <Line type="monotone" dataKey="Diastolic" stroke="hsl(var(--info))" strokeWidth={2} strokeDasharray="5 4" connectNulls />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </figure>
                        <figure>
                          <figcaption className="mb-2 text-sm font-medium">Weight over time</figcaption>
                          <div className="h-56" role="img" aria-label="Line chart of weight at each visit. The same numbers are in the table above.">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={chart} margin={{ left: -16, right: 8, top: 4 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                                <Legend />
                                <Line type="monotone" dataKey="Weight (kg)" stroke="hsl(var(--success))" strokeWidth={2} connectNulls />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </figure>
                      </div>
                    )}
                  </>
                )}
            </RecordSection>

            <CarePlanSection source="maternity" sourceId={r.id} prefill={prefill} onPrefillUsed={clearPrefill}
              extraAction={<Button size="sm" variant="outline" disabled={standardSchedule.isPending}
                onClick={() => standardSchedule.mutate(undefined, {
                  onSuccess: (n) => (n > 0 ? toast.success(`${n} antenatal ${n === 1 ? "visit" : "visits"} added to the care plan`) : toast.info("No visits were added: the standard weeks have passed or already have a visit.")),
                  onError: (e) => toast.error(/Add the LMP or the EDD first/i.test((e as Error)?.message ?? "") ? "Add the LMP or the EDD first." : friendlyError(e)),
                })}>Add standard antenatal schedule</Button>} />

            {(r.status === "labour" || r.status === "delivered" || r.status === "postnatal" || r.status === "discharged" || r.delivery_date) && (
              <RecordSection title="Delivery">
                <form className="space-y-3" onSubmit={(e) => {
                  e.preventDefault();
                  update.mutate({
                    delivery_date: delivery.delivery_date || null, delivery_type: delivery.delivery_type === NONE ? null : delivery.delivery_type,
                    baby_gender: delivery.baby_gender === NONE ? null : delivery.baby_gender, baby_weight: num(delivery.baby_weight), apgar_score: delivery.apgar_score.trim() || null,
                  }, { onSuccess: () => toast.success("Delivery details saved"), onError: fail });
                }}>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                    <div><Label htmlFor="d-date" className="flex flex-wrap gap-1.5">Delivery date <VisibleToPatient /></Label><Input id="d-date" type="date" max={lagosToday()} value={delivery.delivery_date} onChange={(e) => setDelivery({ ...delivery, delivery_date: e.target.value })} /></div>
                    <div>
                      <Label htmlFor="d-type" className="flex flex-wrap gap-1.5">Type <VisibleToPatient /></Label>
                      <Select value={delivery.delivery_type} onValueChange={(v) => setDelivery({ ...delivery, delivery_type: v })}>
                        <SelectTrigger id="d-type"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value={NONE}>Not recorded</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="caesarean">Caesarean</SelectItem><SelectItem value="assisted">Assisted</SelectItem><SelectItem value="vacuum">Vacuum</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="d-sex" className="flex flex-wrap gap-1.5">Baby's sex <VisibleToPatient /></Label>
                      <Select value={delivery.baby_gender} onValueChange={(v) => setDelivery({ ...delivery, baby_gender: v })}>
                        <SelectTrigger id="d-sex"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value={NONE}>Not recorded</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="male">Male</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><Label htmlFor="d-weight" className="flex flex-wrap gap-1.5">Baby's weight (kg) <VisibleToPatient /></Label><Input id="d-weight" type="number" step="0.01" min={0} max={9} value={delivery.baby_weight} onChange={(e) => setDelivery({ ...delivery, baby_weight: e.target.value })} /></div>
                    <div><Label htmlFor="d-apgar" className="flex flex-wrap gap-1.5">APGAR <HospitalOnly /></Label><Input id="d-apgar" maxLength={20} placeholder="8/10" value={delivery.apgar_score} onChange={(e) => setDelivery({ ...delivery, apgar_score: e.target.value })} /></div>
                  </div>
                  <Button type="submit" size="sm" disabled={update.isPending}>Save delivery details</Button>
                </form>
              </RecordSection>
            )}

            <RecordSection title="Message for the patient" badge={<VisibleToPatient />}>
              <Label htmlFor="m-patient-notes" className="mb-2 block text-sm font-normal text-muted-foreground">Advice in plain words. She reads this in the app, under "Message from your doctor".</Label>
              <TextBlock id="m-patient-notes" value={r.patient_notes} saving={update.isPending} placeholder="For example: rest when you can, and come in at once if you notice bleeding."
                onSave={(v) => update.mutate({ patient_notes: v }, { onSuccess: () => toast.success("Message saved. The patient can see it."), onError: fail })} />
            </RecordSection>

            <RecordSection title="Internal notes and complications" badge={<HospitalOnly />}>
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <Label htmlFor="m-notes" className="mb-2 block">Clinical notes</Label>
                  <TextBlock id="m-notes" value={r.notes} saving={update.isPending} onSave={(v) => update.mutate({ notes: v }, { onSuccess: () => toast.success("Notes saved"), onError: fail })} />
                </div>
                <div>
                  <Label htmlFor="m-comp" className="mb-2 block">Complications</Label>
                  <TextBlock id="m-comp" value={r.complications} saving={update.isPending} onSave={(v) => update.mutate({ complications: v }, { onSuccess: () => toast.success("Complications saved"), onError: fail })} />
                </div>
              </div>
            </RecordSection>

            <EditDialog record={r} open={editing} onClose={() => setEditing(false)} />
            <VisitDialog record={r} open={recording} onClose={() => setRecording(false)} onRecorded={setOfferNext} />
          </div>
        )}
      </QueryState>
    </HospitalLayout>
  );
}
