import { PatientLayout } from "@/layouts/PatientLayout";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TriageStep1DemographicsStep } from "@/components/triage/TriageStep1DemographicsStep";
import { TriageStep2SymptomsStep } from "@/components/triage/TriageStep2SymptomsStep";
import { TriageStep3InterviewStep } from "@/components/triage/TriageStep3InterviewStep";
import { TriageStep4ResultsStep } from "@/components/triage/TriageStep4ResultsStep";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { SkipTriageModal } from "@/components/triage/SkipTriageModal";
import { friendlyError } from "@/lib/errors";

type Sex = "male" | "female";
interface Evidence { id: string; name: string; present: boolean }
interface Question {
  id: string;
  text: string;
  explanation?: string;
  type?: "boolean" | "multiple_choice" | "scale" | "duration" | "open_text";
  options?: string[] | [string, string];
  unit?: string;
}
interface Condition { name: string; probability: number; description?: string }
interface NurseResponse {
  new_evidence?: Evidence[];
  next_question?: Question;
  should_stop: boolean;
  differential: Condition[];
  severity_score?: number;
  triage_level: string;
  triage_label: string;
  recommended_specialty: string;
  red_flags?: string[];
  guidance: string;
}

const MAX_QUESTIONS = 8;

// Friendly text for triage-nurse HTTP errors.
const TRIAGE_ERRORS: Record<number, string> = {
  401: "Please sign in again.",
  429: "Too many requests. Wait a minute.",
  400: "Something in your answers couldn't be read. Please try again.",
};

