import { PatientLayout } from "@/layouts/PatientLayout";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rankHospitals, RankedHospital } from "@/lib/triage/proximity";
import {
  Loader2, MapPin, AlertTriangle, ArrowRight, ArrowLeft, CheckCircle2,
  Stethoscope, Activity, HelpCircle, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

type Sex = "male" | "female";
interface Evidence { id: string; name: string; present: boolean }
interface Question { id: string; text: string; explanation?: string }
interface Condition { name: string; probability: number; description?: string }
interface NurseResponse {
  new_evidence?: Evidence[];
  next_question?: Question;
  should_stop: boolean;
  differential: Condition[];
  triage_level: string;
  triage_label: string;
  recommended_specialty: string;
  red_flags?: string[];
  guidance: string;
}

const TRIAGE_STYLE: Record<string, { label: string; cls: string }> = {
  self_care: { label: "Self-care", cls: "bg-success/10 border-success/30 text-success" },
  consultation: { label: "See a GP soon", cls: "bg-info/10 border-info/30 text-info" },
  consultation_24: { label: "See a GP within 24h", cls: "bg-warning/10 border-warning/30 text-warning" },
  emergency_ambulance: { label: "Call an ambulance", cls: "bg-destructive/10 border-destructive/30 text-destructive" },
  emergency: { label: "Emergency — go to A&E", cls: "bg-destructive/10 border-destructive/30 text-destructive" },
};

const MAX_QUESTIONS = 8;

export default function PatientTriage() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [patient, setPatient] = useState<any>(null);
  const [age, setAge] = useState<number | "">("");
  const [sex, setSex] = useState<Sex | "">("");
  const [savingDemo, setSavingDemo] = useState(false);

  const [freeText, setFreeText] = useState("");
  const [parsing, setParsing] = useState(false);

  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [askedIds, setAskedIds] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [answering, setAnswering] = useState(false);
  const [latestResp, setLatestResp] = useState<NurseResponse | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hospitals, setHospitals] = useState<RankedHospital[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [booking, setBooking] = useState<string | null>(null);

  const progress = useMemo(
    () => Math.min(100, Math.round((askedIds.length / MAX_QUESTIONS) * 100)),
    [askedIds.length],
  );

  // Load patient + demographics gate
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: p } = await supabase.from("patients").select("*").eq("user_id", user.id).maybeSingle();
      setPatient(p);
      if (p) {
        if (p.date_of_birth) {
          const yrs = Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / (365.25 * 864e5));
          setAge(yrs);
        }
        if (p.gender === "male" || p.gender === "female") setSex(p.gender);
        if (p.date_of_birth && (p.gender === "male" || p.gender === "female")) {
          setStep(2);
        }
      }
    })();
  }, []);

  async function saveDemographics() {
    if (!patient || age === "" || !sex) return;
    setSavingDemo(true);
    try {
      const dobYear = new Date().getFullYear() - Number(age);
      const dob = patient.date_of_birth || `${dobYear}-01-01`;
      const { error } = await supabase.from("patients")
        .update({ date_of_birth: dob, gender: sex })
        .eq("id", patient.id);
      if (error) throw error;
      setStep(2);
    } catch (e: any) {
      toast.error(e.message || "Could not save");
    } finally {
      setSavingDemo(false);
    }
  }

  async function callNurse(payload: any): Promise<NurseResponse | null> {
    const { data, error } = await supabase.functions.invoke("triage-nurse", { body: payload });
    if (error || (data as any)?.error) {
      toast.error((data as any)?.error || error?.message || "AI nurse unavailable");
      return null;
    }
    return data as NurseResponse;
  }

  async function startInterview() {
    if (!freeText.trim()) return;
    setParsing(true);
    const r = await callNurse({ stage: "parse", age, sex, free_text: freeText });
    setParsing(false);
    if (!r) return;
    const ev = r.new_evidence || [];
    setEvidence(ev);
    setLatestResp(r);
    if (r.should_stop || !r.next_question) {
      setStep(4);
      loadResults(r);
    } else {
      setCurrentQ(r.next_question);
      setAskedIds([r.next_question.id]);
      setStep(3);
    }
  }

  async function answer(value: "yes" | "no" | "unknown") {
    if (!currentQ) return;
    setAnswering(true);
    let nextEvidence = evidence;
    if (value !== "unknown") {
      nextEvidence = [...evidence, { id: currentQ.id, name: currentQ.text, present: value === "yes" }];
      setEvidence(nextEvidence);
    }
    const forceStop = askedIds.length >= MAX_QUESTIONS;
    const r = await callNurse({
      stage: "next", age, sex, evidence: nextEvidence, asked_ids: askedIds,
    });
    setAnswering(false);
    if (!r) return;
    setLatestResp(r);
    if (r.should_stop || forceStop || !r.next_question) {
      setCurrentQ(null);
      setStep(4);
      loadResults(r);
    } else {
      setCurrentQ(r.next_question);
      setAskedIds((prev) => [...prev, r.next_question!.id]);
    }
  }

  async function loadResults(r: NurseResponse) {
    setLoadingHospitals(true);
    try {
      let c = coords;
      if (!c && navigator.geolocation) {
        c = await new Promise((res) => navigator.geolocation.getCurrentPosition(
          (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => res(null as any),
          { timeout: 4000 },
        ));
        if (c) setCoords(c);
      }
      const { data: hs } = await supabase.from("hospitals").select("id, name, city, lat, lng").eq("is_active", true);
      const { data: docs } = await supabase.from("doctors").select("id, specialty").ilike("specialty", `%${r.recommended_specialty}%`);
      const docIds = (docs || []).map((d: any) => d.id);
      const { data: hd } = docIds.length
        ? await supabase.from("hospital_doctors").select("hospital_id").in("doctor_id", docIds).eq("is_active", true)
        : { data: [] as any[] };
      const set = new Set((hd || []).map((x: any) => x.hospital_id));
      setHospitals(rankHospitals(c, (hs || []) as any, set));

      // Save session
      const { data: { user } } = await supabase.auth.getUser();
      if (user && patient) {
        await supabase.from("triage_sessions").insert({
          patient_id: patient.id,
          symptoms: evidence.map((e) => `${e.name}:${e.present ? "yes" : "no"}`).concat(freeText ? [freeText] : []),
          severity_self: 0,
          severity_score: Math.round(((r.differential[0]?.probability || 0.3) * 10)),
          recommended_specialty: r.recommended_specialty,
          urgency: r.triage_level,
          recommended_hospitals: r as any,
          lat: c?.lat ?? null, lng: c?.lng ?? null,
        } as any);
      }
    } finally {
      setLoadingHospitals(false);
    }
  }

  async function bookAt(hospitalId: string) {
    if (!latestResp || !patient) return;
    setBooking(hospitalId);
    try {
      const offsetDays = latestResp.triage_level.startsWith("emergency") ? 0
        : latestResp.triage_level === "consultation_24" ? 1
        : latestResp.triage_level === "consultation" ? 3 : 7;
      const date = new Date(Date.now() + offsetDays * 864e5);
      const { error } = await supabase.from("patient_appointments").insert({
        patient_id: patient.id,
        hospital_id: hospitalId,
        requested_date: date.toISOString().slice(0, 10),
        reason: `[AI Nurse] ${latestResp.recommended_specialty} • ${latestResp.triage_label}`,
        status: "pending",
      } as any);
      if (error) throw error;
      toast.success("Appointment requested");
      nav("/patient/appointments");
    } catch (e: any) {
      toast.error(e.message || "Booking failed");
    } finally {
      setBooking(null);
    }
  }

  return (
    <PatientLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> AI Nurse — Symptom Triage
          </h1>
          <p className="text-muted-foreground text-sm">An LLM-powered medical triage assistant. Not a diagnosis — guidance only.</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={cn("h-1.5 flex-1 rounded-full", step >= n ? "bg-primary" : "bg-muted")} />
          ))}
        </div>

        {/* STEP 1: Demographics */}
        {step === 1 && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-heading font-bold mb-1">Step 1 of 4 — A bit about you</h2>
            <p className="text-sm text-muted-foreground mb-4">We use this to personalise the triage.</p>
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <label className="text-sm">Age
                <input type="number" min={0} max={120} value={age}
                  onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
                  className="mt-1 w-full bg-background border border-border rounded-lg p-2" />
              </label>
              <div className="text-sm">
                <span>Biological sex</span>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {(["male", "female"] as Sex[]).map((s) => (
                    <button key={s} type="button" onClick={() => setSex(s)}
                      className={cn("p-2 rounded-lg border capitalize",
                        sex === s ? "bg-primary text-primary-foreground border-primary" : "border-border")}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end">
              <button disabled={age === "" || !sex || savingDemo} onClick={saveDemographics}
                className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg disabled:opacity-40">
                {savingDemo ? "Saving…" : <>Continue <ArrowRight className="w-4 h-4" /></>}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Initial symptoms */}
        {step === 2 && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-heading font-bold mb-1">Step 2 of 4 — Tell us what's wrong</h2>
            <p className="text-sm text-muted-foreground mb-4">In your own words. Mention what you feel, when it started, anything that makes it worse or better.</p>
            <textarea value={freeText} onChange={(e) => setFreeText(e.target.value)} rows={6} maxLength={1500}
              placeholder="e.g. For the past 2 days I've had a sharp pain in the lower right side of my belly, with nausea and a low fever…"
              className="w-full bg-background border border-border rounded-lg p-3 text-sm" />
            <div className="flex justify-between mt-4">
              <button onClick={() => setStep(1)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-border"><ArrowLeft className="w-4 h-4" />Back</button>
              <button onClick={startInterview} disabled={!freeText.trim() || parsing}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg disabled:opacity-40">
                {parsing ? (<><Loader2 className="w-4 h-4 animate-spin" /> Analysing symptoms…</>)
                  : (<>Start interview <ArrowRight className="w-4 h-4" /></>)}
              </button>
            </div>
            {parsing && <p className="text-xs text-muted-foreground mt-3">NLP parsing your text into clinical concepts…</p>}
          </div>
        )}

        {/* STEP 3: Diagnostic interview */}
        {step === 3 && currentQ && (
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Question {askedIds.length} of up to {MAX_QUESTIONS}</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            <div className="bg-card border border-border rounded-xl p-8">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary mb-3">
                <Activity className="w-4 h-4" /> Diagnostic question
              </div>
              <h2 className="font-heading text-xl font-bold mb-2">{currentQ.text}</h2>
              {currentQ.explanation && <p className="text-sm text-muted-foreground mb-6">{currentQ.explanation}</p>}
              <div className="grid grid-cols-3 gap-3 mt-6">
                <AnswerBtn disabled={answering} onClick={() => answer("yes")} label="Yes" tone="success" />
                <AnswerBtn disabled={answering} onClick={() => answer("no")} label="No" tone="destructive" />
                <AnswerBtn disabled={answering} onClick={() => answer("unknown")} label="I don't know" tone="muted" />
              </div>
              {answering && <p className="text-xs text-muted-foreground mt-4 flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin" /> AI nurse thinking…</p>}
            </div>
          </div>
        )}

        {/* STEP 4: Results */}
        {step === 4 && latestResp && (
          <div className="space-y-4">
            <div className={cn("rounded-xl p-5 border", TRIAGE_STYLE[latestResp.triage_level]?.cls || "bg-muted")}>
              <div className="flex items-center gap-2 mb-1">
                {latestResp.triage_level.startsWith("emergency") && <AlertTriangle className="w-5 h-5" />}
                <span className="uppercase tracking-wider text-xs font-bold">{TRIAGE_STYLE[latestResp.triage_level]?.label || latestResp.triage_level}</span>
              </div>
              <h2 className="font-heading text-xl font-bold">{latestResp.triage_label}</h2>
              <p className="text-sm mt-1 opacity-90">{latestResp.guidance}</p>
              {latestResp.red_flags && latestResp.red_flags.length > 0 && (
                <ul className="mt-3 text-sm space-y-1">
                  {latestResp.red_flags.map((r, i) => <li key={i} className="flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-1 shrink-0" />{r}</li>)}
                </ul>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Conditions */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-heading font-bold mb-3 flex items-center gap-2"><Stethoscope className="w-4 h-4 text-primary" /> Possible conditions</h3>
                <p className="text-xs text-muted-foreground mb-3">Ranked by likelihood from your responses. Not a diagnosis.</p>
                <div className="space-y-3">
                  {latestResp.differential.slice(0, 5).map((c, i) => {
                    const pct = Math.round(c.probability * 100);
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium">{c.name}</span>
                          <span className="text-muted-foreground">{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Care navigation */}
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="font-heading font-bold mb-1 flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Care navigation</h3>
                <p className="text-xs text-muted-foreground mb-3">Recommended specialty: <span className="text-foreground font-medium">{latestResp.recommended_specialty}</span></p>
                {loadingHospitals && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" />Finding hospitals…</div>}
                {!loadingHospitals && hospitals.length === 0 && <p className="text-sm text-muted-foreground">No hospitals found.</p>}
                <div className="space-y-2">
                  {hospitals.slice(0, 6).map((h) => (
                    <div key={h.id} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm flex items-center gap-1">{h.name}{h.hasSpecialty && <CheckCircle2 className="w-3 h-3 text-success" />}</div>
                        <div className="text-xs text-muted-foreground truncate">{h.city || "—"}{h.distanceKm != null && ` • ${h.distanceKm.toFixed(1)} km`}</div>
                      </div>
                      <button onClick={() => bookAt(h.id)} disabled={booking === h.id}
                        className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs disabled:opacity-50">
                        {booking === h.id ? "…" : "Book"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => { setStep(2); setEvidence([]); setAskedIds([]); setCurrentQ(null); setLatestResp(null); setHospitals([]); }}
                className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-border"><ArrowLeft className="w-4 h-4" />Start over</button>
            </div>
          </div>
        )}
      </div>
    </PatientLayout>
  );
}

function AnswerBtn({ label, onClick, disabled, tone }: { label: string; onClick: () => void; disabled?: boolean; tone: "success" | "destructive" | "muted" }) {
  const cls = tone === "success" ? "border-success/50 hover:bg-success/10 text-success"
    : tone === "destructive" ? "border-destructive/50 hover:bg-destructive/10 text-destructive"
    : "border-border hover:bg-muted text-muted-foreground";
  return (
    <button disabled={disabled} onClick={onClick}
      className={cn("p-4 rounded-xl border-2 font-medium transition-colors disabled:opacity-50", cls)}>
      <div className="flex items-center justify-center gap-2">
        {tone === "success" && <CheckCircle2 className="w-4 h-4" />}
        {tone === "destructive" && <span className="text-lg leading-none">✕</span>}
        {tone === "muted" && <HelpCircle className="w-4 h-4" />}
        {label}
      </div>
    </button>
  );
}
