// Patient booking, hospital first: hospital → doctor (or any available) → visit type →
// date and time → confirm. Used after triage (specialty pre-filled) and from "Book appointment".
// Every read and the booking itself go through database functions (bookable_hospitals,
// bookable_doctors, book_appointment); their error messages are plain English and shown as-is.
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Building2, CalendarDays, Check, ChevronRight, Loader2, MapPin, Search, Stethoscope, User, Users, Video, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { addDays, dayOfWeek, fmtLongDate, lagosNowTime, lagosToday } from "@/lib/dates";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";

export interface Coords { lat: number; lng: number }

interface Hospital {
  id: string; name: string; address: string | null; city: string | null; state: string | null; logo_url: string | null;
  offers_telemedicine: boolean; doctors_total: number; doctors_in_specialty: number; distance_km: number | null;
}
interface Doctor {
  id: string; first_name: string; last_name: string; specialty: string | null; years_experience: number | null;
  bio: string | null; profile_image_url: string | null; rating: number | null; matches_specialty: boolean;
}
type Visit = "in_person" | "video";

const MAX_DAYS_AHEAD = 180;
const STEP_TITLES = ["Hospital", "Doctor", "Visit type", "Date and time", "Confirm"];

/** The database's own message when it has one (these functions raise plain-English errors). */
const dbMessage = (e: unknown) => String((e as { message?: string })?.message || "") || friendlyError(e);

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

// ---------------------------------------------------------------------------
// Time slots
// ---------------------------------------------------------------------------
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
function halfHours(start: string, end: string): string[] {
  const out: string[] = [];
  for (let m = toMin(start); m + 30 <= toMin(end); m += 30) out.push(toTime(m));
  return out;
}
const DEFAULT_SLOTS = halfHours("08:00", "17:00");
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const fmt12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