export default function PatientTriage() {
  const [step, setStep] = useState(1);
  const [patient, setPatient] = useState<any>(null);
  const [age, setAge] = useState<number | "">("");
  const [sex, setSex] = useState<Sex | "">("");
  const [savingDemo, setSavingDemo] = useState(false);

  // ?complaint= (from the public site's reason chips) pre-fills the first complaint box only.
  const [params] = useSearchParams();
  const [freeText, setFreeText] = useState(() =>
    (params.get("complaint") ?? "").replace(/[\u0000-\u001f\u007f<>]/g, " ").trim().slice(0, 200));
  const [parsing, setParsing] = useState(false);
  const [skipTriageOpen, setSkipTriageOpen] = useState(false);

  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [askedIds, setAskedIds] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [answering, setAnswering] = useState(false);
  const [latestResp, setLatestResp] = useState<NurseResponse | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [skipped, setSkipped] = useState(false);
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
      toast.error(friendlyError(e, "Could not save"));
    } finally {
      setSavingDemo(false);
    }
  }

  async function callNurse(payload: any): Promise<NurseResponse | null> {
    const { data, error } = await supabase.functions.invoke("triage-nurse", { body: payload });
    if (error) {
      let status = 0;
      if (error instanceof FunctionsHttpError) {
        const res = error.context as Response;
        status = res.status;
        // Read the server's { error } so the body is consumed; only the status is logged.
        try { await res.json(); } catch { /* no JSON body */ }
      }
      console.warn(`[triage] triage-nurse returned HTTP ${status || "network error"}`);
      toast.error(TRIAGE_ERRORS[status] ?? "The triage service is unavailable right now.");
      return null;
    }
    if ((data as any)?.error) {
      toast.error("The triage service is unavailable right now.");
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

  async function answer(value: string | number) {
    if (!currentQ) return;
    setAnswering(true);
    let nextEvidence = evidence;

    // Convert answer to evidence based on question type
    if (currentQ.type === "boolean") {
      if (value !== "unknown") {
        nextEvidence = [...evidence, { id: currentQ.id, name: currentQ.text, present: value === "yes" }];
        setEvidence(nextEvidence);
      }
    } else {
      // For other question types, store the answer value as evidence
      nextEvidence = [...evidence, { id: currentQ.id, name: `${currentQ.text}: ${value}`, present: true }];
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

  // Save the triage session (with location when the patient allows it) for the
  // doctor's triage panel. Booking then starts with the recommended specialty.
  async function loadResults(r: NurseResponse) {
    let c = coords;
    if (!c && navigator.geolocation) {
      c = await new Promise<{ lat: number; lng: number } | null>((res) => navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => res(null),
        { timeout: 4000 },
      ));
      if (c) setCoords(c);
    }
    if (!patient) return;
    const triageLevelMap: Record<string, string> = {
      "self_care": "routine",
      "consultation": "soon",
      "consultation_24": "soon",
      "emergency_ambulance": "emergency",
      "emergency": "emergency",
    };
    const { error } = await supabase.from("triage_sessions").insert({
      patient_id: patient.id,
      symptoms: evidence.map((e) => `${e.name}:${e.present ? "yes" : "no"}`).concat(freeText ? [freeText] : []),
      severity_self: 0,
      severity_score: r.severity_score || Math.round(((r.differential[0]?.probability || 0.3) * 10)),
      recommended_specialty: r.recommended_specialty,
      urgency: triageLevelMap[r.triage_level] || "soon",
      recommended_hospitals: r as any,
      lat: c?.lat ?? null, lng: c?.lng ?? null,
    } as any);
    if (error) console.warn("[triage] could not save the triage session");
  }

  function handleStartOver() {
    setStep(2);
    setEvidence([]);
    setAskedIds([]);
    setCurrentQ(null);
    setLatestResp(null);
    setSkipped(false);
  }

  function handleContinueToDoctorSelection() {
    setStep(5);
  }

  function handleSkip() {
    setSkipTriageOpen(true);
  }

  function handleConfirmSkip() {
    setSkipTriageOpen(false);
    // Set default response with General Practice specialty
    const defaultResp: NurseResponse = {
      should_stop: true,
      differential: [],
      triage_level: "consultation",
      triage_label: "See a doctor",
      recommended_specialty: "General Practice",
      guidance: "Please select a doctor for your consultation.",
    };
    setLatestResp(defaultResp);
    setSkipped(true);
    setStep(5);
  }

  return (
    <PatientLayout>
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" /> Triage assistant
          </h1>
          <p className="text-muted-foreground text-sm">Answer a few questions about your symptoms. This is guidance, not a diagnosis.</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((n) => (
            <div key={n} className={cn("h-1.5 flex-1 rounded-full", step >= n ? "bg-primary" : "bg-muted")} />
          ))}
        </div>

        {/* STEP 1: Demographics */}
        {step === 1 && (
          <TriageStep1DemographicsStep
            age={age}
            sex={sex}
            onAgeChange={setAge}
            onSexChange={setSex}
            onContinue={saveDemographics}
            loading={savingDemo}
          />
        )}

        {/* STEP 2: Symptoms */}
        {step === 2 && (
          <TriageStep2SymptomsStep
            freeText={freeText}
            onFreeTextChange={setFreeText}
            onContinue={startInterview}
            onBack={() => setStep(1)}
            onSkip={handleSkip}
            loading={parsing}
          />
        )}

        {/* STEP 3: Interview */}
        {step === 3 && currentQ && (
          <TriageStep3InterviewStep
            question={currentQ}
            askedCount={askedIds.length}
            maxQuestions={MAX_QUESTIONS}
            onAnswer={answer}
            loading={answering}
          />
        )}

        {/* STEP 4: Results */}
        {step === 4 && latestResp && (
          <TriageStep4ResultsStep
            triageResponse={latestResp}
            onStartOver={handleStartOver}
            onContinueToDoctorSelection={handleContinueToDoctorSelection}
          />
        )}

        {/* STEP 5: Booking, hospital first, with the recommended specialty */}
        {step === 5 && latestResp && (
          <BookingFlow
            specialty={skipped ? null : latestResp.recommended_specialty}
            reason={skipped ? "" : `Triage: ${latestResp.triage_label} (${latestResp.recommended_specialty}). ${freeText}`.trim().slice(0, 500)}
            initialCoords={coords}
            onExit={() => setStep(skipped ? 2 : 4)}
            exitLabel={skipped ? "Back to symptoms" : "Back to results"}
          />
        )}

        {/* Skip Triage Modal */}
        <SkipTriageModal
          open={skipTriageOpen}
          onClose={() => setSkipTriageOpen(false)}
          onConfirm={handleConfirmSkip}
        />
      </div>
    </PatientLayout>
  );
}
