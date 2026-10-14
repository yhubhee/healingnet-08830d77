// /doctor/onboarding: "Finish setting up your profile" for approved doctors whose profile is
// incomplete. Three steps: photo and contact, professional details and bio, availability.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Check, CheckCircle2, Loader2 } from "lucide-react";
import { DoctorLayout } from "@/layouts/DoctorLayout";
import { supabase } from "@/integrations/supabase/client";
import { AvatarUpload } from "@/components/common/AvatarUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ALLOWED, pick } from "@/lib/allowed";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { BIO_MIN, DOCTOR_STATUS_KEY, missingProfileItems, useDoctorStatus, type DoctorStatus, type ProfileItem } from "@/hooks/useDoctorStatus";

const STEPS = [
  { n: 1, title: "Photo and contact", items: ["photo", "phone"] as ProfileItem[] },
  { n: 2, title: "Professional details", items: ["specialty", "years_experience", "bio"] as ProfileItem[] },
  { n: 3, title: "Availability", items: ["availability"] as ProfileItem[] },
];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Database errors from these writes are plain English; show them. */
const dbMessage = (e: unknown) => String((e as { message?: string })?.message || "") || friendlyError(e);

export default function DoctorOnboarding() {
  const { data: doc, isLoading } = useDoctorStatus();
  const navigate = useNavigate();
  const [step, setStep] = useState<number | null>(null);

  const missing = doc ? missingProfileItems(doc) : [];
  const done = !!doc && missing.length === 0;

  // Start at the first step with something missing.
  useEffect(() => {
    if (doc && step === null) {
      const first = STEPS.find((s) => s.items.some((i) => missing.includes(i)));
      setStep(first?.n ?? 3);
    }
  }, [doc, step, missing]);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => navigate("/doctor", { replace: true }), 2500);
    return () => clearTimeout(t);
  }, [done, navigate]);

  return (
    <DoctorLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-heading font-bold">Finish setting up your profile</h1>
        <p className="text-sm text-muted-foreground mb-5">Patients see this when they choose a doctor. It takes about 3 minutes.</p>

        {isLoading || !doc || step === null ? (
          <div className="space-y-3"><Skeleton className="h-10 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
        ) : done ? (
          <div className="bg-card border border-success/30 rounded-xl p-8 text-center" role="status">
            <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-3" aria-hidden />
            <h2 className="text-xl font-heading font-bold">Your profile is complete</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-5">Patients can now book you. Taking you to your dashboard…</p>
            <Button onClick={() => navigate("/doctor", { replace: true })}>Go to dashboard</Button>
          </div>
        ) : (
          <>
            <ol className="grid grid-cols-3 gap-2 mb-5" aria-label="Steps">
              {STEPS.map((s) => {
                const complete = s.items.every((i) => !missing.includes(i));
                return (
                  <li key={s.n}>
                    <button type="button" onClick={() => setStep(s.n)} aria-current={step === s.n ? "step" : undefined}
                      className={cn("w-full rounded-lg border p-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        step === s.n ? "border-primary bg-primary/10" : "border-border")}>
                      <span className={cn("mb-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold", complete ? "bg-success text-success-foreground" : "bg-muted")}>
                        {complete ? <Check className="h-3 w-3" aria-label="done" /> : s.n}
                      </span>
                      <span className="block font-medium leading-tight">{s.title}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
              {step === 1 && <StepContact doc={doc} onNext={() => setStep(2)} />}
              {step === 2 && <StepProfessional doc={doc} onNext={() => setStep(3)} />}
              {step === 3 && <StepAvailability doc={doc} />}
            </div>
          </>
        )}
      </div>
    </DoctorLayout>
  );
}

function useSaveDoctor(doc: DoctorStatus) {
  const qc = useQueryClient();
  return async (patch: Record<string, unknown>) => {
    const { error } = await supabase.from("doctors").update(pick(patch, ALLOWED.doctorUpdate) as never).eq("id", doc.id);
    if (error) throw error;
    await Promise.all([qc.invalidateQueries({ queryKey: DOCTOR_STATUS_KEY }), qc.invalidateQueries({ queryKey: ["doctor", "self"] })]);
  };
}

function StepContact({ doc, onNext }: { doc: DoctorStatus; onNext: () => void }) {
  const save = useSaveDoctor(doc);
  const [phone, setPhone] = useState(doc.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const phoneErr = !phone.trim() ? "Enter a phone number patients' hospitals can reach you on." : null;
  const initials = `${doc.first_name?.[0] ?? ""}${doc.last_name?.[0] ?? ""}`;

  const next = async () => {
    setTried(true);
    if (!doc.profile_image_url || phoneErr) return;
    setSaving(true);
    try {
      if (phone.trim() !== (doc.phone ?? "")) await save({ phone: phone.trim() });
      onNext();
    } catch (e) {
      toast.error("Couldn't save", { description: dbMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <h2 className="font-heading font-bold text-lg">Photo and contact</h2>
      <div>
        <AvatarUpload url={doc.profile_image_url} initials={initials} required
          onUploaded={async (url) => { try { await save({ profile_image_url: url }); toast.success("Photo saved"); } catch (e) { toast.error("Couldn't save the photo", { description: dbMessage(e) }); } }} />
        {tried && !doc.profile_image_url && <p className="mt-2 text-xs text-destructive">Add a clear photo of your face.</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ob-phone">Phone *</Label>
        <Input id="ob-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 0803 123 4567" aria-invalid={tried && !!phoneErr} />
        {tried && phoneErr && <p className="text-xs text-destructive">{phoneErr}</p>}
      </div>
      <div className="flex justify-end"><Button onClick={next} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Continue<ArrowRight className="w-4 h-4 ml-1" /></Button></div>
    </div>
  );
}

function StepProfessional({ doc, onNext }: { doc: DoctorStatus; onNext: () => void }) {
  const save = useSaveDoctor(doc);
  const [specialty, setSpecialty] = useState(doc.specialty ?? "");
  const [years, setYears] = useState(doc.years_experience != null ? String(doc.years_experience) : "");
  const [bio, setBio] = useState(doc.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);
  const y = Number(years);
  const errs = {
    specialty: !specialty.trim() ? "Enter your specialty." : null,
    years: years === "" || !Number.isInteger(y) || y < 0 || y > 70 ? "Enter whole years, from 0 to 70." : null,
    bio: bio.trim().length < BIO_MIN ? `Write at least ${BIO_MIN} characters (${bio.trim().length} so far).` : null,
  };

  const next = async () => {
    setTried(true);
    if (errs.specialty || errs.years || errs.bio) return;
    setSaving(true);
    try {
      await save({ specialty: specialty.trim(), years_experience: y, bio: bio.trim() });
      onNext();
    } catch (e) {
      toast.error("Couldn't save", { description: dbMessage(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="font-heading font-bold text-lg">Professional details</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="ob-spec">Specialty *</Label>
          <Input id="ob-spec" value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Paediatrics" aria-invalid={tried && !!errs.specialty} />
          {tried && errs.specialty && <p className="text-xs text-destructive">{errs.specialty}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ob-years">Years of experience *</Label>
          <Input id="ob-years" type="number" inputMode="numeric" min={0} max={70} value={years} onChange={(e) => setYears(e.target.value)} aria-invalid={tried && !!errs.years} />
          {tried && errs.years && <p className="text-xs text-destructive">{errs.years}</p>}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ob-bio">Short bio *</Label>
        <Textarea id="ob-bio" rows={5} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000}
          placeholder="Your training, what you treat, languages you speak…" aria-invalid={tried && !!errs.bio} />
        <p className={cn("text-xs", tried && errs.bio ? "text-destructive" : "text-muted-foreground")}>
          {tried && errs.bio ? errs.bio : `${bio.trim().length} / at least ${BIO_MIN} characters`}
        </p>
      </div>
      <div className="flex justify-end"><Button onClick={next} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Continue<ArrowRight className="w-4 h-4 ml-1" /></Button></div>
    </div>
  );
}

interface DaySlot { day: number; on: boolean; start: string; end: string; inPerson: boolean; virtual: boolean }

function StepAvailability({ doc }: { doc: DoctorStatus }) {
  const qc = useQueryClient();
  const [slots, setSlots] = useState<DaySlot[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("doctor_availability").select("day_of_week, start_time, end_time, is_available, accepts_in_person, accepts_virtual")
        .eq("doctor_id", doc.id).is("hospital_id", null);
      setSlots(DAYS.map((_, day) => {
        const r = (data ?? []).find((x) => x.day_of_week === day);
        return r
          ? { day, on: r.is_available, start: r.start_time.slice(0, 5), end: r.end_time.slice(0, 5), inPerson: r.accepts_in_person, virtual: r.accepts_virtual }
          : { day, on: day >= 1 && day <= 5, start: "09:00", end: "17:00", inPerson: true, virtual: false };
      }));
    })();
  }, [doc.id]);

  if (!slots) return <Skeleton className="h-64 rounded-xl" />;

  const set = (day: number, patch: Partial<DaySlot>) => setSlots((s) => s!.map((x) => (x.day === day ? { ...x, ...patch } : x)));
  const onDays = slots.filter((s) => s.on);
  const badTimes = onDays.filter((s) => !s.start || !s.end || s.end <= s.start).map((s) => s.day);
  const noMode = onDays.filter((s) => !s.inPerson && !s.virtual).map((s) => s.day);
  const err = onDays.length === 0 ? "Turn on at least one day." : badTimes.length ? "End time must be after start time." : noMode.length ? "Choose in-person, video or both for each day you're on." : null;

  const finish = async () => {
    setTried(true);
    if (err) return;
    setSaving(true);
    const { error } = await supabase.rpc("save_doctor_availability", {
      p_global: true,
      p_hospital_ids: [],
      p_slots: slots.map((s) => ({
        hospital_id: null, day_of_week: s.day, start_time: s.start, end_time: s.end,
        is_available: s.on, accepts_in_person: s.inPerson, accepts_virtual: s.virtual,
      })),
    });
    setSaving(false);
    if (error) { toast.error("Couldn't save your availability", { description: dbMessage(error) }); return; }
    await qc.invalidateQueries({ queryKey: DOCTOR_STATUS_KEY });
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading font-bold text-lg">Availability</h2>
        <p className="text-sm text-muted-foreground">When patients can book you. You can change this any time in Settings.</p>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {slots.map((s) => (
          <li key={s.day} className="p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={`day-${s.day}`} className="font-medium">{DAYS[s.day]}</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{s.on ? "Available" : "Off"}</span>
                <Switch id={`day-${s.day}`} checked={s.on} onCheckedChange={(v) => set(s.day, { on: v })} />
              </div>
            </div>
            {s.on && (
              <div className="flex flex-wrap items-center gap-2">
                <Input type="time" aria-label={`${DAYS[s.day]} start`} className={cn("w-28", tried && badTimes.includes(s.day) && "border-destructive")} value={s.start} onChange={(e) => set(s.day, { start: e.target.value })} />
                <span className="text-sm text-muted-foreground">to</span>
                <Input type="time" aria-label={`${DAYS[s.day]} end`} className={cn("w-28", tried && badTimes.includes(s.day) && "border-destructive")} value={s.end} onChange={(e) => set(s.day, { end: e.target.value })} />
                <label className="flex items-center gap-1.5 text-xs"><Switch checked={s.inPerson} onCheckedChange={(v) => set(s.day, { inPerson: v })} />In person</label>
                <label className="flex items-center gap-1.5 text-xs"><Switch checked={s.virtual} onCheckedChange={(v) => set(s.day, { virtual: v })} />Video</label>
              </div>
            )}
          </li>
        ))}
      </ul>
      {tried && err && <p className="text-sm text-destructive" role="alert">{err}</p>}
      <div className="flex justify-end"><Button onClick={finish} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Save and finish</Button></div>
    </div>
  );
}
