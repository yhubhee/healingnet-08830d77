import { PatientLayout } from "@/layouts/PatientLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { runTriage, SYMPTOM_CHIPS, TriageResult } from "@/lib/triage/engine";
import { rankHospitals, RankedHospital } from "@/lib/triage/proximity";
import { Loader2, MapPin, AlertTriangle, ArrowRight, ArrowLeft, CheckCircle2, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function PatientTriage() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [freeText, setFreeText] = useState("");
  const [duration, setDuration] = useState<"today" | "few_days" | "weeks">("few_days");
  const [selfSeverity, setSelfSeverity] = useState(5);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hospitals, setHospitals] = useState<RankedHospital[]>([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [booking, setBooking] = useState<string | null>(null);

  function toggle(sym: string) {
    setSymptoms((prev) => prev.includes(sym) ? prev.filter((s) => s !== sym) : [...prev, sym]);
  }

  function compute() {
    const r = runTriage({ symptoms, freeText, duration, selfSeverity });
    setResult(r);
    setStep(3);
  }

  async function loadHospitals(r: TriageResult) {
    setLoadingHospitals(true);
    try {
      const { data: hs } = await supabase.from("hospitals").select("id, name, city, lat, lng").eq("is_active", true);
      const { data: docs } = await supabase.from("doctors").select("id, specialty").ilike("specialty", `%${r.specialty}%`);
      const docIds = (docs || []).map((d: any) => d.id);
      const { data: hd } = docIds.length
        ? await supabase.from("hospital_doctors").select("hospital_id").in("doctor_id", docIds).eq("is_active", true)
        : { data: [] as any[] };
      const set = new Set((hd || []).map((r: any) => r.hospital_id));
      setHospitals(rankHospitals(coords, (hs || []) as any, set));
    } catch (e: any) {
      toast.error("Failed to load hospitals");
    } finally {
      setLoadingHospitals(false);
    }
  }

  useEffect(() => {
    if (step === 4 && result) {
      if (!coords && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => loadHospitals(result),
        );
      } else {
        loadHospitals(result);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, coords]);

  async function bookAt(hospitalId: string) {
    if (!result) return;
    setBooking(hospitalId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Please sign in"); nav("/login"); return; }
      const { data: patient } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
      if (!patient) { toast.error("Patient profile not found"); return; }

      // Save triage session
      await supabase.from("triage_sessions").insert({
        patient_id: patient.id,
        symptoms: [...symptoms, ...(freeText ? [freeText] : [])],
        duration,
        severity_self: selfSeverity,
        severity_score: result.severity,
        recommended_specialty: result.specialty,
        urgency: result.urgency,
        recommended_hospitals: hospitals,
        chosen_hospital_id: hospitalId,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      } as any);

      // Create appointment request
      const today = new Date();
      const offsetDays = result.urgency === "emergency" ? 0 : result.urgency === "urgent" ? 1 : result.urgency === "soon" ? 3 : 7;
      const date = new Date(today.getTime() + offsetDays * 24 * 3600 * 1000);
      const { error } = await supabase.from("patient_appointments").insert({
        patient_id: patient.id,
        hospital_id: hospitalId,
        requested_date: date.toISOString().slice(0, 10),
        reason: `[AI Triage] ${result.specialty} • Severity ${result.severity}/10 • Symptoms: ${symptoms.join(", ")}${freeText ? ` • ${freeText}` : ""}`,
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
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Stethoscope className="w-6 h-6 text-primary" />AI Symptom Triage</h1>
          <p className="text-muted-foreground text-sm">Answer a few questions — we'll match you to the right specialty and nearest hospital.</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className={cn("h-1.5 flex-1 rounded-full", step >= n ? "bg-primary" : "bg-muted")} />
          ))}
        </div>

        {step === 1 && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-heading font-bold mb-1">Step 1 of 4 — What are you feeling?</h2>
            <p className="text-sm text-muted-foreground mb-4">Tap all that apply.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {SYMPTOM_CHIPS.map((s) => (
                <button key={s} onClick={() => toggle(s)}
                  className={cn("px-3 py-1.5 rounded-full text-sm border transition-colors",
                    symptoms.includes(s) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50")}>
                  {s}
                </button>
              ))}
            </div>
            <label className="text-sm">Anything else? (optional)
              <textarea value={freeText} onChange={(e) => setFreeText(e.target.value)}
                placeholder="e.g. pain radiates to my left arm; pregnant 28 weeks; child age 5…"
                className="mt-1 w-full bg-background border border-border rounded-lg p-2 text-sm" rows={3} maxLength={500} />
            </label>
            <div className="flex justify-end mt-4">
              <button disabled={symptoms.length === 0 && !freeText.trim()} onClick={() => setStep(2)}
                className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg disabled:opacity-40">
                Continue <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-heading font-bold mb-1">Step 2 of 4 — How long & how bad?</h2>
            <p className="text-sm text-muted-foreground mb-4">Helps us judge urgency.</p>
            <div className="mb-4">
              <p className="text-sm mb-2">How long has this been going on?</p>
              <div className="flex gap-2 flex-wrap">
                {[["today", "Today"], ["few_days", "A few days"], ["weeks", "Weeks or longer"]].map(([k, l]) => (
                  <button key={k} onClick={() => setDuration(k as any)}
                    className={cn("px-3 py-1.5 rounded-lg text-sm border", duration === k ? "bg-primary text-primary-foreground border-primary" : "border-border")}>{l}</button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1"><span>How severe does it feel? (1–10)</span><span className="font-bold">{selfSeverity}</span></div>
              <input type="range" min={1} max={10} value={selfSeverity} onChange={(e) => setSelfSeverity(Number(e.target.value))} className="w-full" />
            </div>
            <div className="flex justify-between mt-4">
              <button onClick={() => setStep(1)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-border"><ArrowLeft className="w-4 h-4" />Back</button>
              <button onClick={compute} className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg">Get assessment <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {step === 3 && result && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-heading font-bold mb-3">Step 3 of 4 — Your assessment</h2>
            <div className={cn("rounded-xl p-4 border mb-4",
              result.urgency === "emergency" ? "bg-destructive/10 border-destructive/30 text-destructive"
                : result.urgency === "urgent" ? "bg-warning/10 border-warning/30"
                : result.urgency === "soon" ? "bg-info/10 border-info/30"
                : "bg-success/10 border-success/30")}>
              <div className="flex items-center gap-2 mb-1">
                {result.urgency === "emergency" && <AlertTriangle className="w-5 h-5" />}
                <span className="font-bold uppercase text-xs tracking-wider">{result.urgency}</span>
                <span className="ml-auto font-heading text-2xl">{result.severity}/10</span>
              </div>
              <p className="text-sm">{result.guidance}</p>
            </div>
            <div className="space-y-2 text-sm">
              <Row label="Recommended specialty" value={result.specialty} />
              <Row label="Severity score" value={`${result.severity}/10`} />
              <Row label="Urgency" value={result.urgency} />
              <Row label="Symptoms" value={symptoms.join(", ") || "—"} />
            </div>
            <div className="flex justify-between mt-5">
              <button onClick={() => setStep(2)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-border"><ArrowLeft className="w-4 h-4" />Back</button>
              <button onClick={() => setStep(4)} className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg">Find a hospital <ArrowRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}

        {step === 4 && result && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h2 className="font-heading font-bold mb-3">Step 4 of 4 — Closest matching hospitals</h2>
            <p className="text-sm text-muted-foreground mb-4">Ranked by specialty match and distance from you.</p>
            {loadingHospitals && <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="w-4 h-4 animate-spin" />Finding hospitals…</div>}
            {!loadingHospitals && hospitals.length === 0 && <p className="text-sm text-muted-foreground">No hospitals found yet.</p>}
            <div className="space-y-2">
              {hospitals.map((h) => (
                <div key={h.id} className="flex items-center gap-3 p-3 rounded-lg border border-border">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><MapPin className="w-5 h-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium flex items-center gap-2">{h.name}{h.hasSpecialty && <CheckCircle2 className="w-4 h-4 text-success" />}</div>
                    <div className="text-xs text-muted-foreground">{h.city || "—"} {h.distanceKm != null && `• ${h.distanceKm.toFixed(1)} km away`} {h.hasSpecialty ? "• Has " + result.specialty : "• Specialty match unconfirmed"}</div>
                  </div>
                  <button onClick={() => bookAt(h.id)} disabled={booking === h.id}
                    className="bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
                    {booking === h.id ? "Booking…" : "Book"}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-5">
              <button onClick={() => setStep(3)} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-border"><ArrowLeft className="w-4 h-4" />Back</button>
            </div>
          </div>
        )}
      </div>
    </PatientLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 capitalize"><span className="text-muted-foreground">{label}</span><span className="font-medium text-right">{value}</span></div>;
}
