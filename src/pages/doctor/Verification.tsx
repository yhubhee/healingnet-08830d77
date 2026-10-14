import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, ArrowRight, CheckCircle2, Clock, FileText, Loader2, Shield, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { friendlyError } from "@/lib/errors";
import { addDays, daysFromToday, fmtLongDate, lagosToday } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { DOCTOR_STATUS_KEY, missingProfileItems, useDoctorStatus, type DoctorStatus } from "@/hooks/useDoctorStatus";

const OTHER = "Other";
const COUNCILS = [
  "MDCN (Medical and Dental Council of Nigeria)",
  "WACP",
  "WACS",
  "NPMCN (National Postgraduate Medical College of Nigeria)",
  OTHER,
];
const DOC_FIELDS = [
  { key: "license", label: "Medical licence / practising certificate" },
  { key: "id", label: "Government-issued ID (NIN slip, passport, driver's licence)" },
  { key: "certificate", label: "Medical school certificate / MBBS" },
] as const;
type DocKey = (typeof DOC_FIELDS)[number]["key"];

export default function DoctorVerification() {
  const { data: doc, isLoading, isError, refetch } = useDoctorStatus();

  let body: ReactNode;
  if (isLoading) body = <div className="space-y-4"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64 rounded-xl" /></div>;
  else if (isError) body = <div className="text-sm text-muted-foreground">Couldn't load your verification status. <button className="text-primary underline" onClick={() => refetch()}>Retry</button></div>;
  else if (!doc) body = <div className="text-muted-foreground">Doctor profile not found.</div>;
  else if (doc.verification_status === "pending_review") body = <PendingView doc={doc} />;
  else if (doc.verification_status === "approved") body = <ApprovedView doc={doc} />;
  else body = <VerificationForm doc={doc} />;

  return (
    <DoctorLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/15 text-primary flex items-center justify-center"><Shield className="w-6 h-6" /></div>
          <div className="min-w-0">
            <h1 className="text-2xl font-heading font-bold">Doctor verification</h1>
            <p className="text-sm text-muted-foreground">We check every doctor's licence before patients can book them.</p>
          </div>
        </div>
        {body}
      </div>
    </DoctorLayout>
  );
}

// ---------------------------------------------------------------------------
// Status views
// ---------------------------------------------------------------------------
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:justify-between sm:gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium sm:text-right break-words">{children || "—"}</span>
    </div>
  );
}

function ExpiryValue({ date }: { date: string | null }) {
  if (!date) return <>—</>;
  const d = daysFromToday(date);
  if (d <= 30) {
    return (
      <span className={cn("inline-flex items-center gap-1", d <= 0 ? "text-destructive" : "text-warning")}>
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden />{fmtLongDate(date)} · {d <= 0 ? "Expired" : `expires in ${d} day${d === 1 ? "" : "s"}`}
      </span>
    );
  }
  return <>{fmtLongDate(date)}</>;
}

function practiceText(p: DoctorStatus["current_practice"]) {
  if (!p?.name) return null;
  const when = p.from ? ` (${fmtLongDate(p.from)} – ${p.to ? fmtLongDate(p.to) : "present"})` : "";
  return [p.name, p.role, p.city].filter(Boolean).join(" · ") + when;
}

function PendingView({ doc }: { doc: DoctorStatus }) {
  const docs = Object.keys(doc.credential_documents ?? {});
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex gap-3">
        <Clock className="w-5 h-5 shrink-0 text-warning mt-0.5" aria-hidden />
        <div>
          <p className="font-medium">Under review: usually 24–48 hours. We'll email you.</p>
          <p className="text-sm text-muted-foreground">Submitted {fmtLongDate(doc.verification_submitted_at)}. You can't change the details while they're being reviewed.</p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-5 divide-y divide-border">
        <Row label="Licence number">{doc.license_number}</Row>
        <Row label="Issuing council">{doc.license_council}</Row>
        <Row label="Licence expiry"><ExpiryValue date={doc.license_expiry} /></Row>
        <Row label="Specialty">{doc.specialty}</Row>
        <Row label="Years of experience">{doc.years_experience != null ? String(doc.years_experience) : null}</Row>
        <Row label="Current / last practice">{practiceText(doc.current_practice)}</Row>
        <Row label="Reference">{doc.reference_contact?.name ? [doc.reference_contact.name, doc.reference_contact.hospital, doc.reference_contact.phone].filter(Boolean).join(" · ") : null}</Row>
        <Row label="Documents">{docs.length ? `${docs.length} uploaded` : null}</Row>
      </div>
    </div>
  );
}

