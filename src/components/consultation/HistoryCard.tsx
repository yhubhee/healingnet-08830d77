import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { X, Plus, Pencil, Save } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "./SectionCard";
import { useAutosave, useRecorderName, useReportSave } from "@/hooks/useConsultation";
import { useQuery } from "@tanstack/react-query";

const sb = supabase as any;
const SUGGESTIONS = ["fever", "headache", "cough", "sneezing", "abdominal pain", "vomiting", "diarrhoea", "chest pain", "difficulty breathing", "dizziness", "body weakness/pains", "rash", "waist/back pain"];
const EXTRA: [string, string][] = [
  ["past_medical_history", "Past medical history"], ["past_surgical_history", "Past surgical history"],
  ["drug_history", "Drug history"], ["allergies", "Allergies"], ["family_history", "Family history"],
  ["social_history", "Social history"], ["review_of_systems", "Review of systems"],
];

export type Complaint = { name: string; duration_value?: number | null; duration_unit?: string; note?: string };
type Form = Record<string, any> & { chief_complaints: Complaint[] };

const blank = (): Form => ({ chief_complaints: [], history_of_presenting_complaint: "", past_medical_history: "", past_surgical_history: "", drug_history: "", allergies: "", family_history: "", social_history: "", review_of_systems: "", lmp: "", edd: "", obstetric_notes: "" });

