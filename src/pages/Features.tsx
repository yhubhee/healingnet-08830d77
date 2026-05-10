import { PageShell } from "@/components/landing/PageShell";
import { PageHero } from "@/components/landing/PageHero";
import { PageMeta } from "@/components/landing/PageMeta";
import { Zap, Shield, Globe, Layers, Bell, GitBranch, Smartphone, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const features = [
  { icon: Zap, title: "Real-time everywhere", desc: "Queue updates, bed status, lab results, prescriptions — every screen reflects the latest state instantly. No refresh needed." },
  { icon: Layers, title: "Tri-portal architecture", desc: "Hospitals, doctors and patients each get a workspace tuned to their needs, but they all share one source of truth." },
  { icon: Shield, title: "Role-based security", desc: "Granular roles (admin, receptionist, nurse, lab tech, pharmacist, manager, medical officer) with row-level security on every table." },
  { icon: Database, title: "Encrypted by default", desc: "All data encrypted in transit and at rest. Audit trails on sensitive actions. Designed with HIPAA-style controls." },
  { icon: Globe, title: "Built for Nigeria", desc: "Naira billing, NHIS support, HMO claim flows, genotype tracking (AA/AS/SS) — local context baked in, not bolted on." },
  { icon: Bell, title: "Smart notifications", desc: "10 alert categories with real-time unread badges so the right person knows the moment something needs attention." },
  { icon: GitBranch, title: "Integrated workflows", desc: "Modules talk to each other. A lab order from EMR auto-creates a lab queue item; a dispensed drug auto-decrements stock." },
  { icon: Smartphone, title: "Works on any device", desc: "Responsive across desktop, tablet and phone. Reception on a desktop, doctor on a tablet, patient on their phone — all in sync." },
];

const capabilities = [
  { title: "AI-assisted triage", desc: "A 4-step symptom chat that scores severity 1–10 and routes patients to the right specialty using a rule-based engine plus proximity matching (Haversine)." },
  { title: "13 EMR entry types", desc: "Vitals, history, examination, diagnoses, prescriptions, lab orders, results, procedures, surgery notes, ANC, postnatal, discharge summaries and free notes — all structured JSON for analytics." },
  { title: "11 lab result categories", desc: "Haematology, chemistry, microbiology, serology, urinalysis and more, each with structured fields and abnormal-value flagging." },
  { title: "Live analytics", desc: "Patient flow line charts, revenue area charts, top-diagnosis bars and department-mix pies, all driven by live data — no scheduled exports." },
  { title: "Bed & daily charges", desc: "Wards and beds with status tracking and automatic daily bed-rate billing accumulating into the final invoice." },
  { title: "External consult marketplace", desc: "Request specialists outside your hospital with transparent fee splits and SLA-based response times." },
];

export default function Features() {
  return (
    <PageShell>
      <PageMeta title="Features — How HealingNet works under the hood" description="Real-time updates, tri-portal architecture, role-based security, AI triage, integrated workflows and more — the platform features that make HealingNet different." />
      <PageHero
        eyebrow="Features"
        title="The platform capabilities behind every module."
        subtitle="The Services page tells you what HealingNet does. This page tells you how — the cross-cutting platform features that make every module faster, safer and more useful."
      />

      <section className="py-16 container mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f) => (
            <div key={f.title} className="bg-card border border-border rounded-xl p-6 hover:border-primary/40 transition-colors">
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-heading font-bold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 bg-card/30 border-y border-border">
        <div className="container mx-auto">
          <h2 className="text-3xl font-heading font-bold mb-3">Deep capabilities</h2>
          <p className="text-muted-foreground mb-10 max-w-2xl">A few of the things HealingNet does that most "hospital software" doesn't.</p>
          <div className="grid md:grid-cols-2 gap-5">
            {capabilities.map((c) => (
              <div key={c.title} className="bg-background border border-border rounded-xl p-6">
                <h3 className="font-heading font-bold mb-2">{c.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 container mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3">Ready to try it?</h2>
        <p className="text-muted-foreground mb-6">Sign up free — no credit card required.</p>
        <Button asChild size="lg"><Link to="/signup">Get Started</Link></Button>
      </section>
    </PageShell>
  );
}
