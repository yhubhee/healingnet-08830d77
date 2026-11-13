// Book a doctor (src/components/booking/BookingFlow.tsx). One step per screen with a
// progress bar: hospital → doctor (or any available) → visit type → date and time →
// reason → confirm. Every read and the booking itself use the website's database functions
// (bookable_hospitals, bookable_doctors, book_appointment); their messages are shown as written.
// After Check symptoms it opens with the suggested specialty and the reason filled in
// (?specialty=&reason=), as the website's triage page does.
import { Building2, CalendarCheck, Check, ChevronRight, MapPin, Users, Video } from "@/components/icons";
import type { LucideIcon } from "@/components/icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { BackHandler, Pressable, ScrollView, Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { DateField, Field } from "@/components/form";
import { PersonSheet } from "@/components/PersonSwitcher";
import { Screen } from "@/components/Screen";
import { useToast } from "@/components/toast";
import { Body, Button, Card, Chip, Divider, EmptyState, ErrorState, Heading, LinkText, ListSkeleton, Notice, Small, Strong, Title } from "@/components/ui";
import { useActivePerson } from "@/lib/family";
import { OFFLINE_ACTION, useOnline } from "@/lib/net";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase";
import { addDays, DAY_NAMES, dayChip, dayOfWeek, DEFAULT_SLOTS, fmt12, fmtLongDate, halfHours, lagosNowTime, lagosToday } from "@/shared/dates";
import { dbMessage } from "@/shared/errors";
import { forPerson, personWithAge } from "@/shared/family";
import { ratingLabel, ratingSpoken } from "@/shared/reviews";
import { fonts, MIN_TOUCH, radius, space, useTheme } from "@/theme";

interface Hospital {
  id: string; name: string; address: string | null; city: string | null; state: string | null; logo_url: string | null;
  offers_telemedicine: boolean; doctors_total: number; doctors_in_specialty: number; distance_km: number | null;
}
interface Doctor {
  id: string; first_name: string; last_name: string; specialty: string | null; years_experience: number | null;
  bio: string | null; profile_image_url: string | null; rating: number | null; matches_specialty: boolean;
  /** Added by the app from doctors.review_count (bookable_doctors does not return it). */
  review_count?: number;
}
interface AvailRow { day_of_week: number; start_time: string; end_time: string; hospital_id: string | null; accepts_in_person: boolean; accepts_virtual: boolean }
type Visit = "in_person" | "video";
interface Coords { lat: number; lng: number }

