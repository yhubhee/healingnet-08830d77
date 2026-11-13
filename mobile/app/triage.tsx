// Check symptoms (src/pages/patient/Triage.tsx + src/components/triage/*): the same four
// steps (about you, symptoms, questions, result), the same triage-nurse function and the
// same saved triage_sessions row. One question per screen, with big answers to tap. An
// emergency answer shows the emergency card at once.
import { CalendarPlus, CircleAlert, MapPin, Phone, RotateCcw, Stethoscope } from "@/components/icons";
import { FunctionsHttpError } from "@supabase/supabase-js";
import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Linking, Platform, Pressable, View } from "react-native";
import { Field, Segmented } from "@/components/form";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Chip, Heading, Label, Notice, Small, Strong, Title } from "@/components/ui";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { usePatient } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import {
  addAnswer, ageFromDob, bookingReason, DURATION_CHOICES, EMERGENCY_NUMBER, interviewDone, isEmergency, MAX_COMPLAINT, MAX_QUESTIONS,
  needsAmbulance, SCALE_VALUES, sessionRow, triageErrorText, TRIAGE_UNAVAILABLE, urgencyTone, urgencyWords,
  type Evidence, type NurseResponse, type Question, type Sex,
} from "@/shared/triage";
import { MIN_TOUCH, radius, space, useTheme } from "@/theme";

const STEPS = ["About you", "Symptoms", "Questions", "Result"];

/** A big answer to tap. */
function Answer({ label, hint, onPress, disabled }: { label: string; hint?: string; onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={hint ? `${label}. ${hint}` : label} accessibilityState={{ disabled: !!disabled }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 64, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
        paddingHorizontal: space.xl, paddingVertical: space.md, justifyContent: "center", opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}>
      <Strong style={{ fontSize: 17 }}>{label}</Strong>
      {hint ? <Small>{hint}</Small> : null}
    </Pressable>
  );
}

/** Call 112 and find the nearest hospital. Shown the moment an answer points to an emergency. */
function EmergencyCard({ response }: { response: NurseResponse }) {
  const { colors } = useTheme();
  const maps = Platform.OS === "ios" ? "http://maps.apple.com/?q=hospital" : "geo:0,0?q=hospital";
  return (
    <View accessibilityRole="alert" style={{ borderRadius: radius.card, borderWidth: 2, borderColor: colors.danger, backgroundColor: colors.dangerSoft, padding: space.lg, gap: space.md }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
        <CircleAlert size={28} color={colors.danger} />
        <Heading color={colors.danger} style={{ flex: 1 }}>This may be an emergency</Heading>
      </View>
      <Body>{needsAmbulance(response)
        ? `Call ${EMERGENCY_NUMBER} now, or have someone take you to the nearest hospital. Do not wait for an appointment.`
        : `Go to the nearest hospital's emergency unit now. If you cannot get there safely, call ${EMERGENCY_NUMBER}.`}</Body>
      {(response.red_flags ?? []).map((flag) => <Small key={flag} muted={false}>• {flag}</Small>)}
      <Button label={`Call ${EMERGENCY_NUMBER}`} icon={Phone} variant="danger" onPress={() => Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => {})} />
      <Button label="Find the nearest hospital" icon={MapPin} variant="secondary"
        onPress={() => Linking.openURL(maps).catch(() => Linking.openURL("https://www.google.com/maps/search/hospital").catch(() => {}))} />
    </View>
  );
}

