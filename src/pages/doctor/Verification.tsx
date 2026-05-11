import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Upload, FileText, Shield, ArrowRight } from "lucide-react";

const COUNCILS = ["MDCN (Medical and Dental Council of Nigeria)", "WACS", "WACP", "RCS", "Other"];
const DOC_FIELDS = [
  { key: "license", label: "Medical license / practising certificate", required: true },
  { key: "id", label: "Government-issued ID (NIN slip, passport, driver's license)", required: true },
  { key: "certificate", label: "Medical school certificate / MBBS", required: true },
  { key: "photo", label: "Professional passport photo", required: true },
];

export default function DoctorVerification() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    licenseNumber: "", licenseCouncil: COUNCILS[0], licenseExpiry: "",
    specialty: "", yearsExperience: "",
    practiceName: "", practiceCity: "", practiceRole: "", practiceFrom: "", practiceTo: "",
    refName: "", refHospital: "", refPhone: "",
  });
  const [files, setFiles] = useState<Record<string, File | null>>({ license: null, id: null, certificate: null, photo: null });
  const [submitting, setSubmitting] = useState(false);

  const update = (k: string, v: string) => setForm({ ...form, [k]: v });

  const submit = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const uploaded: Record<string, string> = {};
      for (const f of DOC_FIELDS) {
        const file = files[f.key];
        if (!file) throw new Error(`Please upload ${f.label}`);
        const path = `${user.id}/${f.key}-${Date.now()}-${file.name}`;
        const { error } = await supabase.storage.from("doctor-credentials").upload(path, file, { upsert: false });
        if (error) throw error;
        uploaded[f.key] = path;
      }

      const { error: upErr } = await supabase.from("doctors").update({
        license_number: form.licenseNumber,
        license_council: form.licenseCouncil,
        license_expiry: form.licenseExpiry,
        specialty: form.specialty,
        years_experience: parseInt(form.yearsExperience) || 0,
        current_practice: { name: form.practiceName, city: form.practiceCity, role: form.practiceRole, from: form.practiceFrom, to: form.practiceTo },
        credential_documents: uploaded,
        reference_contact: form.refName ? { name: form.refName, hospital: form.refHospital, phone: form.refPhone } : null,
        verification_status: "pending_review",
        verification_submitted_at: new Date().toISOString(),
      }).eq("user_id", user.id);
      if (upErr) throw upErr;

      toast({ title: "Submitted", description: "Your credentials are under review. You'll get an email within 24–48 hours." });
      window.location.href = "/doctor";
    } catch (e: any) {
      toast({ title: "Submission failed", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DoctorLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center"><Shield className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-heading font-bold">Doctor Verification</h1>
            <p className="text-sm text-muted-foreground">Step {step} of 3 — takes about 5 minutes</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />)}
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          {step === 1 && (
            <>
              <h2 className="font-heading font-bold text-lg mb-4">License & specialty</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <Input label="Medical license number *" value={form.licenseNumber} onChange={(v) => update("licenseNumber", v)} placeholder="e.g. MDCN/R/12345" />
                <Select label="Issuing council *" value={form.licenseCouncil} onChange={(v) => update("licenseCouncil", v)} options={COUNCILS} />
                <Input label="License expiry *" type="date" value={form.licenseExpiry} onChange={(v) => update("licenseExpiry", v)} />
                <Input label="Specialty *" value={form.specialty} onChange={(v) => update("specialty", v)} placeholder="e.g. Cardiology" />
                <Input label="Years of experience *" type="number" value={form.yearsExperience} onChange={(v) => update("yearsExperience", v)} placeholder="e.g. 10" />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-heading font-bold text-lg mb-1">Current / last place of practice</h2>
              <p className="text-sm text-muted-foreground mb-4">Helps us confirm where you've worked.</p>
              <div className="grid md:grid-cols-2 gap-4">
                <Input label="Hospital / clinic name *" value={form.practiceName} onChange={(v) => update("practiceName", v)} placeholder="e.g. LUTH" />
                <Input label="City *" value={form.practiceCity} onChange={(v) => update("practiceCity", v)} placeholder="e.g. Lagos" />
                <Input label="Your role *" value={form.practiceRole} onChange={(v) => update("practiceRole", v)} placeholder="e.g. Consultant" />
                <Input label="From" type="date" value={form.practiceFrom} onChange={(v) => update("practiceFrom", v)} />
                <Input label="To (leave blank if current)" type="date" value={form.practiceTo} onChange={(v) => update("practiceTo", v)} />
              </div>

              <h3 className="font-heading font-bold mt-6 mb-2">Professional reference (optional)</h3>
              <div className="grid md:grid-cols-3 gap-4">
                <Input label="Name" value={form.refName} onChange={(v) => update("refName", v)} />
                <Input label="Hospital" value={form.refHospital} onChange={(v) => update("refHospital", v)} />
                <Input label="Phone" value={form.refPhone} onChange={(v) => update("refPhone", v)} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-heading font-bold text-lg mb-1">Upload credentials</h2>
              <p className="text-sm text-muted-foreground mb-4">PDF, JPG or PNG. Max 10MB each. Stored privately.</p>
              <div className="space-y-3">
                {DOC_FIELDS.map((d) => (
                  <label key={d.key} className="flex items-center gap-3 p-4 border border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/20">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><FileText className="w-5 h-5" /></div>
                    <div className="flex-1">
                      <div className="font-medium text-sm">{d.label} {d.required && <span className="text-destructive">*</span>}</div>
                      <div className="text-xs text-muted-foreground">{files[d.key]?.name || "Click to choose a file"}</div>
                    </div>
                    <Upload className="w-4 h-4 text-muted-foreground" />
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => setFiles({ ...files, [d.key]: e.target.files?.[0] || null })} />
                  </label>
                ))}
              </div>
            </>
          )}

          <div className="flex justify-between mt-6 pt-5 border-t border-border">
            <button disabled={step === 1} onClick={() => setStep(step - 1)} className="px-4 py-2 border border-border rounded-lg text-sm disabled:opacity-50">Back</button>
            {step < 3 ? (
              <button onClick={() => setStep(step + 1)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm inline-flex items-center gap-1">Continue <ArrowRight className="w-4 h-4" /></button>
            ) : (
              <button onClick={submit} disabled={submitting} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-50">{submitting ? "Submitting…" : "Submit for review"}</button>
            )}
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}

function Input({ label, value, onChange, type = "text", placeholder }: any) {
  return <label className="block"><span className="text-xs font-medium text-muted-foreground">{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary" /></label>;
}
function Select({ label, value, onChange, options }: any) {
  return <label className="block"><span className="text-xs font-medium text-muted-foreground">{label}</span><select value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary">{options.map((o: string) => <option key={o}>{o}</option>)}</select></label>;
}
