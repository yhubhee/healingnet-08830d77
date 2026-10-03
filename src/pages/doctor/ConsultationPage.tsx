import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DoctorLayout } from "@/layouts/DoctorLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Loader2, AlertTriangle, ClipboardList, Video, CheckCircle2, CloudOff, Cloud } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { JoinCallButton } from "@/components/JoinCallButton";
import { HistoryCard } from "@/components/consultation/HistoryCard";
import { ExaminationCard } from "@/components/consultation/ExaminationCard";
import { InvestigationsCard } from "@/components/consultation/InvestigationsCard";
import { TreatmentCard } from "@/components/consultation/TreatmentCard";
import { PatientSummary } from "@/components/consultation/PatientSummary";
import { SaveRegistryContext, SaveStatus, ageFromDob, useAutosave, useConsultationCore, useConsultationRow, useReportSave } from "@/hooks/useConsultation";

const sb = supabase as any;

export default function ConsultationPage() {
  const { consultationId } = useParams();
  const core = useConsultationCore(consultationId);
  const history = useConsultationRow("consultation_history", consultationId);
  const exam = useConsultationRow("consultation_examinations", consultationId);
  const [userId, setUserId] = useState<string>();
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id)); }, []);

  // Page-wide save state collected from every card.
  const [saves, setSaves] = useState<Record<string, { s: SaveStatus; at: Date | null }>>({});
  const report = useCallback((k: string, s: SaveStatus, at: Date | null) => setSaves((p) => (p[k]?.s === s && p[k]?.at === at ? p : { ...p, [k]: { s, at } })), []);
  const overall = useMemo(() => {
    const v = Object.values(saves);
    if (v.some((x) => x.s === "error")) return { s: "error" as const };
    if (v.some((x) => x.s === "saving")) return { s: "saving" as const };
    if (v.some((x) => x.s === "dirty")) return { s: "dirty" as const };
    const at = v.map((x) => x.at).filter(Boolean).sort((a, b) => +b! - +a!)[0];
    return { s: at ? ("saved" as const) : ("idle" as const), at };
  }, [saves]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (overall.s === "dirty" || overall.s === "saving" || overall.s === "error") { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [overall.s]);

  const [allergies, setAllergies] = useState("");
  const [complaintCount, setComplaintCount] = useState(0);
  const onHistory = useCallback((f: any) => { setAllergies(f.allergies || ""); setComplaintCount(f.chief_complaints.length); }, []);

  if (core.isLoading || history.isLoading || exam.isLoading) {
    return <DoctorLayout><div className="flex items-center justify-center py-20 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin mr-2" />Loading consultation…</div></DoctorLayout>;
  }
  if (core.isError || history.isError || exam.isError) {
    return <DoctorLayout><div className="text-center py-20"><p className="text-destructive mb-3">Couldn't load this consultation.</p><Button onClick={() => { core.refetch(); history.refetch(); exam.refetch(); }}>Try again</Button></div></DoctorLayout>;
  }
  if (!core.data) return <DoctorLayout><p className="text-center py-20 text-muted-foreground">Consultation not found, or you don't have access to it.</p></DoctorLayout>;

  const c = core.data;
  const p = c.patients || {};
  const age = ageFromDob(p.date_of_birth);
  const female = (p.gender || "").toLowerCase().startsWith("f");
  const readOnly = !!c.submitted_at;
  const recordedAllergies = allergies || history.data?.allergies || "";

  const header = (
    <div className="sticky top-0 z-20 -mx-4 md:-mx-6 px-4 md:px-6 py-3 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="font-heading font-bold text-lg truncate">{p.first_name} {p.last_name}</h1>
        <span className="text-sm text-muted-foreground">{[age != null ? `${age}y` : null, p.gender, `#${String(p.id || "").slice(0, 8).toUpperCase()}`].filter(Boolean).join(" · ")}</span>
        {(p.blood_group || p.genotype) && <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{[p.blood_group, p.genotype].filter(Boolean).join(" / ")}</span>}
        {recordedAllergies && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Allergy: {recordedAllergies}</span>}
        {p.insurance_provider && <span className="text-xs px-2 py-0.5 rounded-full bg-info/15 text-info">{p.insurance_provider}</span>}
        {readOnly && <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success">Submitted {new Date(c.submitted_at).toLocaleString()}</span>}
        <Drawer>
          <DrawerTrigger asChild><Button size="sm" variant="outline" className="ml-auto lg:hidden"><ClipboardList className="w-4 h-4" />Summary</Button></DrawerTrigger>
          <DrawerContent className="max-h-[85vh]"><DrawerHeader><DrawerTitle>Patient summary</DrawerTitle></DrawerHeader><div className="px-4 pb-6 overflow-y-auto"><PatientSummary patientId={c.patient_id} consultationId={c.id} /></div></DrawerContent>
        </Drawer>
      </div>
    </div>
  );

  return (
    <DoctorLayout>
      <SaveRegistryContext.Provider value={report}>
        {header}
        <div className="grid lg:grid-cols-[1fr_320px] gap-6 mt-4 pb-28">
          <div className="space-y-4 min-w-0">
            {c.mode === "telemedicine" && (
              <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <Video className="w-5 h-5 text-primary" />
                <div className="flex-1 text-sm">Online consultation</div>
                {c.appointment_id ? <JoinCallButton appointmentId={c.appointment_id} meetingLink={c.patient_appointments?.meeting_link} patientPhone={p.phone} patientName={`${p.first_name} ${p.last_name}`} />
                  : <span className="text-xs text-muted-foreground">No video room linked</span>}
              </div>
            )}
            <HistoryCard consultation={c} row={history.data} readOnly={readOnly} showObstetric={female && age != null && age >= 12 && age <= 55} userId={userId} onChange={onHistory} />
            <ExaminationCard consultation={c} row={exam.data} readOnly={readOnly} age={age} userId={userId} />
            <InvestigationsCard consultation={c} readOnly={readOnly} />
            <TreatmentCard consultation={c} readOnly={readOnly} allergies={recordedAllergies} userId={userId} />
            <DiagnosisBlock consultation={c} readOnly={readOnly} />
          </div>
          <aside className="hidden lg:block">
            <div className="sticky top-24 bg-card border border-border rounded-xl p-4">
              <h2 className="font-heading font-semibold mb-3">Patient summary</h2>
              <PatientSummary patientId={c.patient_id} consultationId={c.id} />
            </div>
          </aside>
        </div>
        <SubmitBar consultation={c} readOnly={readOnly} overall={overall} complaintCount={complaintCount} />
      </SaveRegistryContext.Provider>
    </DoctorLayout>
  );
}

function DiagnosisBlock({ consultation, readOnly }: { consultation: any; readOnly: boolean }) {
  const init = { provisional_diagnosis: consultation.provisional_diagnosis || "", final_diagnosis: consultation.final_diagnosis || "", advice_plan: consultation.advice_plan || "", follow_up_date: consultation.follow_up_date || "" };
  const [f, setF] = useState(init);
  const qc = useQueryClient();
  const { status, savedAt, setBaseline } = useAutosave(f, async (v) => {
    const { error } = await sb.from("consultations").update({ ...v, follow_up_date: v.follow_up_date || null }).eq("id", consultation.id);
    if (error) throw error;
    qc.setQueryData(["consultation", consultation.id, "core"], (old: any) => (old ? { ...old, ...v } : old));
  }, { enabled: !readOnly });
  const baselined = useRef(false);
  if (!baselined.current) { setBaseline(init); baselined.current = true; }
  useReportSave("diagnosis", status, savedAt);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  return (
    <section className="bg-card border border-border rounded-xl p-4 space-y-3">
      <h2 className="font-heading font-semibold">Diagnosis & plan</h2>
      <div><Label className="text-xs">Provisional diagnosis <span className="text-destructive">*</span></Label><Input disabled={readOnly} value={f.provisional_diagnosis} onChange={(e) => set("provisional_diagnosis", e.target.value)} /></div>
      <div><Label className="text-xs">Final diagnosis</Label><Input disabled={readOnly} value={f.final_diagnosis} onChange={(e) => set("final_diagnosis", e.target.value)} /></div>
      <div><Label className="text-xs">Advice / plan</Label><Textarea disabled={readOnly} rows={3} value={f.advice_plan} onChange={(e) => set("advice_plan", e.target.value)} /></div>
      <div className="max-w-[200px]"><Label className="text-xs">Follow-up date</Label><Input type="date" disabled={readOnly} value={f.follow_up_date} onChange={(e) => set("follow_up_date", e.target.value)} /></div>
    </section>
  );
}

function SubmitBar({ consultation, readOnly, overall, complaintCount }: { consultation: any; readOnly: boolean; overall: { s: SaveStatus; at?: Date | null }; complaintCount: number }) {
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const qc = useQueryClient();
  const label = overall.s === "saving" ? "Saving…" : overall.s === "dirty" ? "Unsaved changes" : overall.s === "error" ? "Not saved, retrying" : overall.at ? `Saved ${overall.at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "All changes saved";
  const Icon = overall.s === "error" ? CloudOff : overall.s === "saving" ? Loader2 : Cloud;

  async function submit() {
    if (overall.s !== "saved" && overall.s !== "idle") return toast.error("Wait for your changes to finish saving.");
    if (!complaintCount) return toast.error("Add at least one chief complaint.");
    const fresh: any = qc.getQueryData(["consultation", consultation.id, "core"]);
    if (!(fresh?.provisional_diagnosis || "").trim()) return toast.error("Provisional diagnosis is required.");
    setBusy(true);
    const { data, error } = await sb.rpc("submit_consultation", { p_consultation_id: consultation.id });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Consultation submitted · ${data?.prescriptions ?? 0} prescription(s) sent`);
    qc.invalidateQueries({ queryKey: ["consultation", consultation.id] });
    nav("/doctor/appointments");
  }

  return (
    <div className="fixed bottom-0 inset-x-0 md:left-64 z-30 border-t border-border bg-background/95 backdrop-blur px-4 py-3 flex items-center gap-3">
      <span className={cn("text-xs flex items-center gap-1.5", overall.s === "error" ? "text-destructive" : "text-muted-foreground")}>
        <Icon className={cn("w-4 h-4", overall.s === "saving" && "animate-spin")} />{readOnly ? "Read only" : label}
      </span>
      {!readOnly && <Button className="ml-auto" disabled={busy} onClick={submit}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}Submit consultation</Button>}
    </div>
  );
}
