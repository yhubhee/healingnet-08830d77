import { HeartHandshake, MapPin, ShieldCheck, Smartphone } from "lucide-react";
import { PageShell } from "@/components/landing/PageShell";
import { PageMeta } from "@/components/landing/PageMeta";
import { Hero } from "@/components/marketing/Hero";
import { SplitFeature } from "@/components/marketing/SplitFeature";
import { CtaBand } from "@/components/marketing/CtaBand";
import { Reveal } from "@/components/marketing/Reveal";

const DIFFERENT = [
  { icon: MapPin, title: "Made for Nigeria", text: "Prices in naira, payments through Paystack, and hospitals you can actually get to." },
  { icon: Smartphone, title: "Works on any smartphone", text: "No app to download and nothing to install. It runs in the browser." },
  { icon: ShieldCheck, title: "Honest about safety", text: "Licence-checked doctors, and a triage assistant that tells you it isn't a diagnosis." },
  { icon: HeartHandshake, title: "Patients and hospitals together", text: "The same system runs the hospital and the patient's side, so nothing gets lost in between." },
];

interface TeamMember {
  name: string;
  role: string;
}

/** Fill in to show the team section. Empty means the section isn't shown. */
const TEAM: TeamMember[] = [];

export default function About() {
  return (
    <PageShell>
      <PageMeta
        title="About HealingNet: better access to care in Nigeria"
        description="HealingNet connects patients, doctors and hospitals across Nigeria, online and in person. Our mission and what makes us different."
      />
      <Hero
        eyebrow="About HealingNet"
        title="Good care should be easy to reach"
        subtitle="HealingNet connects patients, doctors and hospitals across Nigeria, online and in person."
      />

      <SplitFeature photo="doctor-patient-talk" eyebrow="Our mission" title="Help every Nigerian see the right doctor, sooner">
        <p>We want finding a trusted doctor to be as simple as sending a message, and running a hospital to be as simple as opening a laptop.</p>
      </SplitFeature>

      <section className="mk-section bg-muted/60" aria-labelledby="problem-title">
        <Reveal className="mk-container max-w-3xl">
          <h2 id="problem-title" className="mb-6">The problem we're working on</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>Too many people in Nigeria travel far, queue for hours, or go without care because they don't know which doctor to see or which hospital can help.</p>
            <p>Many hospitals still run on paper. Records get lost between visits, queues are hard to manage, and payments are tracked by hand.</p>
            <p>HealingNet tackles both sides: it helps patients find and reach the right care, and gives hospitals one system to run on.</p>
          </div>
        </Reveal>
      </section>

      <section className="mk-section" aria-labelledby="different-title">
        <div className="mk-container">
          <Reveal className="mb-10 max-w-2xl">
            <h2 id="different-title">What's different</h2>
          </Reveal>
          <ul className="grid gap-5 sm:grid-cols-2">
            {DIFFERENT.map((d, i) => (
              <Reveal as="li" key={d.title} delay={(i % 2) * 80} className="mk-card flex gap-4 p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><d.icon className="h-5 w-5" aria-hidden /></span>
                <div>
                  <h3 className="mb-1">{d.title}</h3>
                  <p className="text-base text-muted-foreground">{d.text}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {TEAM.length > 0 && (
        <section className="mk-section bg-muted/60" aria-labelledby="team-title">
          <div className="mk-container">
            <h2 id="team-title" className="mb-10">The team</h2>
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {TEAM.map((m) => (
                <li key={m.name} className="mk-card p-6">
                  <h3 className="mb-1">{m.name}</h3>
                  <p className="text-base text-muted-foreground">{m.role}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <CtaBand />
    </PageShell>
  );
}
