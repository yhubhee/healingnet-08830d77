import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SectionCard } from "./SectionCard";
import { useAutosave, useReportSave } from "@/hooks/useConsultation";

const sb = supabase as any;
const VITALS: [string, string, string][] = [
  ["bp_systolic", "BP sys", "mmHg"], ["bp_diastolic", "BP dia", "mmHg"], ["pulse_rate", "Pulse", "bpm"],
  ["temperature_c", "Temp", "°C"], ["respiratory_rate", "Resp. rate", "/min"], ["spo2", "SpO₂", "%"],
  ["weight_kg", "Weight", "kg"], ["height_cm", "Height", "cm"], ["rbs_mmol_l", "RBS", "mmol/L"],
];
const SYSTEMS = ["CVS", "Respiratory", "Abdomen", "CNS", "Musculoskeletal"];
// Keys the queue check-in vitals JSON may use for each column.
const QUEUE_KEYS: Record<string, string[]> = {
  bp_systolic: ["bp_systolic", "systolic"], bp_diastolic: ["bp_diastolic", "diastolic"], pulse_rate: ["pulse_rate", "pulse", "heart_rate"],
  temperature_c: ["temperature_c", "temperature", "temp"], respiratory_rate: ["respiratory_rate", "resp_rate"], spo2: ["spo2", "oxygen_saturation"],
  weight_kg: ["weight_kg", "weight"], height_cm: ["height_cm", "height"], rbs_mmol_l: ["rbs_mmol_l", "rbs", "blood_sugar"],
};

type Form = Record<string, any>;
const blank = (): Form => ({ ...Object.fromEntries(VITALS.map(([k]) => [k, ""])), general_examination: "", systemic_examination: "", other_findings: "" });

function fromQueue(v: any): Form {
  const f: Form = {};
  if (!v || typeof v !== "object") return f;
  for (const [col, keys] of Object.entries(QUEUE_KEYS)) for (const k of keys) if (v[k] != null && v[k] !== "") { f[col] = String(v[k]); break; }
  if (!f.bp_systolic && typeof v.bp === "string" && v.bp.includes("/")) { const [s, d] = v.bp.split("/"); f.bp_systolic = s.trim(); f.bp_diastolic = d.trim(); }
  return f;
}

/** Soft adult flags, computed at render time only. */
function abnormal(k: string, val: number, f: Form): boolean {
  if (Number.isNaN(val)) return false;
  switch (k) {
    case "temperature_c": return val >= 37.5;
    case "spo2": return val < 95;
    case "bp_systolic": return val >= 140;
    case "bp_diastolic": return val >= 90;
    case "pulse_rate": return val < 50 || val > 120;
    default: return false;
  }
}

export function ExaminationCard({ consultation, row, readOnly, age, userId }: { consultation: any; row: any; readOnly: boolean; age: number | null; userId?: string }) {
  const [form, setForm] = useState<Form>(blank);
  const [loaded, setLoaded] = useState(false);
  const [fromNurse, setFromNurse] = useState(false);

  const { status, savedAt, flush, setBaseline } = useAutosave(form, async (v) => {
    const payload: any = { consultation_id: consultation.id, hospital_id: consultation.hospital_id, updated_by: userId, general_examination: v.general_examination, systemic_examination: v.systemic_examination, other_findings: v.other_findings };
    for (const [k] of VITALS) payload[k] = v[k] === "" ? null : Number(v[k]);
    if (!row?.recorded_by) { payload.recorded_by = userId; payload.recorded_by_role = "doctor"; }
    const { error } = await sb.from("consultation_examinations").upsert(payload, { onConflict: "consultation_id" });
    if (error) throw error;
  }, { enabled: loaded && !readOnly });
  useReportSave("examination", status, savedAt);

  useEffect(() => {
    if (loaded) return;
    (async () => {
      const f = blank();
      if (row) {
        for (const k of Object.keys(f)) if (row[k] != null) f[k] = String(row[k]);
        setFromNurse(!!row.recorded_by_role && row.recorded_by_role !== "doctor");
        setBaseline(f);
      } else if (consultation.checkin_id) {
        // Pre-fill from the nurse's queue vitals; this counts as an unsaved change.
        const { data } = await sb.from("patient_checkins").select("vitals").eq("id", consultation.checkin_id).maybeSingle();
        const q = fromQueue(data?.vitals);
        if (Object.keys(q).length) { Object.assign(f, q); setFromNurse(true); }
        setBaseline(blank());
      } else setBaseline(f);
      setForm(f); setLoaded(true);
    })();
  }, [row, loaded, consultation, setBaseline]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const w = Number(form.weight_kg), h = Number(form.height_cm) / 100;
  const bmi = w > 0 && h > 0 ? (w / (h * h)).toFixed(1) : null;
  const flagsOn = age == null || age >= 12;
  const insertSystem = (s: string) => set("systemic_examination", (form.systemic_examination ? form.systemic_examination.replace(/\s*$/, "\n") : "") + `${s}: `);
  const anyVital = VITALS.some(([k]) => form[k] !== "");
  const completion = anyVital && (form.general_examination || form.systemic_examination) ? "done" : anyVital || form.general_examination ? "progress" : "empty";

  return (
    <SectionCard title="Examination" completion={completion} actions={!readOnly && <Button size="sm" onClick={async () => { await flush(); toast.success("Examination saved"); }}><Save className="w-3.5 h-3.5" />Save</Button>}>
      {fromNurse && <p className="text-xs text-info">Vitals recorded by nurse</p>}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
        {VITALS.map(([k, label, unit]) => {
          const bad = flagsOn && form[k] !== "" && abnormal(k, Number(form[k]), form);
          return (
            <div key={k}>
              <Label className="text-[11px] text-muted-foreground">{label} <span className="opacity-70">{unit}</span></Label>
              <Input inputMode="decimal" disabled={readOnly} value={form[k]} onChange={(e) => set(k, e.target.value.replace(/[^\d.]/g, ""))} className={cn("h-9", bad && "border-warning text-warning")} />
            </div>
          );
        })}
        <div>
          <Label className="text-[11px] text-muted-foreground">BMI</Label>
          <div className="h-9 flex items-center px-3 rounded-md bg-muted/40 text-sm">{bmi ?? "—"}</div>
        </div>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">General examination</Label>
        <Textarea rows={2} disabled={readOnly} value={form.general_examination} onChange={(e) => set("general_examination", e.target.value)} className="mt-1" />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Systemic examination</Label>
        {!readOnly && <div className="flex flex-wrap gap-1.5 my-1">{SYSTEMS.map((s) => <button key={s} type="button" onClick={() => insertSystem(s)} className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted/40 hover:border-primary">+ {s}</button>)}</div>}
        <Textarea rows={4} disabled={readOnly} value={form.systemic_examination} onChange={(e) => set("systemic_examination", e.target.value)} />
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Other findings</Label>
        <Textarea rows={2} disabled={readOnly} value={form.other_findings} onChange={(e) => set("other_findings", e.target.value)} className="mt-1" />
      </div>
    </SectionCard>
  );
}
