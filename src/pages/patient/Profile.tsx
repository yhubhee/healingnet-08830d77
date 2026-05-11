import { PatientLayout } from "@/layouts/PatientLayout";
import { mockPatientProfile } from "@/lib/mockData";
import { User, Phone, Mail, MapPin, Heart, AlertTriangle, Shield, Edit2 } from "lucide-react";

export default function PatientProfile() {
  const p = mockPatientProfile;
  return (
    <PatientLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">My Profile</h1>
          <p className="text-muted-foreground text-sm">Personal and medical information</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium"><Edit2 className="w-4 h-4" />Edit profile</button>
      </div>

      <div className="bg-gradient-to-r from-primary/15 to-info/15 border border-primary/20 rounded-xl p-6 mb-6 flex items-center gap-5 flex-wrap">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground flex items-center justify-center text-2xl font-bold">{p.firstName[0]}{p.lastName[0]}</div>
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-xl font-heading font-bold">{p.firstName} {p.lastName}</h2>
          <p className="text-sm text-muted-foreground">{p.gender} • Born {p.dob}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{p.email}</span>
            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Section title="Personal Information" icon={User}>
          <Field label="Full name" value={`${p.firstName} ${p.lastName}`} />
          <Field label="Date of birth" value={p.dob} />
          <Field label="Gender" value={p.gender} />
          <Field label="Address" value={`${p.address}`} />
          <Field label="City / State" value={`${p.city}, ${p.state}`} />
        </Section>

        <Section title="Medical Information" icon={Heart}>
          <Field label="Blood group" value={p.bloodGroup} />
          <Field label="Genotype" value={p.genotype} hint="AS — sickle-cell trait" />
          <div>
            <div className="text-xs text-muted-foreground mb-1">Allergies</div>
            <div className="flex flex-wrap gap-1.5">{p.allergies.map((a) => <span key={a} className="px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-xs flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{a}</span>)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Chronic conditions</div>
            <div className="flex flex-wrap gap-1.5">{p.chronic.map((c) => <span key={c} className="px-2 py-0.5 rounded-full bg-warning/15 text-warning text-xs">{c}</span>)}</div>
          </div>
        </Section>

        <Section title="Emergency Contact" icon={Phone}>
          <Field label="Name" value={p.emergencyName} />
          <Field label="Phone" value={p.emergencyPhone} />
        </Section>

        <Section title="Insurance / NHIS" icon={Shield}>
          <Field label="Provider" value={p.insurer} />
          <Field label="Policy number" value={p.insuranceNo} />
          <Field label="Status" value="Active" />
        </Section>
      </div>
    </PatientLayout>
  );
}

function Section({ title, icon: Icon, children }: any) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-heading font-bold mb-4 flex items-center gap-2"><Icon className="w-4 h-4 text-primary" />{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value}{hint && <span className="block text-xs text-muted-foreground font-normal">{hint}</span>}</span>
    </div>
  );
}
