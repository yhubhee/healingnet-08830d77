// /patient/complete-profile: shown after signup (and on later visits) until the required
// details are filled in. Also used to edit the profile later (?edit=1).
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { supabase } from "@/integrations/supabase/client";
import { AvatarUpload } from "@/components/common/AvatarUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { usePatientProfile, useProfileStatus } from "@/hooks/usePatientData";
import { ALLOWED, pick } from "@/lib/allowed";
import { friendlyError } from "@/lib/errors";
import { lagosToday } from "@/lib/dates";
import { compactPhone, isNigerianPhone, missingPatientFields, NIGERIAN_STATES, profileProgressText } from "@/lib/patientProfile";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENOTYPES = ["AA", "AS", "AC", "SS", "SC", "CC"];

interface Form {
  phone: string; date_of_birth: string; gender: string; state: string; city: string; address: string;
  emergency_contact_name: string; emergency_contact_phone: string;
  blood_group: string; genotype: string; insurance_provider: string; insurance_policy_number: string;
  allergies: string; medical_conditions: string;
}
const HEALTH_NOTE_MAX = 500;
type Errors = Partial<Record<keyof Form, string>>;

function validate(f: Form): Errors {
  const e: Errors = {};
  if (!f.phone.trim()) e.phone = "Enter your phone number.";
  else if (!isNigerianPhone(f.phone)) e.phone = "Enter a Nigerian number, e.g. 0803 123 4567 or +234 803 123 4567.";
  if (!f.date_of_birth) e.date_of_birth = "Enter your date of birth.";
  else if (f.date_of_birth > lagosToday()) e.date_of_birth = "Your date of birth can't be in the future.";
  else if (f.date_of_birth < "1900-01-01") e.date_of_birth = "Check the year.";
  if (!f.gender) e.gender = "Choose your gender.";
  if (!f.state) e.state = "Choose your state.";
  if (!f.city.trim()) e.city = "Enter your city or town.";
  if (!f.address.trim()) e.address = "Enter your address.";
  if (!f.emergency_contact_name.trim()) e.emergency_contact_name = "Enter a name.";
  if (!f.emergency_contact_phone.trim()) e.emergency_contact_phone = "Enter a phone number.";
  else if (!isNigerianPhone(f.emergency_contact_phone)) e.emergency_contact_phone = "Enter a Nigerian number, e.g. 0803 123 4567.";
  return e;
}