// ---------------------------------------------------------------------------
// Flow
// ---------------------------------------------------------------------------
export function BookingFlow({
  specialty: initialSpecialty, reason: initialReason = "", initialCoords = null, onExit, exitLabel = "Back",
}: {
  specialty?: string | null; reason?: string; initialCoords?: Coords | null; onExit?: () => void; exitLabel?: string;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [specialty, setSpecialty] = useState<string | null>(initialSpecialty?.trim() || null);
  const [coords, setCoords] = useState<Coords | null>(initialCoords);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [doctor, setDoctor] = useState<Doctor | null | "any">(null);
  const [visit, setVisit] = useState<Visit>("in_person");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [reason, setReason] = useState(initialReason);
  const [booking, setBooking] = useState(false);

  // Ask for the location once; everything works without it.
  useEffect(() => {
    if (coords || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { timeout: 6000, maximumAge: 10 * 60_000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const go = (n: number) => { setStep(n); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const back = () => (step === 0 ? onExit?.() : go(step - 1));

  const confirm = async () => {
    if (!hospital || !date || !time) return;
    setBooking(true);
    const { error } = await supabase.rpc("book_appointment", {
      p_hospital_id: hospital.id,
      p_doctor_id: (doctor && doctor !== "any" ? doctor.id : null) as string,
      p_date: date,
      p_time: time,
      p_is_telemedicine: visit === "video",
      p_reason: reason.trim().slice(0, 500) || undefined,
    });
    setBooking(false);
    if (error) { toast.error("Couldn't book the appointment", { description: dbMessage(error) }); return; }
    qc.invalidateQueries({ queryKey: ["patient-appointments"] });
    toast.success("Appointment requested", { description: `${hospital.name} will confirm your ${fmtLongDate(date)} ${fmt12(time)} visit. We'll notify you.` });
    navigate("/patient/appointments");
  };

  const doctorName = doctor === "any" ? "Any available doctor" : doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : "";

  return (
    <div>
      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-2 text-sm">
          {(step > 0 || onExit) ? (
            <Button variant="ghost" size="sm" className="-ml-2" onClick={back}><ArrowLeft className="w-4 h-4 mr-1" />{step === 0 ? exitLabel : "Back"}</Button>
          ) : <span />}
          <span className="text-muted-foreground">Step {step + 1} of 5 · {STEP_TITLES[step]}</span>
        </div>
        <div className="mt-2 flex gap-1.5" aria-hidden>
          {STEP_TITLES.map((_, i) => <div key={i} className={cn("h-1.5 flex-1 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />)}
        </div>
      </div>

      {/* Choices so far */}
      {step > 0 && hospital && (
        <div className="mb-4 flex flex-wrap gap-2 text-xs">
          <Chip icon={Building2} onClick={() => go(0)}>{hospital.name}</Chip>
          {step > 1 && doctor && <Chip icon={User} onClick={() => go(1)}>{doctorName}</Chip>}
          {step > 2 && <Chip icon={visit === "video" ? Video : Users} onClick={() => go(2)}>{visit === "video" ? "Video visit" : "In person"}</Chip>}
          {step > 3 && date && time && <Chip icon={CalendarDays} onClick={() => go(3)}>{fmtLongDate(date)}, {fmt12(time)}</Chip>}
        </div>
      )}

      {step === 0 && (
        <HospitalStep specialty={specialty} onClearSpecialty={() => setSpecialty(null)} coords={coords}
          onPick={(h) => { setHospital(h); setDoctor(null); setVisit("in_person"); setTime(""); go(1); }} />
      )}
      {step === 1 && hospital && (
        <DoctorStep hospital={hospital} specialty={specialty} onPick={(d) => { setDoctor(d); setTime(""); go(2); }} />
      )}
      {step === 2 && hospital && (
        <VisitStep hospital={hospital} value={visit} onPick={(v) => { setVisit(v); setTime(""); go(3); }} />
      )}
      {step === 3 && hospital && doctor && (
        <DateTimeStep hospitalId={hospital.id} doctor={doctor === "any" ? null : doctor} visit={visit}
          date={date} time={time} onDate={(d) => { setDate(d); setTime(""); }} onTime={setTime} onNext={() => go(4)} />
      )}
      {step === 4 && hospital && doctor && date && time && (
        <section className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4">
          <h2 className="font-heading font-bold text-lg">Check and confirm</h2>
          <dl className="divide-y divide-border text-sm">
            <Summary label="Hospital">{hospital.name}<span className="block text-xs text-muted-foreground">{[hospital.address, hospital.city, hospital.state].filter(Boolean).join(", ")}</span></Summary>
            <Summary label="Doctor">{doctorName}{doctor !== "any" && doctor.specialty ? <span className="block text-xs text-muted-foreground">{doctor.specialty}</span> : null}</Summary>
            <Summary label="Visit">{visit === "video" ? "Video visit" : "In person"}</Summary>
            <Summary label="When">{fmtLongDate(date)} at {fmt12(time)}</Summary>
          </dl>
          <div className="space-y-1.5">
            <Label htmlFor="book-reason">Reason for the visit (optional)</Label>
            <Textarea id="book-reason" rows={3} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Headaches for two weeks" />
            <p className="text-xs text-muted-foreground">{reason.length}/500 · Shared with the hospital and your doctor.</p>
          </div>
          <p className="text-xs text-muted-foreground">The hospital confirms the time. If it's an emergency, go to the nearest emergency unit or call 112.</p>
          <Button className="w-full sm:w-auto" onClick={confirm} disabled={booking}>
            {booking ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}Book appointment
          </Button>
        </section>
      )}
    </div>
  );
}

function Chip({ icon: Icon, children, onClick }: { icon: typeof Building2; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-card px-2.5 py-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Change: ${typeof children === "string" ? children : ""}`}>
      <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" aria-hidden /><span className="truncate">{children}</span>
    </button>
  );
}

function Summary({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4"><dt className="text-muted-foreground sm:w-28 shrink-0">{label}</dt><dd className="font-medium min-w-0 break-words">{children}</dd></div>;
}

function ListSkeleton() {
  return <div className="space-y-3" aria-busy="true" aria-label="Loading">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>;
}

function ErrorBox({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center text-sm">
      <p>{dbMessage(error)}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>Retry</Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1. Hospital
// ---------------------------------------------------------------------------
function HospitalStep({ specialty, onClearSpecialty, coords, onPick }: {
  specialty: string | null; onClearSpecialty: () => void; coords: Coords | null; onPick: (h: Hospital) => void;
}) {
  const [text, setText] = useState("");
  const search = useDebounced(text.trim());
  const q = useQuery({
    queryKey: ["booking", "hospitals", specialty, coords?.lat ?? null, coords?.lng ?? null, search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bookable_hospitals", {
        p_specialty: specialty ?? undefined, p_lat: coords?.lat, p_lng: coords?.lng, p_search: search || undefined,
      });
      if (error) throw error;
      return (data ?? []) as Hospital[];
    },
    placeholderData: (prev) => prev,
    meta: { inlineError: true },
  });

  return (
    <section className="space-y-3">
      <h2 className="font-heading font-bold text-lg">Choose a hospital</h2>
      {specialty && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-primary"><Stethoscope className="w-3.5 h-3.5" aria-hidden />{specialty}</span>
          <span className="text-muted-foreground">Hospitals with {specialty} doctors are shown first.</span>
          <button type="button" className="inline-flex items-center gap-0.5 text-xs text-muted-foreground underline" onClick={onClearSpecialty}><X className="w-3 h-3" aria-hidden />Show all</button>
        </p>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by name, city or state" aria-label="Search hospitals" className="pl-9" />
      </div>
      {!coords && <p className="text-xs text-muted-foreground"><MapPin className="inline w-3 h-3 mr-0.5" aria-hidden />Allow location access to see distances.</p>}

      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : (q.data ?? []).length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Building2 className="w-8 h-8 mx-auto mb-2" aria-hidden />
          {search ? `No hospitals match "${search}".` : "No hospitals are taking bookings on HealingNet yet."}
        </div>
      ) : (
        <ul className={cn("space-y-2 transition-opacity", q.isFetching && "opacity-70")}>
          {q.data!.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => onPick(h)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4">
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted flex items-center justify-center">
                  {h.logo_url ? <img src={h.logo_url} alt="" className="h-full w-full object-cover" /> : <Building2 className="w-6 h-6 text-muted-foreground" aria-hidden />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{h.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[h.city, h.state].filter(Boolean).join(", ") || "Location not set"}
                    {h.distance_km != null && <> · {Number(h.distance_km).toLocaleString("en-NG", { maximumFractionDigits: 1 })} km away</>}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5", specialty && h.doctors_in_specialty > 0 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>
                      <Stethoscope className="w-3 h-3" aria-hidden />
                      {specialty
                        ? h.doctors_in_specialty > 0 ? `${h.doctors_in_specialty} ${specialty} doctor${h.doctors_in_specialty === 1 ? "" : "s"}` : "General doctors"
                        : `${h.doctors_total} doctor${h.doctors_total === 1 ? "" : "s"}`}
                    </span>
                    {h.offers_telemedicine && <span className="inline-flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-info"><Video className="w-3 h-3" aria-hidden />Video visits available</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 2. Doctor
// ---------------------------------------------------------------------------
function DoctorStep({ hospital, specialty, onPick }: { hospital: Hospital; specialty: string | null; onPick: (d: Doctor | "any") => void }) {
  const q = useQuery({
    queryKey: ["booking", "doctors", hospital.id, specialty],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bookable_doctors", { p_hospital_id: hospital.id, p_specialty: specialty ?? undefined });
      if (error) throw error;
      return (data ?? []) as Doctor[];
    },
    meta: { inlineError: true },
  });

  const card = "flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4";
  return (
    <section className="space-y-3">
      <h2 className="font-heading font-bold text-lg">Choose a doctor</h2>
      <button type="button" className={cn(card, "border-primary/40")} onClick={() => onPick("any")}>
        <div className="h-12 w-12 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Users className="w-6 h-6" aria-hidden /></div>
        <div className="min-w-0 flex-1">
          <p className="font-medium">Any available doctor</p>
          <p className="text-xs text-muted-foreground">{hospital.name} assigns the first available doctor{specialty ? `, a ${specialty} doctor where possible` : ""}.</p>
        </div>
        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : (q.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">This hospital hasn't listed individual doctors yet. Choose "Any available doctor".</p>
      ) : (
        <ul className="space-y-2">
          {q.data!.map((d) => (
            <li key={d.id}>
              <button type="button" className={cn(card, "border-border")} onClick={() => onPick(d)}>
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground flex items-center justify-center font-bold">
                  {d.profile_image_url ? <img src={d.profile_image_url} alt="" className="h-full w-full object-cover" /> : <>{d.first_name?.[0]}{d.last_name?.[0]}</>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">Dr. {d.first_name} {d.last_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.specialty || "General practice"}{d.years_experience != null ? ` · ${d.years_experience} yrs experience` : ""}
                  </p>
                  {d.bio && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.bio}</p>}
                  {specialty && d.matches_specialty && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-xs text-success"><Check className="w-3 h-3" aria-hidden />{specialty}</span>}
                </div>
                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3. Visit type
// ---------------------------------------------------------------------------
function VisitStep({ hospital, value, onPick }: { hospital: Hospital; value: Visit; onPick: (v: Visit) => void }) {
  const opt = "flex w-full items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return (
    <section className="space-y-3">
      <h2 className="font-heading font-bold text-lg">How would you like to be seen?</h2>
      <button type="button" className={cn(opt, value === "in_person" ? "border-primary" : "border-border", "hover:border-primary")} onClick={() => onPick("in_person")}>
        <Users className="w-6 h-6 shrink-0 text-primary" aria-hidden />
        <div className="flex-1"><p className="font-medium">In person</p><p className="text-xs text-muted-foreground">Visit {hospital.name}.</p></div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden />
      </button>
      <button type="button" disabled={!hospital.offers_telemedicine} aria-describedby={!hospital.offers_telemedicine ? "no-video" : undefined}
        className={cn(opt, value === "video" ? "border-primary" : "border-border", hospital.offers_telemedicine ? "hover:border-primary" : "cursor-not-allowed opacity-60")}
        onClick={() => onPick("video")}>
        <Video className="w-6 h-6 shrink-0 text-primary" aria-hidden />
        <div className="flex-1">
          <p className="font-medium">Video</p>
          <p id="no-video" className="text-xs text-muted-foreground">{hospital.offers_telemedicine ? "Talk to the doctor from your phone." : "This hospital doesn't offer video visits yet"}</p>
        </div>
        {hospital.offers_telemedicine && <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden />}
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------------
// 4. Date and time
// ---------------------------------------------------------------------------
interface AvailRow { day_of_week: number; start_time: string; end_time: string; hospital_id: string | null; accepts_in_person: boolean; accepts_virtual: boolean }

function DateTimeStep({ hospitalId, doctor, visit, date, time, onDate, onTime, onNext }: {
  hospitalId: string; doctor: Doctor | null; visit: Visit; date: string; time: string;
  onDate: (d: string) => void; onTime: (t: string) => void; onNext: () => void;
}) {
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
    meta: { inlineError: true },
  });

  // The doctor's own hours when they have published any; otherwise 08:00–17:00.
  const rows = doctor && avail.data && avail.data.length > 0 ? avail.data : null;
  const workDays = useMemo(() => (rows ? new Set(rows.map((r) => r.day_of_week)) : null), [rows]);

  const slots = useMemo(() => {
    if (!date) return [];
    let list = DEFAULT_SLOTS;
    if (rows) {
      const set = new Set<string>();
      rows.filter((r) => r.day_of_week === dayOfWeek(date)).forEach((r) => halfHours(r.start_time.slice(0, 5), r.end_time.slice(0, 5)).forEach((s) => set.add(s)));
      list = [...set].sort();
    }
    return list;
  }, [date, rows]);

  const now = lagosNowTime();
  const quickDays = Array.from({ length: 14 }, (_, i) => addDays(today, i)).filter((d) => !workDays || workDays.has(dayOfWeek(d))).slice(0, 7);

  if (doctor && avail.isLoading) return <ListSkeleton />;

  return (
    <section className="space-y-4">
      <h2 className="font-heading font-bold text-lg">Choose a date and time</h2>
      {rows && workDays && (
        <p className="text-xs text-muted-foreground">Dr. {doctor!.last_name} sees {visit === "video" ? "video" : "in-person"} patients on {[...workDays].sort().map((d) => DAY_NAMES[d]).join(", ")}.</p>
      )}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Upcoming days">
          {quickDays.map((d) => {
            const dt = new Date(d + "T00:00:00Z");
            return (
              <button key={d} type="button" onClick={() => onDate(d)} aria-pressed={date === d}
                className={cn("flex min-w-[64px] shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  date === d ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary")}>
                <span>{d === today ? "Today" : dt.toLocaleDateString("en-NG", { weekday: "short", timeZone: "UTC" })}</span>
                <span className="text-base font-bold tabular-nums">{dt.getUTCDate()}</span>
                <span>{dt.toLocaleDateString("en-NG", { month: "short", timeZone: "UTC" })}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Label htmlFor="book-date" className="text-sm text-muted-foreground">Or pick a date</Label>
          <Input id="book-date" type="date" className="w-auto" min={today} max={maxDate} value={date}
            onChange={(e) => { const v = e.target.value; if (!v || v < today || v > maxDate) return; onDate(v); }} />
        </div>
      </div>

      {date && (
        slots.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
            {rows ? `Dr. ${doctor!.last_name} doesn't see patients on ${DAY_NAMES[dayOfWeek(date)]}s. Choose another day.` : "No times on this day."}
          </p>
        ) : (
          <div>
            <p className="mb-2 text-sm font-medium">{fmtLongDate(date)}</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="group" aria-label="Times">
              {slots.map((s) => {
                const past = date === today && s <= now;
                return (
                  <button key={s} type="button" disabled={past} onClick={() => onTime(s)} aria-pressed={time === s}
                    className={cn("rounded-lg border px-2 py-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      time === s ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-primary",
                      past && "cursor-not-allowed opacity-40 line-through hover:border-border")}>
                    {fmt12(s)}
                  </button>
                );
              })}
            </div>
          </div>
        )
      )}
      <Button className="w-full sm:w-auto" disabled={!date || !time} onClick={onNext}>Continue<ChevronRight className="w-4 h-4 ml-1" /></Button>
    </section>
  );
}
