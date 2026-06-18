import { PatientLayout } from "@/layouts/PatientLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rankHospitals, RankedHospital } from "@/lib/triage/proximity";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { TriageStep1DemographicsStep } from "@/components/triage/TriageStep1DemographicsStep";
import { TriageStep2SymptomsStep } from "@/components/triage/TriageStep2SymptomsStep";
import { TriageStep3InterviewStep } from "@/components/triage/TriageStep3InterviewStep";
import { TriageStep4ResultsStep } from "@/components/triage/TriageStep4ResultsStep";
import { TriageStep5DoctorSelectionStep } from "@/components/triage/TriageStep5DoctorSelectionStep";
import { TriageStep6VisitTypeStep } from "@/components/triage/TriageStep6VisitTypeStep";
import { TriageStep7HospitalSelectionStep } from "@/components/triage/TriageStep7HospitalSelectionStep";
import { TriageStep8ConfirmationStep } from "@/components/triage/TriageStep8ConfirmationStep";
import { TriageStep7_5DateTimeStep } from "@/components/triage/TriageStep7_5DateTimeStep";
import { SkipTriageModal } from "@/components/triage/SkipTriageModal";

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

export default function PatientTriage() {
  const nav = useNavigate();
  const [step, setStep] = useState(1);
  const [patient, setPatient] = useState<any>(null);
  const [age, setAge] = useState<number | "">("");
  const [sex, setSex] = useState<Sex | "">("");
  const [savingDemo, setSavingDemo] = useState(false);

  const [freeText, setFreeText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [skipTriageOpen, setSkipTriageOpen] = useState(false);

  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [askedIds, setAskedIds] = useState<string[]>([]);
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [answering, setAnswering] = useState(false);
  const [latestResp, setLatestResp] = useState<NurseResponse | null>(null);

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [hospitals, setHospitals] = useState<RankedHospital[]>([]);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [loadingHospitals, setLoadingHospitals] = useState(false);

  // New states for Steps 5-8
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<any>(null);
  const [selectedVisitType, setSelectedVisitType] = useState<"in-person" | "telemedicine" | null>(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | null>(null);
  const [selectedHospital, setSelectedHospital] = useState<any>(null);
  const [hospitalsForDoctor, setHospitalsForDoctor] = useState<RankedHospital[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

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
      let specSet = new Set((hd || []).map((x: any) => x.hospital_id));
      let notice: string | null = null;

      // Fallback 1: no hospital has the specialty → fall back to General Practice
      if (specSet.size === 0) {
        const { data: gpDocs } = await supabase.from("doctors").select("id").ilike("specialty", "%General%");
        const gpIds = (gpDocs || []).map((d: any) => d.id);
        const { data: gpHd } = gpIds.length
          ? await supabase.from("hospital_doctors").select("hospital_id").in("doctor_id", gpIds).eq("is_active", true)
          : { data: [] as any[] };
        specSet = new Set((gpHd || []).map((x: any) => x.hospital_id));
        notice = `No ${r.recommended_specialty} specialists found — showing general practitioners instead.`;
      }

      let ranked = rankHospitals(c, (hs || []) as any, specSet);

      // Fallback 2: nothing within 50 km (or no geo) → show all active hospitals nationwide
      const nearby = ranked.filter((h) => h.distanceKm != null && h.distanceKm <= 50);
      if (nearby.length === 0) {
        ranked = rankHospitals(null, (hs || []) as any, specSet);
        notice = notice
          ? `${notice} None nearby — showing all hospitals nationwide.`
          : "No hospitals within 50 km — showing all hospitals nationwide.";
      }

      setHospitals(ranked);
      setFallbackNotice(notice);

      // Save session
      const { data: { user } } = await supabase.auth.getUser();
      if (user && patient) {
        // Map triage_level from LLM to database urgency values
        const triageLevelMap: Record<string, string> = {
          "self_care": "routine",
          "consultation": "soon",
          "consultation_24": "soon",
          "emergency_ambulance": "emergency",
          "emergency": "emergency",
        };
        const dbUrgency = triageLevelMap[r.triage_level] || "soon";

        await supabase.from("triage_sessions").insert({
          patient_id: patient.id,
          symptoms: evidence.map((e) => `${e.name}:${e.present ? "yes" : "no"}`).concat(freeText ? [freeText] : []),
          severity_self: 0,
          severity_score: r.severity_score || Math.round(((r.differential[0]?.probability || 0.3) * 10)),
          recommended_specialty: r.recommended_specialty,
          urgency: dbUrgency,
          recommended_hospitals: r as any,
          lat: c?.lat ?? null, lng: c?.lng ?? null,
        } as any);
      }
    } finally {
      setLoadingHospitals(false);
    }
  }

  function handleStartOver() {
    setStep(2);
    setEvidence([]);
    setAskedIds([]);
    setCurrentQ(null);
    setLatestResp(null);
    setHospitals([]);
    setFallbackNotice(null);
    setSelectedDoctorId(null);
    setSelectedDoctor(null);
    setSelectedVisitType(null);
    setSelectedHospitalId(null);
    setSelectedHospital(null);
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
    setStep(5);
  }

  async function handleSelectDoctor(doctorId: string, doctor: any) {
    setSelectedDoctorId(doctorId);
    setSelectedDoctor(doctor);
    setStep(6);
  }

  async function handleSelectVisitType(visitType: "in-person" | "telemedicine") {
    setSelectedVisitType(visitType);
    setSelectedDate(null);
    setSelectedTime(null);

    if (visitType === "telemedicine") {
      // Skip hospital selection, go straight to date/time picker
      setStep(75);
    } else {
      setStep(7);
      await loadHospitalsForDoctor(selectedDoctorId!);
    }
  }

  async function loadHospitalsForDoctor(doctorId: string) {
    setLoadingHospitals(true);
    try {
      const { data: hospitalDocs, error: hdError } = await supabase
        .from("hospital_doctors")
        .select("hospital_id")
        .eq("doctor_id", doctorId)
        .eq("is_active", true);

      if (hdError) throw hdError;

      const hospitalIds = hospitalDocs?.map((hd: any) => hd.hospital_id) || [];

      if (hospitalIds.length === 0) {
        setHospitalsForDoctor([]);
        return;
      }

      const { data: hospitalData, error: hError } = await supabase
        .from("hospitals")
        .select("id, name, city, lat, lng")
        .in("id", hospitalIds)
        .eq("is_active", true);

      if (hError) throw hError;

      const specSet = new Set(hospitalIds);
      const ranked = rankHospitals(coords, hospitalData || [], specSet);
      setHospitalsForDoctor(ranked);
    } catch (error: any) {
      toast.error(error.message || "Failed to load hospitals");
    } finally {
      setLoadingHospitals(false);
    }
  }

  async function handleSelectHospital(hospitalId: string) {
    setSelectedHospitalId(hospitalId);
    const hospital = hospitalsForDoctor.find(h => h.id === hospitalId);
    setSelectedHospital(hospital);
    setSelectedDate(null);
    setSelectedTime(null);
    setStep(75);
  }

  function handleBackFromStep5() {
    setStep(4);
  }

  function handleBackFromStep6() {
    setSelectedVisitType(null);
    setStep(5);
  }

  function handleBackFromStep7() {
    setSelectedHospitalId(null);
    setSelectedHospital(null);
    setStep(6);
  }

  function handleBackFromStep8() {
    setStep(75);
  }

  function handleBackFromDateTime() {
    if (selectedVisitType === "telemedicine") setStep(6);
    else setStep(7);
  }

  function handleTryAnotherDoctor() {
    setSelectedDoctorId(null);
    setSelectedDoctor(null);
    setSelectedVisitType(null);
    setSelectedHospitalId(null);
    setSelectedHospital(null);
    setStep(5);
  }

  function handleTryTelemedicine() {
    setSelectedVisitType("telemedicine");
    setSelectedHospitalId(null);
    setSelectedHospital(null);
    setStep(75);
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
          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
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

        {/* STEP 5: Doctor Selection */}
        {step === 5 && latestResp && (
          <TriageStep5DoctorSelectionStep
            specialty={latestResp.recommended_specialty}
            onSelectDoctor={handleSelectDoctor}
            onBack={handleBackFromStep5}
          />
        )}

        {/* STEP 6: Visit Type Selection */}
        {step === 6 && selectedDoctor && (
          <TriageStep6VisitTypeStep
            doctorName={`${selectedDoctor.first_name} ${selectedDoctor.last_name}`}
            onSelectVisitType={handleSelectVisitType}
            onBack={handleBackFromStep6}
          />
        )}

        {/* STEP 7: Hospital Selection (in-person only) */}
        {step === 7 && selectedDoctor && selectedVisitType === "in-person" && (
          <TriageStep7HospitalSelectionStep
            doctorId={selectedDoctorId!}
            doctorName={`${selectedDoctor.first_name} ${selectedDoctor.last_name}`}
            coords={coords}
            onSelectHospital={handleSelectHospital}
            onBack={handleBackFromStep7}
            onTryAnotherDoctor={handleTryAnotherDoctor}
            onTryTelemedicine={handleTryTelemedicine}
          />
        )}

        {/* STEP 7.5: Date & Time Selection */}
        {step === 75 && selectedDoctor && selectedVisitType && latestResp && (
          <TriageStep7_5DateTimeStep
            doctorId={selectedDoctorId!}
            doctorName={`${selectedDoctor.first_name} ${selectedDoctor.last_name}`}
            visitType={selectedVisitType}
            hospitalId={selectedHospitalId}
            triageLevel={latestResp.triage_level}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onSelect={(d, t) => { setSelectedDate(d); setSelectedTime(t); }}
            onBack={handleBackFromDateTime}
            onContinue={() => setStep(8)}
          />
        )}

        {/* STEP 8: Confirmation & Booking */}
        {step === 8 && latestResp && selectedDoctor && selectedVisitType && (
          <TriageStep8ConfirmationStep
            patient={patient}
            triageLevel={latestResp.triage_level}
            triageLabel={latestResp.triage_label}
            specialty={latestResp.recommended_specialty}
            doctorId={selectedDoctorId!}
            doctorName={`${selectedDoctor.first_name} ${selectedDoctor.last_name}`}
            visitType={selectedVisitType}
            hospitalId={selectedHospitalId}
            hospitalName={selectedHospital?.name}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            onBack={handleBackFromStep8}
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