export function HistoryCard({ consultation, row, readOnly, showObstetric, userId, onChange }: {
  consultation: any; row: any; readOnly: boolean; showObstetric: boolean; userId?: string; onChange?: (f: Form) => void;
}) {
  const [form, setForm] = useState<Form>(blank);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [openExtra, setOpenExtra] = useState<Record<string, boolean>>({});
  const recorder = useRecorderName(row?.recorded_by && row.recorded_by !== userId ? row.recorded_by : null);

  // Patient-reported symptoms from AI triage (skipped silently if not readable).
  const triage = useQuery({
    queryKey: ["consultation", consultation.id, "triage"],
    queryFn: async () => {
      const { data } = await sb.from("triage_sessions").select("symptoms").eq("patient_id", consultation.patient_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const list: string[] = Array.isArray(data?.symptoms) ? data.symptoms : [];
      return list.filter((s) => !s.endsWith(":no")).map((s) => s.replace(/:yes$/, "")).slice(0, 8);
    },
  });

  const { status, savedAt, flush, setBaseline } = useAutosave(form, async (v) => {
    const payload = { ...v, lmp: v.lmp || null, edd: v.edd || null, consultation_id: consultation.id, hospital_id: consultation.hospital_id, updated_by: userId, ...(row?.recorded_by ? {} : { recorded_by: userId, recorded_by_role: "doctor" }) };
    const { error } = await sb.from("consultation_history").upsert(payload, { onConflict: "consultation_id" });
    if (error) throw error;
  }, { enabled: loaded && !readOnly });
  useReportSave("history", status, savedAt);

  useEffect(() => {
    if (loaded) return;
    const f = blank();
    if (row) for (const k of Object.keys(f)) if (row[k] != null) f[k] = row[k];
    setForm(f); setBaseline(f); setLoaded(true);
    setEditing(!row);
  }, [row, loaded, setBaseline]);

  useEffect(() => { onChange?.(form); }, [form, onChange]);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const addComplaint = (name: string) => {
    const n = name.trim().toLowerCase();
    if (!n || form.chief_complaints.some((c) => c.name === n)) return;
    set("chief_complaints", [...form.chief_complaints, { name: n, duration_value: null, duration_unit: "days", note: "" }]);
    setDraft("");
  };
  const updComplaint = (i: number, patch: Partial<Complaint>) =>
    set("chief_complaints", form.chief_complaints.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const setLmp = (v: string) => {
    const edd = v ? new Date(new Date(v).getTime() + 280 * 864e5).toISOString().slice(0, 10) : "";
    setForm((f) => ({ ...f, lmp: v, edd: f.edd && f.lmp ? f.edd : edd }));
  };

  const canEdit = editing && !readOnly;
  const completion = form.chief_complaints.length && form.history_of_presenting_complaint ? "done" : form.chief_complaints.length ? "progress" : "empty";

  return (
    <SectionCard title="History" completion={completion} actions={!readOnly && (editing
      ? <Button size="sm" onClick={async () => { await flush(); toast.success("History saved"); setEditing(false); }}><Save className="w-3.5 h-3.5" />Save</Button>
      : <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="w-3.5 h-3.5" />Edit</Button>)}>
      {recorder.data && row?.updated_at && (
        <p className="text-xs text-muted-foreground">Recorded by {recorder.data.first_name} {recorder.data.last_name} ({recorder.data.role}) at {new Date(row.updated_at).toLocaleString()}</p>
      )}

      <div>
        <Label className="text-xs text-muted-foreground">C/O (chief complaints)</Label>
        {form.chief_complaints.length === 0 && !canEdit && <p className="text-sm text-muted-foreground">No complaints recorded.</p>}
        <div className="space-y-2 mt-1">
          {form.chief_complaints.map((c, i) => (
            <div key={c.name} className="rounded-lg border border-border bg-muted/30 p-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium capitalize text-sm">{c.name}</span>
                {canEdit ? (
                  <>
                    <Input type="number" min={0} className="w-16 h-8" placeholder="#" value={c.duration_value ?? ""} onChange={(e) => updComplaint(i, { duration_value: e.target.value ? Number(e.target.value) : null })} />
                    <select className="h-8 rounded-md border border-input bg-background px-2 text-sm" value={c.duration_unit || "days"} onChange={(e) => updComplaint(i, { duration_unit: e.target.value })}>
                      <option value="days">days</option><option value="weeks">weeks</option><option value="months">months</option>
                    </select>
                    <button type="button" className="ml-auto text-muted-foreground hover:text-destructive" aria-label={`Remove ${c.name}`} onClick={() => set("chief_complaints", form.chief_complaints.filter((_, j) => j !== i))}><X className="w-4 h-4" /></button>
                  </>
                ) : c.duration_value ? <span className="text-xs text-muted-foreground">× {c.duration_value} {c.duration_unit}</span> : null}
              </div>
              {canEdit ? <Input className="h-8 mt-2" placeholder="Note (optional)" value={c.note || ""} onChange={(e) => updComplaint(i, { note: e.target.value })} />
                : c.note ? <p className="text-xs text-muted-foreground mt-1">{c.note}</p> : null}
            </div>
          ))}
        </div>
        {canEdit && (
          <>
            <div className="flex gap-2 mt-2">
              <Input placeholder="Type a complaint and press Enter" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addComplaint(draft); } }} />
              <Button type="button" size="icon" variant="outline" onClick={() => addComplaint(draft)} aria-label="Add complaint"><Plus className="w-4 h-4" /></Button>
            </div>
            {!!triage.data?.length && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Patient-reported</p>
                <div className="flex flex-wrap gap-1.5">{triage.data.map((s) => <Chip key={s} label={s} onClick={() => addComplaint(s)} tone="info" />)}</div>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUGGESTIONS.filter((s) => !form.chief_complaints.some((c) => c.name === s)).map((s) => <Chip key={s} label={s} onClick={() => addComplaint(s)} />)}
            </div>
          </>
        )}
      </div>

      <Field label="History of presenting complaint" value={form.history_of_presenting_complaint} edit={canEdit} onChange={(v) => set("history_of_presenting_complaint", v)} rows={4} />

      {EXTRA.map(([k, label]) => {
        const has = !!form[k];
        if (!canEdit && !has) return null;
        const open = openExtra[k] ?? has;
        return (
          <div key={k}>
            <button type="button" className="text-sm font-medium text-primary" onClick={() => setOpenExtra({ ...openExtra, [k]: !open })}>{open ? "−" : "+"} {label}</button>
            {open && <Field label="" value={form[k]} edit={canEdit} onChange={(v) => set(k, v)} />}
          </div>
        );
      })}

      {showObstetric && (
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">LMP</Label><Input type="date" disabled={!canEdit} value={form.lmp || ""} onChange={(e) => setLmp(e.target.value)} /></div>
          <div><Label className="text-xs">EDD</Label><Input type="date" disabled={!canEdit} value={form.edd || ""} onChange={(e) => set("edd", e.target.value)} /></div>
          <div className="col-span-2"><Field label="Obstetric notes" value={form.obstetric_notes} edit={canEdit} onChange={(v) => set("obstetric_notes", v)} /></div>
        </div>
      )}
    </SectionCard>
  );
}

export function Chip({ label, onClick, tone }: { label: string; onClick: () => void; tone?: "info" }) {
  return (
    <button type="button" onClick={onClick} className={tone === "info" ? "text-xs px-2.5 py-1 rounded-full border border-info/40 bg-info/10 text-info capitalize" : "text-xs px-2.5 py-1 rounded-full border border-border bg-muted/40 hover:border-primary capitalize"}>
      + {label}
    </button>
  );
}

function Field({ label, value, edit, onChange, rows = 2 }: { label: string; value: string; edit: boolean; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      {edit ? <Textarea rows={rows} value={value || ""} onChange={(e) => onChange(e.target.value)} className="mt-1" />
        : <p className="text-sm whitespace-pre-wrap mt-1">{value || <span className="text-muted-foreground">—</span>}</p>}
    </div>
  );
}