const MAX_DAYS_AHEAD = 180;
const STEPS = ["Hospital", "Doctor", "Visit type", "Date and time", "Reason", "Confirm"];

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function Choice({ icon: Icon, left, title, text, onPress, disabled, selected, children }: {
  icon?: LucideIcon; left?: ReactNode; title: string; text?: string; onPress: () => void; disabled?: boolean; selected?: boolean; children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}${text ? `. ${text}` : ""}`} accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 72, padding: space.lg, borderRadius: radius.card, borderWidth: selected ? 2 : 1,
        borderColor: selected ? colors.primary : colors.border, backgroundColor: colors.card, opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
      })}>
      {left ?? (Icon ? (
        <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <Icon size={24} color={colors.primaryText} />
        </View>
      ) : null)}
      <View style={{ flex: 1, gap: 2 }}>
        <Strong>{title}</Strong>
        {text ? <Small>{text}</Small> : null}
        {children}
      </View>
      {!disabled ? <ChevronRight size={20} color={colors.textMuted} /> : null}
    </Pressable>
  );
}

export default function Book() {
  const { colors } = useTheme();
  const qc = useQueryClient();
  const toast = useToast();
  const online = useOnline();
  const params = useLocalSearchParams<{ specialty?: string; reason?: string }>();
  const [specialty, setSpecialty] = useState<string | null>(() => String(params.specialty ?? "").trim().slice(0, 80) || null);
  const [step, setStep] = useState(0);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [doctor, setDoctor] = useState<Doctor | "any" | null>(null);
  const [visit, setVisit] = useState<Visit>("in_person");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState(() => String(params.reason ?? "").slice(0, 500));
  const [booking, setBooking] = useState(false);
  const [done, setDone] = useState(false);
  // Who the visit is for: the person chosen under "Who is this for?".
  const person = useActivePerson();
  const { patientId: ownId } = useSession();
  const [choosing, setChoosing] = useState(false);
  const bookingFor = person.isMe ? "Me" : personWithAge(person.firstName ?? "", person.member?.age);

  const leave = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)"));
  const back = () => (done || step === 0 ? leave() : setStep(step - 1));

  // The phone's back button goes one step back, not out of the flow.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (done || step === 0) return false;
      setStep((s) => s - 1);
      return true;
    });
    return () => sub.remove();
  }, [step, done]);

  const doctorName = doctor === "any" ? "Any available doctor" : doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : "";

  async function confirm() {
    if (!hospital || !date || !time) return;
    setBooking(true);
    // p_patient_id is only sent for a family member; for the patient the call is unchanged.
    const { error } = await supabase.rpc("book_appointment", forPerson({
      p_hospital_id: hospital.id,
      p_doctor_id: (doctor && doctor !== "any" ? doctor.id : null) as string,
      p_date: date,
      p_time: time,
      p_is_telemedicine: visit === "video",
      p_reason: reason.trim().slice(0, 500) || undefined,
    }, person.isMe ? null : person.patientId, ownId));
    setBooking(false);
    if (error) return toast.error(`Couldn't book the appointment. ${dbMessage(error)}`);
    qc.invalidateQueries({ queryKey: ["appointments"] });
    qc.invalidateQueries({ queryKey: ["family-next"] });
    setDone(true);
  }

  if (done && hospital) {
    return (
      <Screen footer={
        <>
          <Button label={person.isMe ? "See my visits" : `See ${person.firstName}'s visits`} onPress={() => router.replace("/(tabs)/visits")} />
          <Button label="Back to Home" variant="ghost" onPress={() => router.replace("/(tabs)")} />
        </>
      }>
        <CalendarCheck size={56} color={colors.primaryText} style={{ marginTop: 48 }} />
        <Title>Appointment requested</Title>
        <Body>Waiting for the hospital to confirm. We'll notify you.</Body>
        <Card style={{ gap: 6 }}>
          {!person.isMe ? <Small muted={false}>For {bookingFor}</Small> : null}
          <Strong>{hospital.name}</Strong>
          <Small>{doctorName} · {visit === "video" ? "Video" : "In person"}</Small>
          <Small>{fmtLongDate(date)} at {fmt12(time)}</Small>
        </Card>
        <Small>We'll remind you 24 hours and 1 hour before.</Small>
      </Screen>
    );
  }

  return (
    <Screen title="Book a doctor" back onBack={back}
      footer={
        step === 3 ? <Button label="Continue" onPress={() => setStep(4)} disabled={!date || !time} disabledReason="Choose a date and a time first" />
        : step === 4 ? <Button label="Continue" onPress={() => setStep(5)} />
        : step === 5 ? (
          <>
            {!online ? <Notice tone="warning" text={OFFLINE_ACTION} /> : null}
            <Button label="Book appointment" icon={Check} onPress={confirm} loading={booking} disabled={!online} disabledReason={OFFLINE_ACTION} />
          </>
        ) : undefined
      }>
      <View style={{ gap: space.sm }}>
        <Small accessibilityRole="text">Step {step + 1} of {STEPS.length} · {STEPS[step]}</Small>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: STEPS.length, now: step + 1 }} style={{ flexDirection: "row", gap: 6 }}>
          {STEPS.map((s, i) => <View key={s} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= step ? colors.primary : colors.divider }} />)}
        </View>
      </View>

      {/* Always in view, on every step: who this booking is for. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md, borderRadius: radius.card, borderWidth: 1, paddingHorizontal: space.lg, paddingVertical: space.xs,
        borderColor: person.isMe ? colors.border : colors.primaryText, backgroundColor: person.isMe ? colors.card : colors.primarySoft }}>
        <Strong style={{ flex: 1 }} accessibilityLabel={`Booking for ${bookingFor}`}>Booking for: {bookingFor}</Strong>
        <LinkText label="Change" onPress={() => setChoosing(true)} />
      </View>
      <PersonSheet visible={choosing} onClose={() => setChoosing(false)} />

      {step === 0 ? (
        <HospitalStep specialty={specialty} onClearSpecialty={() => setSpecialty(null)} coords={coords} onCoords={setCoords}
          onPick={(h) => { setHospital(h); setDoctor(null); setVisit("in_person"); setTime(""); setStep(1); }} />
      ) : null}
      {step === 1 && hospital ? <DoctorStep hospital={hospital} specialty={specialty} onPick={(d) => { setDoctor(d); setTime(""); setStep(2); }} /> : null}
      {step === 2 && hospital ? (
        <>
          <Heading>How would you like to be seen?</Heading>
          <Choice icon={Users} title="In person" text={`Visit ${hospital.name}.`} selected={visit === "in_person"} onPress={() => { setVisit("in_person"); setTime(""); setStep(3); }} />
          <Choice icon={Video} title="Video" disabled={!hospital.offers_telemedicine} selected={visit === "video"}
            text={hospital.offers_telemedicine ? "Talk to the doctor from your phone." : "This hospital doesn't offer video visits yet"}
            onPress={() => { setVisit("video"); setTime(""); setStep(3); }} />
        </>
      ) : null}
      {step === 3 && hospital && doctor ? (
        <DateTimeStep hospitalId={hospital.id} doctor={doctor === "any" ? null : doctor} visit={visit} date={date} time={time}
          onDate={(d) => { setDate(d); setTime(""); }} onTime={setTime} />
      ) : null}
      {step === 4 ? (
        <>
          <Heading>What is the visit for?</Heading>
          <Field label="Reason for the visit (optional)" value={reason} onChangeText={setReason} multiline maxLength={500}
            placeholder="e.g. Headaches for two weeks" hint={`${reason.length}/500 · Shared with the hospital and your doctor.`} />
        </>
      ) : null}
      {step === 5 && hospital && doctor ? (
        <>
          <Heading>Check and confirm</Heading>
          <Card style={{ gap: space.md }}>
            <Summary label="For" value={bookingFor} onChange={() => setChoosing(true)} />
            <Divider />
            <Summary label="Hospital" value={hospital.name} sub={[hospital.address, hospital.city, hospital.state].filter(Boolean).join(", ")} onChange={() => setStep(0)} />
            <Divider />
            <Summary label="Doctor" value={doctorName} sub={doctor !== "any" ? doctor.specialty ?? undefined : undefined} onChange={() => setStep(1)} />
            <Divider />
            <Summary label="Visit" value={visit === "video" ? "Video" : "In person"} onChange={() => setStep(2)} />
            <Divider />
            <Summary label="When" value={`${fmtLongDate(date)} at ${fmt12(time)}`} onChange={() => setStep(3)} />
            <Divider />
            <Summary label="Reason" value={reason.trim() || "Not given"} onChange={() => setStep(4)} />
          </Card>
          <Small>The hospital confirms the time. If it's an emergency, go to the nearest emergency unit or call 112.</Small>
        </>
      ) : null}
    </Screen>
  );
}

function Summary({ label, value, sub, onChange }: { label: string; value: string; sub?: string; onChange: () => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
      <View style={{ flex: 1 }}>
        <Small>{label}</Small>
        <Strong>{value}</Strong>
        {sub ? <Small>{sub}</Small> : null}
      </View>
      <LinkText label="Change" onPress={onChange} />
    </View>
  );
}

// ---- 1. Hospital ------------------------------------------------------------------------
function HospitalStep({ specialty, onClearSpecialty, coords, onCoords, onPick }: {
  specialty: string | null; onClearSpecialty: () => void; coords: Coords | null; onCoords: (c: Coords) => void; onPick: (h: Hospital) => void;
}) {
  const toast = useToast();
  const [text, setText] = useState("");
  const [locating, setLocating] = useState(false);
  const search = useDebounced(text.trim());
  const q = useQuery({
    queryKey: ["booking", "hospitals", specialty, coords?.lat ?? null, coords?.lng ?? null, search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bookable_hospitals", { p_specialty: specialty ?? undefined, p_lat: coords?.lat, p_lng: coords?.lng, p_search: search || undefined });
      if (error) throw error;
      return (data ?? []) as Hospital[];
    },
    placeholderData: (prev) => prev,
  });

  // Location is only asked for when the person taps this; everything works without it.
  async function locate() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) { toast.info("Location is off. Hospitals are listed without distances."); return; }
      const pos = (await Location.getLastKnownPositionAsync()) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      onCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      toast.info("We couldn't get your location. Hospitals are listed without distances.");
    } finally {
      setLocating(false);
    }
  }

  return (
    <>
      <Heading>Choose a hospital</Heading>
      {specialty ? (
        <View style={{ gap: 4 }}>
          <Chip label={specialty} tone="primary" />
          <Small>Hospitals with {specialty} doctors are shown first.</Small>
          <LinkText label="Show all hospitals" onPress={onClearSpecialty} />
        </View>
      ) : null}
      <Field label="Search hospitals" value={text} onChangeText={setText} placeholder="Name, city or state" returnKeyType="search" autoCorrect={false} />
      {!coords ? <Button small variant="secondary" icon={MapPin} label="Show how far each one is" onPress={locate} loading={locating} /> : null}
      {q.data === undefined ? (q.isError || q.fetchStatus === "paused"
        ? <ErrorState offline={q.fetchStatus === "paused"} message={dbMessage(q.error)} onRetry={() => q.refetch()} />
        : <ListSkeleton />
      ) : q.data.length === 0 ? (
        <EmptyState icon={Building2} title={search ? `No hospitals match "${search}"` : "No hospitals are taking bookings on HealingNet yet"}
          text={search ? "Try a different name, city or state." : undefined} actionLabel={search ? "Clear search" : undefined} onAction={() => setText("")} />
      ) : q.data.map((h) => (
        <Choice key={h.id} icon={Building2} title={h.name} onPress={() => onPick(h)}
          text={`${[h.city, h.state].filter(Boolean).join(", ") || "Location not set"}${h.distance_km != null ? ` · ${Number(h.distance_km).toFixed(1)} km away` : ""}`}>
          <Small>
            {specialty
              ? h.doctors_in_specialty > 0 ? `${h.doctors_in_specialty} ${specialty} doctor${h.doctors_in_specialty === 1 ? "" : "s"}` : "General doctors"
              : `${h.doctors_total} doctor${h.doctors_total === 1 ? "" : "s"}`}
            {h.offers_telemedicine ? " · Video visits available" : ""}
          </Small>
        </Choice>
      ))}
    </>
  );
}

// ---- 2. Doctor --------------------------------------------------------------------------
function DoctorStep({ hospital, specialty, onPick }: { hospital: Hospital; specialty: string | null; onPick: (d: Doctor | "any") => void }) {
  const q = useQuery({
    queryKey: ["booking", "doctors", hospital.id, specialty],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bookable_doctors", { p_hospital_id: hospital.id, p_specialty: specialty ?? undefined });
      if (error) throw error;
      const doctors = (data ?? []) as Doctor[];
      if (doctors.length === 0) return doctors;
      // How many reviews are behind each rating; without it a doctor simply shows as "New".
      const counts = await supabase.from("doctors").select("id, review_count").in("id", doctors.map((d) => d.id));
      const byId = new Map((counts.data ?? []).map((c) => [c.id, c.review_count]));
      return doctors.map((d) => ({ ...d, review_count: byId.get(d.id) ?? 0 }));
    },
  });
  return (
    <>
      <Heading>Choose a doctor</Heading>
      <Choice icon={Users} title="Any available doctor" text={`${hospital.name} assigns the first available doctor${specialty ? `, a ${specialty} doctor where possible` : ""}.`} onPress={() => onPick("any")} />
      {q.data === undefined ? (q.isError || q.fetchStatus === "paused"
        ? <ErrorState offline={q.fetchStatus === "paused"} message={dbMessage(q.error)} onRetry={() => q.refetch()} />
        : <ListSkeleton />
      ) : q.data.length === 0 ? (
        <Notice text={'This hospital hasn\'t listed individual doctors yet. Choose "Any available doctor".'} />
      ) : q.data.map((d) => (
        <Choice key={d.id} title={`Dr. ${d.first_name} ${d.last_name}`} onPress={() => onPick(d)}
          left={<Avatar url={d.profile_image_url} first={d.first_name} last={d.last_name} size={48} />}
          text={`${d.specialty || "General practice"}${d.years_experience != null ? ` · ${d.years_experience} yrs experience` : ""}`}>
          <Small muted={false} accessibilityLabel={ratingSpoken(d.rating, d.review_count)}>{ratingLabel(d.rating, d.review_count)}</Small>
          {specialty && d.matches_specialty ? <Chip label={`✓ ${specialty}`} tone="success" /> : null}
          {d.bio ? <Small numberOfLines={2}>{d.bio}</Small> : null}
        </Choice>
      ))}
    </>
  );
}

// ---- 4. Date and time -------------------------------------------------------------------
function DateTimeStep({ hospitalId, doctor, visit, date, time, onDate, onTime }: {
  hospitalId: string; doctor: Doctor | null; visit: Visit; date: string; time: string; onDate: (d: string) => void; onTime: (t: string) => void;
}) {
  const { colors } = useTheme();
  const today = lagosToday();
  const maxDate = addDays(today, MAX_DAYS_AHEAD);
  const avail = useQuery({
    queryKey: ["booking", "availability", doctor?.id, hospitalId, visit],
    enabled: !!doctor,
    queryFn: async () => {
      const { data, error } = await supabase.from("doctor_availability")
        .select("day_of_week, start_time, end_time, hospital_id, accepts_in_person, accepts_virtual")
        .eq("doctor_id", doctor!.id).eq("is_available", true);
      if (error) throw error;
      return ((data ?? []) as AvailRow[]).filter((r) =>
        (r.hospital_id === null || r.hospital_id === hospitalId) && (visit === "video" ? r.accepts_virtual : r.accepts_in_person));
    },
  });

  // The doctor's own hours when they have published any; otherwise 08:00–17:00.
  const rows = doctor && avail.data && avail.data.length > 0 ? avail.data : null;
  const workDays = useMemo(() => (rows ? new Set(rows.map((r) => r.day_of_week)) : null), [rows]);
  const slots = useMemo(() => {
    if (!date) return [];
    if (!rows) return DEFAULT_SLOTS;
    const set = new Set<string>();
    rows.filter((r) => r.day_of_week === dayOfWeek(date)).forEach((r) => halfHours(r.start_time.slice(0, 5), r.end_time.slice(0, 5)).forEach((s) => set.add(s)));
    return [...set].sort();
  }, [date, rows]);

  const now = lagosNowTime();
  const quickDays = Array.from({ length: 14 }, (_, i) => addDays(today, i)).filter((d) => !workDays || workDays.has(dayOfWeek(d))).slice(0, 7);

  if (doctor && avail.isPending) return <ListSkeleton />;
  if (doctor && avail.isError) return <ErrorState offline={avail.fetchStatus === "paused"} message={dbMessage(avail.error)} onRetry={() => avail.refetch()} />;

  return (
    <>
      <Heading>Choose a date and time</Heading>
      {rows && workDays ? (
        <Small>Dr. {doctor!.last_name} sees {visit === "video" ? "video" : "in-person"} patients on {[...workDays].sort().map((d) => DAY_NAMES[d]).join(", ")}.</Small>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
        {quickDays.map((d) => {
          const c = dayChip(d);
          const selected = d === date;
          return (
            <Pressable key={d} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${d === today ? "Today, " : ""}${c.weekday} ${fmtLongDate(d)}`}
              onPress={() => onDate(d)}
              style={{ minWidth: 68, minHeight: 76, borderRadius: radius.button, borderWidth: 1, alignItems: "center", justifyContent: "center", padding: space.sm,
                borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card }}>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: selected ? colors.onPrimary : colors.textMuted }}>{d === today ? "Today" : c.weekday}</Text>
              <Text style={{ fontFamily: fonts.bold, fontSize: 18, color: selected ? colors.onPrimary : colors.text }}>{c.day}</Text>
              <Text style={{ fontFamily: fonts.medium, fontSize: 13, color: selected ? colors.onPrimary : colors.textMuted }}>{c.month}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <DateField label="Or pick a date" value={date} onChange={(v) => { if (v >= today && v <= maxDate) onDate(v); }} min={today} max={maxDate} />

      {date ? (
        slots.length === 0 ? (
          <Notice text={rows ? `Dr. ${doctor!.last_name} doesn't see patients on ${DAY_NAMES[dayOfWeek(date)]}s. Choose another day.` : "No times on this day."} />
        ) : (
          <View style={{ gap: space.sm }}>
            <Strong>{fmtLongDate(date)}</Strong>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
              {slots.map((s) => {
                const past = date === today && s <= now;
                const selected = s === time;
                return (
                  <Pressable key={s} disabled={past} accessibilityRole="button" accessibilityState={{ selected, disabled: past }}
                    accessibilityLabel={`${fmt12(s)}${past ? ", already passed" : ""}`} onPress={() => onTime(s)}
                    style={{ width: "31%", minHeight: MIN_TOUCH, borderRadius: radius.input, borderWidth: 1, alignItems: "center", justifyContent: "center",
                      borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card, opacity: past ? 0.4 : 1 }}>
                    <Text style={{ fontFamily: fonts.semibold, fontSize: 15, color: selected ? colors.onPrimary : colors.text, textDecorationLine: past ? "line-through" : "none" }}>{fmt12(s)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )
      ) : null}
    </>
  );
}