export default function Triage() {
  const { colors } = useTheme();
  const toast = useToast();
  const online = useOnline();
  const { profile, patientId } = usePatient();
  const [step, setStep] = useState(0);
  const [sex, setSex] = useState<Sex | "">("");
  const [freeText, setFreeText] = useState("");
  const [busy, setBusy] = useState(false);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [askedIds, setAskedIds] = useState<string[]>([]);
  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<NurseResponse | null>(null);
  const saved = useRef(false);

  const age = ageFromDob(profile?.date_of_birth);
  useEffect(() => { if (!sex && (profile?.gender === "male" || profile?.gender === "female")) setSex(profile.gender); }, [profile?.gender, sex]);

  const leave = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  const back = () => {
    if (step === 0 || step === 3) return leave();
    if (step === 2) return startOver();
    setStep(step - 1);
  };
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === 1) { setStep(0); return true; }
      if (step === 2) { startOver(); return true; }
      return false;
    });
    return () => sub.remove();
  });

  function startOver() {
    setStep(1); setEvidence([]); setAskedIds([]); setQuestion(null); setResult(null);
    saved.current = false;
  }

  /** Same call as the website. Only the status code is looked at; answers are never logged. */
  async function callNurse(payload: Record<string, unknown>): Promise<NurseResponse | null> {
    const { data, error } = await supabase.functions.invoke("triage-nurse", { body: payload });
    if (error) {
      let status = 0;
      if (error instanceof FunctionsHttpError) {
        const res = error.context as Response;
        status = res.status;
        try { await res.json(); } catch { /* no JSON body */ }
      }
      toast.error(online ? triageErrorText(status) : OFFLINE_ACTION);
      return null;
    }
    if (!data || (data as { error?: unknown }).error) {
      toast.error(TRIAGE_UNAVAILABLE);
      return null;
    }
    return data as NurseResponse;
  }

  /** Saves the session for the doctor's triage panel, with the location only if it is already allowed. */
  async function finish(r: NurseResponse, finalEvidence: Evidence[]) {
    setQuestion(null);
    setResult(r);
    setStep(3);
    if (!patientId || saved.current) return;
    saved.current = true;
    let coords: { lat: number; lng: number } | null = null;
    try {
      if ((await Location.getForegroundPermissionsAsync()).granted) {
        const pos = await Location.getLastKnownPositionAsync();
        if (pos) coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch { /* no location: the session is saved without it */ }
    await supabase.from("triage_sessions").insert(sessionRow({ patientId, evidence: finalEvidence, freeText: freeText.trim(), response: r, coords }) as never);
  }

  async function startInterview() {
    if (!freeText.trim() || age === null || !sex) return;
    setBusy(true);
    const r = await callNurse({ stage: "parse", age, sex, free_text: freeText.trim() });
    setBusy(false);
    if (!r) return;
    const found = r.new_evidence ?? [];
    setEvidence(found);
    if (isEmergency(r) || r.should_stop || !r.next_question) return finish(r, found);
    setQuestion(r.next_question);
    setAskedIds([r.next_question.id]);
    setStep(2);
  }

  async function answer(value: string | number) {
    if (!question || busy) return;
    const next = addAnswer(evidence, question, value);
    setEvidence(next);
    setBusy(true);
    const r = await callNurse({ stage: "next", age, sex, evidence: next, asked_ids: askedIds });
    setBusy(false);
    if (!r) return;
    if (isEmergency(r) || interviewDone(r, askedIds.length)) return finish(r, next);
    setQuestion(r.next_question!);
    setAskedIds((ids) => [...ids, r.next_question!.id]);
  }

  const book = (withTriage: boolean) => router.push(withTriage && result
    ? { pathname: "/book", params: { specialty: result.recommended_specialty, reason: bookingReason(result, freeText.trim()) } }
    : "/book");

  const kind = question?.type ?? "boolean";

  return (
    <Screen title="Check symptoms" back onBack={back}
      footer={
        step === 0 ? <Button label="Continue" onPress={() => setStep(1)} disabled={age === null || !sex} disabledReason="Choose male or female first" />
        : step === 1 ? (
          <>
            {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
            <Button label="Start the questions" onPress={startInterview} loading={busy} disabled={!freeText.trim() || !online} disabledReason={!online ? OFFLINE_ACTION : "Describe what is wrong first"} />
            <Button label="Skip and book a doctor" variant="ghost" onPress={() => book(false)} />
          </>
        ) : undefined
      }>
      <View style={{ gap: space.sm }}>
        <Small>Step {step + 1} of {STEPS.length} · {STEPS[step]}</Small>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: STEPS.length, now: step + 1 }} style={{ flexDirection: "row", gap: 6 }}>
          {STEPS.map((s, i) => <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? colors.primary : colors.divider }} />)}
        </View>
      </View>

      {step === 0 ? (
        <>
          <Heading>About you</Heading>
          <Body muted>Answer a few questions about your symptoms. This is guidance, not a diagnosis.</Body>
          <Card style={{ gap: space.md }}>
            <View><Small>Age</Small><Strong>{age === null ? "Add your date of birth in your profile" : `${age} year${age === 1 ? "" : "s"}`}</Strong></View>
            <View style={{ gap: space.sm }}>
              <Small>Sex (some questions depend on it)</Small>
              <Segmented<Sex> label="Sex" value={sex as Sex} onChange={setSex} options={[{ value: "female", label: "Female" }, { value: "male", label: "Male" }]} />
            </View>
          </Card>
          {age === null ? <Button label="Edit my profile" variant="secondary" onPress={() => router.push("/complete-profile?edit=1")} /> : null}
          <Notice tone="warning" text={`If this is an emergency (chest pain, trouble breathing, heavy bleeding, fainting), call ${EMERGENCY_NUMBER} or go to the nearest hospital now.`} />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <Heading>Tell us what's wrong</Heading>
          <Field label="In your own words" value={freeText} onChangeText={setFreeText} multiline maxLength={MAX_COMPLAINT} autoFocus
            placeholder="e.g. For the past 2 days I've had a sharp pain in the lower right side of my belly, with nausea and a low fever"
            hint="Mention what you feel, when it started, and anything that makes it better or worse." style={{ minHeight: 160 }} />
        </>
      ) : null}

      {step === 2 && question ? (
        <>
          <Small>Question {askedIds.length} of up to {MAX_QUESTIONS}</Small>
          <Title style={{ fontSize: 24, lineHeight: 30 }}>{question.text}</Title>
          {question.explanation ? <Body muted>{question.explanation}</Body> : null}
          <View style={{ gap: space.md }} accessibilityLabel="Answers">
            {kind === "multiple_choice" ? (question.options ?? []).map((o) => <Answer key={o} label={o} disabled={busy} onPress={() => answer(o)} />)
            : kind === "duration" ? DURATION_CHOICES.map((c) => <Answer key={c.value} label={c.label} disabled={busy} onPress={() => answer(c.value)} />)
            : kind === "scale" ? (
              <>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
                  {SCALE_VALUES.map((n) => (
                    <Pressable key={n} accessibilityRole="button" disabled={busy} onPress={() => answer(n)}
                      accessibilityLabel={`${n} out of 10${n === 1 ? `, ${question.options?.[0] ?? "low"}` : n === 10 ? `, ${question.options?.[1] ?? "high"}` : ""}`}
                      style={({ pressed }) => ({
                        width: "18%", minHeight: MIN_TOUCH + 12, borderRadius: radius.button, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card,
                        alignItems: "center", justifyContent: "center", opacity: busy ? 0.5 : pressed ? 0.8 : 1,
                      })}>
                      <Strong style={{ fontSize: 20 }}>{n}</Strong>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Small>1 = {question.options?.[0] ?? "Low"}</Small>
                  <Small>10 = {question.options?.[1] ?? "High"}</Small>
                </View>
              </>
            ) : (
              <>
                <Answer label="Yes" disabled={busy} onPress={() => answer("yes")} />
                <Answer label="No" disabled={busy} onPress={() => answer("no")} />
                <Answer label="I don't know" disabled={busy} onPress={() => answer("unknown")} />
              </>
            )}
          </View>
          {busy ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }} accessibilityLiveRegion="polite">
              <ActivityIndicator color={colors.primaryText} />
              <Small>Checking your answer…</Small>
            </View>
          ) : null}
          {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
        </>
      ) : null}

      {step === 3 && result ? (
        <>
          {isEmergency(result) ? <EmergencyCard response={result} /> : null}
          <Card style={{ gap: space.sm }}>
            <Label>How urgent</Label>
            <Chip label={urgencyWords(result.triage_level)} tone={urgencyTone(result.triage_level)} />
            <Heading>{result.triage_label}</Heading>
            <Body>{result.guidance}</Body>
            {!isEmergency(result) ? (result.red_flags ?? []).map((flag) => <Small key={flag} muted={false}>• {flag}</Small>) : null}
          </Card>

          {result.differential.length > 0 ? (
            <Card style={{ gap: space.md }}>
              <Label>Possible conditions</Label>
              <Small>Ranked by how well they match your answers. Not a diagnosis.</Small>
              {result.differential.slice(0, 5).map((c) => {
                const pct = Math.round(c.probability * 100);
                return (
                  <View key={c.name} style={{ gap: 4 }} accessible accessibilityLabel={`${c.name}, ${pct} percent. ${c.description ?? ""}`}>
                    <View style={{ flexDirection: "row", gap: space.sm }}>
                      <Strong style={{ flex: 1 }}>{c.name}</Strong>
                      <Small muted={false}>{pct}%</Small>
                    </View>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.divider, overflow: "hidden" }}>
                      <View style={{ width: `${Math.max(2, Math.min(100, pct))}%`, height: 8, backgroundColor: colors.primary }} />
                    </View>
                    {c.description ? <Small>{c.description}</Small> : null}
                  </View>
                );
              })}
            </Card>
          ) : null}

          <Card style={{ gap: space.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
              <Stethoscope size={22} color={colors.primaryText} />
              <Label style={{ flex: 1 }}>Suggested kind of doctor</Label>
            </View>
            <Strong>{result.recommended_specialty}</Strong>
            <Small>Booking starts with hospitals that have this kind of doctor.</Small>
          </Card>

          <Button label="Book a doctor" icon={CalendarPlus} variant={isEmergency(result) ? "secondary" : "primary"} onPress={() => book(true)} />
          <Button label="Start over" icon={RotateCcw} variant="ghost" onPress={startOver} />
        </>
      ) : null}
    </Screen>
  );
}