function ApprovedView({ doc }: { doc: DoctorStatus }) {
  const incomplete = missingProfileItems(doc).length > 0;
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-success/30 bg-success/10 p-4 flex gap-3">
        <CheckCircle2 className="w-5 h-5 shrink-0 text-success mt-0.5" aria-hidden />
        <div>
          <p className="font-medium">✓ Verified on {fmtLongDate(doc.verification_reviewed_at)}</p>
          <p className="text-sm text-muted-foreground">Patients and hospitals can now find you on HealingNet.</p>
        </div>
      </div>
      <div className="bg-card border border-border rounded-xl p-5 divide-y divide-border">
        <Row label="Licence number">{doc.license_number}</Row>
        <Row label="Issuing council">{doc.license_council}</Row>
        <Row label="Licence expiry"><ExpiryValue date={doc.license_expiry} /></Row>
      </div>
      <Button asChild className="w-full sm:w-auto">
        <Link to={incomplete ? "/doctor/onboarding" : "/doctor"}>{incomplete ? "Complete your profile" : "Go to dashboard"}<ArrowRight className="w-4 h-4 ml-1" /></Link>
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form (unverified, or rejected with the previous answers pre-filled)
// ---------------------------------------------------------------------------
interface FormState {
  licenseNumber: string; council: string; otherCouncil: string; licenseExpiry: string;
  specialty: string; yearsExperience: string;
  practiceName: string; practiceCity: string; practiceRole: string; practiceFrom: string; practiceTo: string; currentlyHere: boolean;
  refName: string; refHospital: string; refPhone: string;
}

function initialForm(doc: DoctorStatus): FormState {
  const known = doc.license_council && COUNCILS.includes(doc.license_council);
  const p = doc.current_practice ?? {};
  const r = doc.reference_contact ?? {};
  return {
    licenseNumber: doc.license_number ?? "",
    council: !doc.license_council ? COUNCILS[0] : known ? doc.license_council : OTHER,
    otherCouncil: doc.license_council && !known ? doc.license_council : "",
    licenseExpiry: doc.license_expiry ?? "",
    specialty: doc.specialty ?? "",
    yearsExperience: doc.years_experience != null ? String(doc.years_experience) : "",
    practiceName: p.name ?? "", practiceCity: p.city ?? "", practiceRole: p.role ?? "",
    practiceFrom: p.from ?? "", practiceTo: p.to ?? "", currentlyHere: !!p.name && !p.to,
    refName: r.name ?? "", refHospital: r.hospital ?? "", refPhone: r.phone ?? "",
  };
}

type Errors = Partial<Record<keyof FormState | DocKey, string>>;

function validate(f: FormState, step: number, files: Record<DocKey, File | null>, existing: Record<string, string>): Errors {
  const e: Errors = {};
  const today = lagosToday();
  if (step === 1) {
    if (!f.licenseNumber.trim()) e.licenseNumber = "Enter your licence number.";
    if (f.council === OTHER && !f.otherCouncil.trim()) e.otherCouncil = "Enter the issuing council.";
    if (!f.licenseExpiry) e.licenseExpiry = "Enter your licence expiry date.";
    else if (f.licenseExpiry <= today) e.licenseExpiry = "Your licence has expired. Renew it before submitting.";
    if (!f.specialty.trim()) e.specialty = "Enter your specialty.";
    const y = Number(f.yearsExperience);
    if (f.yearsExperience === "" || !Number.isInteger(y) || y < 0 || y > 70) e.yearsExperience = "Enter whole years, from 0 to 70.";
  }
  if (step === 2) {
    if (!f.practiceName.trim()) e.practiceName = "Enter the hospital or clinic name.";
    if (!f.practiceCity.trim()) e.practiceCity = "Enter the city.";
    if (!f.practiceRole.trim()) e.practiceRole = "Enter your role.";
    if (f.practiceFrom && f.practiceFrom > today) e.practiceFrom = "The start date can't be in the future.";
    if (!f.currentlyHere && f.practiceTo) {
      if (f.practiceTo > today) e.practiceTo = "The end date can't be in the future. Tick \"I currently work here\" if you still do.";
      else if (f.practiceFrom && f.practiceTo < f.practiceFrom) e.practiceTo = "The end date must be after the start date.";
    }
  }
  if (step === 3) {
    for (const d of DOC_FIELDS) if (!files[d.key] && !existing[d.key]) e[d.key] = "This document is required.";
  }
  return e;
}

function Field({ id, label, error, hint, children }: { id: string; label: ReactNode; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function VerificationForm({ doc }: { doc: DoctorStatus }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(() => initialForm(doc));
  const existing = useMemo(() => {
    const out: Record<string, string> = {};
    for (const d of DOC_FIELDS) { const p = doc.credential_documents?.[d.key]; if (p) out[d.key] = p; }
    return out;
  }, [doc.credential_documents]);
  const [files, setFiles] = useState<Record<DocKey, File | null>>({ license: null, id: null, certificate: null });
  const [shown, setShown] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const today = lagosToday();
  const tomorrow = addDays(today, 1);
  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Errors appear after "Continue" is pressed; date errors appear as soon as a date is entered.
  const all = validate(form, step, files, existing);
  const errors: Errors = shown.has(step) ? all : Object.fromEntries(
    Object.entries(all).filter(([k]) => (k === "licenseExpiry" && form.licenseExpiry) || (k === "practiceFrom" && form.practiceFrom) || (k === "practiceTo" && form.practiceTo)),
  );
  const aria = (k: keyof Errors) => ({ "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `${k}-error` : undefined });

  const next = () => {
    setShown((s) => new Set(s).add(step));
    if (Object.keys(all).length === 0) setStep(step + 1);
  };

  const submit = async () => {
    setShown((s) => new Set(s).add(3));
    if (Object.keys(validate(form, 3, files, existing)).length) return;
    for (const s of [1, 2]) {
      if (Object.keys(validate(form, s, files, existing)).length) { setShown((x) => new Set(x).add(s)); setStep(s); return; }
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Please sign in again.");
      const uploaded: Record<string, string> = { ...existing };
      for (const d of DOC_FIELDS) {
        const file = files[d.key];
        if (!file) continue;
        const path = `${user.id}/${d.key}-${Date.now()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
        const { error } = await supabase.storage.from("doctor-credentials").upload(path, file, { upsert: false });
        if (error) {
          toast.error(`Couldn't upload your ${d.label.split(" (")[0].toLowerCase()}`, { description: friendlyError(error) });
          return;
        }
        uploaded[d.key] = path;
      }

      const { error } = await supabase.rpc("submit_doctor_verification", {
        p_data: {
          license_number: form.licenseNumber.trim(),
          license_council: form.council === OTHER ? form.otherCouncil.trim() : form.council,
          license_expiry: form.licenseExpiry,
          specialty: form.specialty.trim(),
          years_experience: parseInt(form.yearsExperience, 10),
          current_practice: {
            name: form.practiceName.trim(), city: form.practiceCity.trim(), role: form.practiceRole.trim(),
            from: form.practiceFrom || null, to: form.currentlyHere ? null : form.practiceTo || null,
          },
          credential_documents: uploaded,
          reference_contact: form.refName.trim() ? { name: form.refName.trim(), hospital: form.refHospital.trim(), phone: form.refPhone.trim() } : null,
        },
      });
      // The database explains what's wrong in plain English.
      if (error) { toast.error("Couldn't submit your credentials", { description: error.message || friendlyError(error) }); return; }

      toast.success("Submitted for review", { description: "We'll email you within 24–48 hours." });
      await qc.invalidateQueries({ queryKey: DOCTOR_STATUS_KEY });
      window.scrollTo({ top: 0 });
    } catch (e) {
      toast.error("Couldn't submit your credentials", { description: friendlyError(e) });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {doc.verification_status === "rejected" && (
        <div className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-destructive mt-0.5" aria-hidden />
          <div>
            <p className="font-medium text-destructive">Your previous submission wasn't approved</p>
            {doc.verification_rejection_reason && <p className="mt-0.5">Reason: {doc.verification_rejection_reason}</p>}
            <p className="mt-1 text-muted-foreground">Your previous answers are filled in below. Fix what's needed and submit again.</p>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground mb-2">Step {step} of 3 · about 5 minutes</p>
      <div className="flex gap-2 mb-6" aria-hidden>
        {[1, 2, 3].map((s) => <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />)}
      </div>

      <div className="bg-card border border-border rounded-xl p-4 sm:p-6">
        {step === 1 && (
          <>
            <h2 className="font-heading font-bold text-lg mb-4">Licence and specialty</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Field id="licenseNumber" label="Medical licence number *" error={errors.licenseNumber}>
                <Input id="licenseNumber" value={form.licenseNumber} onChange={(e) => update("licenseNumber", e.target.value)} placeholder="e.g. MDCN/R/12345" {...aria("licenseNumber")} />
              </Field>
              <Field id="council" label="Issuing council *">
                <select id="council" value={form.council} onChange={(e) => update("council", e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {COUNCILS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              {form.council === OTHER && (
                <Field id="otherCouncil" label="Enter the issuing council *" error={errors.otherCouncil}>
                  <Input id="otherCouncil" value={form.otherCouncil} onChange={(e) => update("otherCouncil", e.target.value)} placeholder="e.g. General Medical Council (UK)" {...aria("otherCouncil")} />
                </Field>
              )}
              <Field id="licenseExpiry" label="Licence expiry *" error={errors.licenseExpiry}>
                <Input id="licenseExpiry" type="date" min={tomorrow} value={form.licenseExpiry} onChange={(e) => update("licenseExpiry", e.target.value)} {...aria("licenseExpiry")} />
              </Field>
              <Field id="specialty" label="Specialty *" error={errors.specialty}>
                <Input id="specialty" value={form.specialty} onChange={(e) => update("specialty", e.target.value)} placeholder="e.g. Cardiology" {...aria("specialty")} />
              </Field>
              <Field id="yearsExperience" label="Years of experience *" error={errors.yearsExperience}>
                <Input id="yearsExperience" type="number" inputMode="numeric" min={0} max={70} value={form.yearsExperience} onChange={(e) => update("yearsExperience", e.target.value)} placeholder="e.g. 10" {...aria("yearsExperience")} />
              </Field>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-heading font-bold text-lg mb-1">Current or last place of practice</h2>
            <p className="text-sm text-muted-foreground mb-4">Helps us confirm where you've worked.</p>
            <div className="grid md:grid-cols-2 gap-4">
              <Field id="practiceName" label="Hospital / clinic name *" error={errors.practiceName}>
                <Input id="practiceName" value={form.practiceName} onChange={(e) => update("practiceName", e.target.value)} placeholder="e.g. LUTH" {...aria("practiceName")} />
              </Field>
              <Field id="practiceCity" label="City *" error={errors.practiceCity}>
                <Input id="practiceCity" value={form.practiceCity} onChange={(e) => update("practiceCity", e.target.value)} placeholder="e.g. Lagos" {...aria("practiceCity")} />
              </Field>
              <Field id="practiceRole" label="Your role *" error={errors.practiceRole}>
                <Input id="practiceRole" value={form.practiceRole} onChange={(e) => update("practiceRole", e.target.value)} placeholder="e.g. Consultant" {...aria("practiceRole")} />
              </Field>
              <Field id="practiceFrom" label="From" error={errors.practiceFrom}>
                <Input id="practiceFrom" type="date" max={today} value={form.practiceFrom} onChange={(e) => update("practiceFrom", e.target.value)} {...aria("practiceFrom")} />
              </Field>
              <Field id="practiceTo" label="To (leave blank if current)" error={errors.practiceTo}>
                <Input id="practiceTo" type="date" max={today} min={form.practiceFrom || undefined} value={form.currentlyHere ? "" : form.practiceTo}
                  disabled={form.currentlyHere} onChange={(e) => update("practiceTo", e.target.value)} {...aria("practiceTo")} />
              </Field>
              <div className="flex items-center gap-2 md:pt-7">
                <Checkbox id="currentlyHere" checked={form.currentlyHere}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, currentlyHere: v === true, practiceTo: v === true ? "" : f.practiceTo }))} />
                <Label htmlFor="currentlyHere" className="font-normal">I currently work here</Label>
              </div>
            </div>

            <h3 className="font-heading font-bold mt-6 mb-2">Professional reference (optional)</h3>
            <div className="grid md:grid-cols-3 gap-4">
              <Field id="refName" label="Name"><Input id="refName" value={form.refName} onChange={(e) => update("refName", e.target.value)} /></Field>
              <Field id="refHospital" label="Hospital"><Input id="refHospital" value={form.refHospital} onChange={(e) => update("refHospital", e.target.value)} /></Field>
              <Field id="refPhone" label="Phone"><Input id="refPhone" type="tel" value={form.refPhone} onChange={(e) => update("refPhone", e.target.value)} /></Field>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-heading font-bold text-lg mb-1">Upload credentials</h2>
            <p className="text-sm text-muted-foreground mb-4">PDF, JPG or PNG, up to 10 MB each. Stored privately; only HealingNet reviewers can see them.</p>
            <div className="space-y-3">
              {DOC_FIELDS.map((d) => (
                <div key={d.key}>
                  <label className={cn("flex items-center gap-3 p-4 border border-dashed rounded-lg cursor-pointer hover:bg-muted/20 focus-within:ring-2 focus-within:ring-ring", errors[d.key] ? "border-destructive" : "border-border")}>
                    <div className="w-10 h-10 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><FileText className="w-5 h-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{d.label} <span className="text-destructive">*</span></div>
                      <div className="text-xs text-muted-foreground truncate">
                        {files[d.key]?.name || (existing[d.key] ? "Previously uploaded. Choose a file to replace it." : "Tap to choose a file")}
                      </div>
                    </div>
                    <Upload className="w-4 h-4 shrink-0 text-muted-foreground" aria-hidden />
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" aria-describedby={errors[d.key] ? `${d.key}-error` : undefined}
                      onChange={(e) => setFiles({ ...files, [d.key]: e.target.files?.[0] || null })} />
                  </label>
                  {errors[d.key] && <p id={`${d.key}-error`} className="mt-1 text-xs text-destructive">{errors[d.key]}</p>}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="flex justify-between gap-2 mt-6 pt-5 border-t border-border">
          <Button variant="outline" disabled={step === 1 || submitting} onClick={() => setStep(step - 1)}>Back</Button>
          {step < 3 ? (
            <Button onClick={next}>Continue <ArrowRight className="w-4 h-4 ml-1" /></Button>
          ) : (
            <Button onClick={submit} disabled={submitting}>{submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{submitting ? "Submitting…" : "Submit for review"}</Button>
          )}
        </div>
      </div>
    </>
  );
}