const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function CompleteProfile() {
  const { data: p, isLoading } = usePatientProfile();
  const status = useProfileStatus();
  const [params] = useSearchParams();
  const editing = params.get("edit") === "1";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState<Form | null>(null);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!p || form) return;
    const s = (v: unknown) => (v == null ? "" : String(v));
    setForm({
      phone: s(p.phone), date_of_birth: s(p.date_of_birth), gender: s(p.gender), state: s(p.state), city: s(p.city),
      address: s(p.address), emergency_contact_name: s(p.emergency_contact_name), emergency_contact_phone: s(p.emergency_contact_phone),
      blood_group: s(p.blood_group), genotype: s(p.genotype), insurance_provider: s(p.insurance_provider), insurance_policy_number: s(p.insurance_policy_number),
      allergies: s(p.allergies), medical_conditions: s(p.medical_conditions),
    });
  }, [p, form]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["patient-profile"] });

  if (isLoading || !p || !form) {
    return <PatientLayout><div className="max-w-2xl mx-auto space-y-3"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-96 rounded-xl" /></div></PatientLayout>;
  }

  const errors = tried ? validate(form) : {};
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f!, [k]: v }));
  // First time: the local check, or the server saying the profile is incomplete.
  const firstTime = missingPatientFields(p).length > 0 || (!editing && status.data?.isPatient === true && !status.data.complete);
  const progress = profileProgressText(validate(form));

  const save = async () => {
    setTried(true);
    const errs = validate(form);
    if (Object.keys(errs).length) {
      document.getElementById(Object.keys(errs)[0])?.focus();
      return;
    }
    setSaving(true);
    const opt = (v: string) => v.trim() || null;
    const patch = {
      phone: compactPhone(form.phone), date_of_birth: form.date_of_birth, gender: form.gender, state: form.state,
      city: form.city.trim(), address: form.address.trim(), emergency_contact_name: form.emergency_contact_name.trim(),
      emergency_contact_phone: compactPhone(form.emergency_contact_phone),
      blood_group: opt(form.blood_group), genotype: opt(form.genotype),
      insurance_provider: opt(form.insurance_provider), insurance_policy_number: opt(form.insurance_policy_number),
      allergies: opt(form.allergies), medical_conditions: opt(form.medical_conditions),
    };
    const { error } = await supabase.from("patients").update(pick(patch, ALLOWED.patientUpdate) as never).eq("id", p.id);
    setSaving(false);
    if (error) { toast.error("Couldn't save your profile", { description: error.message || friendlyError(error) }); return; }
    await refresh();
    toast.success(firstTime ? "Profile complete" : "Profile saved");
    navigate(firstTime ? "/patient" : "/patient/profile", { replace: true });
  };

  const field = (k: keyof Form, label: string, input: ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={k}>{label}</Label>
      {input}
      {errors[k] ? <p id={`${k}-error`} className="text-xs text-destructive">{errors[k]}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
  const aria = (k: keyof Form) => ({ id: k, "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `${k}-error` : undefined });

  return (
    <PatientLayout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-heading font-bold">{firstTime ? "Complete your profile" : "Edit your profile"}</h1>
        <p className="text-sm text-muted-foreground mb-5">
          {firstTime ? "Hospitals need these details to book and treat you. It takes about 2 minutes." : "Keep your details up to date so hospitals can reach you."}
        </p>

        {firstTime && (
          <div className="mb-5" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label={`${progress.text}. Required details`}>
            <p className="mb-1 text-sm font-medium">{progress.text}</p>
            <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} /></div>
          </div>
        )}

        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save(); }} noValidate>
          <section className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4">
            <h2 className="font-heading font-bold">About you</h2>
            <AvatarUpload url={p.profile_image_url} initials={`${p.first_name?.[0] ?? ""}${p.last_name?.[0] ?? ""}`}
              onUploaded={async (url) => {
                const { error } = await supabase.from("patients").update(pick({ profile_image_url: url }, ALLOWED.patientUpdate) as never).eq("id", p.id);
                if (error) { toast.error("Couldn't save the photo", { description: error.message || friendlyError(error) }); return; }
                await refresh();
                toast.success("Photo saved");
              }} />
            <div className="grid gap-4 sm:grid-cols-2">
              {field("phone", "Phone number *", <Input type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" value={form.phone} onChange={(e) => set("phone")(e.target.value)} {...aria("phone")} />)}
              {field("date_of_birth", "Date of birth *", <Input type="date" max={lagosToday()} min="1900-01-01" value={form.date_of_birth} onChange={(e) => set("date_of_birth")(e.target.value)} {...aria("date_of_birth")} />)}
              {field("gender", "Gender *", (
                <select className={selectCls} value={form.gender} onChange={(e) => set("gender")(e.target.value)} {...aria("gender")}>
                  <option value="">Choose…</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option>
                </select>
              ))}
            </div>
          </section>

          <section className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4">
            <h2 className="font-heading font-bold">Where you live</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("state", "State *", (
                <select className={selectCls} value={form.state} onChange={(e) => set("state")(e.target.value)} {...aria("state")}>
                  <option value="">Choose…</option>
                  {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  {form.state && !NIGERIAN_STATES.includes(form.state) && <option value={form.state}>{form.state}</option>}
                </select>
              ))}
              {field("city", "City / town *", <Input autoComplete="address-level2" value={form.city} onChange={(e) => set("city")(e.target.value)} {...aria("city")} />)}
            </div>
            {field("address", "Address *", <Input autoComplete="street-address" value={form.address} onChange={(e) => set("address")(e.target.value)} {...aria("address")} />)}
          </section>

          <section className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4">
            <h2 className="font-heading font-bold">Emergency contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {field("emergency_contact_name", "Name *", <Input value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name")(e.target.value)} {...aria("emergency_contact_name")} />)}
              {field("emergency_contact_phone", "Phone *", <Input type="tel" inputMode="tel" value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone")(e.target.value)} {...aria("emergency_contact_phone")} />)}
            </div>
          </section>

          <section className="bg-card border border-border rounded-xl p-4 sm:p-6 space-y-4">
            <h2 className="font-heading font-bold">Medical and insurance <span className="text-sm font-normal text-muted-foreground">(optional)</span></h2>
            <div className="grid gap-4 grid-cols-2">
              {field("blood_group", "Blood group", (
                <select className={selectCls} value={form.blood_group} onChange={(e) => set("blood_group")(e.target.value)} {...aria("blood_group")}>
                  <option value="">Not sure</option>{BLOOD_GROUPS.map((b) => <option key={b}>{b}</option>)}
                </select>
              ))}
              {field("genotype", "Genotype", (
                <select className={selectCls} value={form.genotype} onChange={(e) => set("genotype")(e.target.value)} {...aria("genotype")}>
                  <option value="">Not sure</option>{GENOTYPES.map((g) => <option key={g}>{g}</option>)}
                </select>
              ))}
            </div>
            {field("allergies", "Allergies", <Textarea rows={2} maxLength={HEALTH_NOTE_MAX} placeholder="e.g. Penicillin, peanuts. Leave empty if none are known." value={form.allergies} onChange={(e) => set("allergies")(e.target.value)} {...aria("allergies")} />)}
            {field("medical_conditions", "Long-term conditions", <Textarea rows={2} maxLength={HEALTH_NOTE_MAX} placeholder="e.g. Asthma, high blood pressure, sickle cell. Leave empty if none are known." value={form.medical_conditions} onChange={(e) => set("medical_conditions")(e.target.value)} {...aria("medical_conditions")} />)}
            <div className="grid gap-4 sm:grid-cols-2">
              {field("insurance_provider", "Insurance / HMO", <Input placeholder="e.g. NHIA, Hygeia" value={form.insurance_provider} onChange={(e) => set("insurance_provider")(e.target.value)} {...aria("insurance_provider")} />)}
              {field("insurance_policy_number", "Policy number", <Input value={form.insurance_policy_number} onChange={(e) => set("insurance_policy_number")(e.target.value)} {...aria("insurance_policy_number")} />)}
            </div>
          </section>

          <p className="flex items-start gap-2 text-xs text-muted-foreground"><ShieldCheck className="w-4 h-4 shrink-0" aria-hidden />Only hospitals you visit, and doctors treating you, can see these details.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {!firstTime && <Button type="button" variant="outline" onClick={() => navigate("/patient/profile")}>Cancel</Button>}
            <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}{firstTime ? "Save and continue" : "Save changes"}</Button>
          </div>
        </form>
      </div>
    </PatientLayout>
  );
}
