import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Check, Lock, Stethoscope, Building2, Wallet, Video, ScanLine, Send, BadgeCheck } from "lucide-react";
import { PageShell } from "@/components/landing/PageShell";
import { PageMeta } from "@/components/landing/PageMeta";
import { Hero } from "@/components/marketing/Hero";
import { DashboardMock } from "@/components/marketing/DashboardMock";
import { SplitFeature } from "@/components/marketing/SplitFeature";
import { Steps } from "@/components/marketing/Steps";
import { PricingCards } from "@/components/marketing/PricingCards";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { CtaBand } from "@/components/marketing/CtaBand";
import { Reveal } from "@/components/marketing/Reveal";
import { mkButton } from "@/components/marketing/buttons";
import { HOSPITAL_FAQS } from "@/components/marketing/faqs";
import { TRIAL_INCLUDES, TELEMEDICINE_ONLY } from "@/components/marketing/content";

// Modules the app really has, grouped the way a hospital thinks about them.
const GROUPS = [
  { icon: Stethoscope, title: "Clinical", items: ["Electronic medical records", "Laboratory requests and results", "Pharmacy and dispensing", "Maternity records", "Surgery records", "Referrals"] },
  { icon: Building2, title: "Operations", items: ["Patient queue and check-in", "Beds and wards", "Staff invites and doctor invites", "Reports and analytics"] },
  { icon: Wallet, title: "Money", items: ["Billing and payments in naira", "Insurance claims"] },
  { icon: Video, title: "Virtual care", items: ["Video consultations", "Consultation requests between hospitals", "The doctor marketplace"], note: "Telemedicine Suite" },
];

// For pharmacies: only what the product does today. No numbers, no endorsements.
const PHARMACY_POINTS = [
  { icon: ScanLine, title: "Verify any HealingNet prescription in seconds", text: "Scan the QR or type the code. You see the doctor, their licence number and whether the prescription is still valid." },
  { icon: Send, title: "Patients find you and send you prescriptions", text: "Patients near you send their prescription. You reply with stock, price and pickup time, and they pay at your counter." },
  { icon: BadgeCheck, title: "Free to join while we launch", text: "Sign up your pharmacy, add your pharmacists with a join code, and start once HealingNet has checked your licence." },
];

export default function Hospitals() {
  const { hash } = useLocation();
  // The footer links to /hospitals#pharmacies.
  useEffect(() => {
    if (hash === "#pharmacies") document.getElementById("pharmacies")?.scrollIntoView({ block: "start" });
  }, [hash]);
  return (
    <PageShell>
      <PageMeta
        title="For hospitals: EMR, queue, billing and telemedicine | HealingNet"
        description="Run your hospital on HealingNet: records, queue, lab, pharmacy, billing and video visits. Start a 30-day free trial of EMR Essentials, no card needed."
      />
      <Hero
        eyebrow="For hospitals"
        title="The operating system for your hospital"
        subtitle="Records, queue, lab, pharmacy, billing and video visits in one place, priced in naira."
        media={<DashboardMock />}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="flex flex-col">
            <Link to="/signup?role=hospital" className={mkButton({ size: "lg" })}>Start 30-day free trial</Link>
            <p className="mt-2 text-center text-sm text-muted-foreground sm:text-left">No card needed · EMR Essentials included</p>
          </div>
          <Link to="/signup?role=hospital&plan=telemedicine" className={mkButton({ variant: "secondary", size: "lg" })}>Skip the trial: subscribe now</Link>
        </div>
      </Hero>

      <section className="mk-section bg-muted/60" aria-labelledby="modules-title">
        <div className="mk-container">
          <Reveal className="mb-10 max-w-2xl">
            <h2 id="modules-title">Everything your hospital runs on</h2>
            <p className="mt-4 text-muted-foreground">One login for your front desk, clinicians, lab, pharmacy and accounts.</p>
          </Reveal>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {GROUPS.map((g, i) => (
              <Reveal as="li" key={g.title} delay={i * 80} className="mk-card p-6">
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><g.icon className="h-5 w-5" aria-hidden /></span>
                <h3 className="mb-1">{g.title}</h3>
                {g.note && <p className="mb-2 text-sm font-semibold text-primary">{g.note}</p>}
                <ul className="mt-3 space-y-2 text-base text-muted-foreground">
                  {g.items.map((it) => (
                    <li key={it} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-primary" aria-hidden />{it}</li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section id="trial" className="mk-section" aria-labelledby="trial-title">
        <div className="mk-container">
          <Reveal className="mb-10 max-w-2xl">
            <h2 id="trial-title">What your free trial includes</h2>
            <p className="mt-4 text-muted-foreground">Every new hospital gets 30 days of EMR Essentials, free. It starts when you sign up, and no card is needed. When it ends, EMR features pause until you subscribe. Your data is kept.</p>
          </Reveal>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Reveal className="mk-card p-6 md:p-8">
              <h3 className="mb-5">Included in your trial</h3>
              <ul className="grid gap-3 sm:grid-cols-2">
                {TRIAL_INCLUDES.map((t) => (
                  <li key={t} className="flex gap-3 text-base">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground"><Check className="h-3.5 w-3.5" aria-hidden /></span>
                    {t}
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={80} className="mk-card bg-muted/60 p-6 md:p-8">
              <h3 className="mb-5">Unlock with Telemedicine Suite</h3>
              <ul className="space-y-3">
                {TELEMEDICINE_ONLY.map((t) => (
                  <li key={t} className="flex gap-3 text-base">
                    <Lock className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span><span className="sr-only">Not in the trial: </span>{t}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-muted-foreground">Upgrade any time from Settings, during or after your trial.</p>
            </Reveal>
          </div>
        </div>
      </section>

      <SplitFeature photo="lab-technician" eyebrow="Lab and pharmacy" title="Results and prescriptions, connected" reverse className="bg-muted/60">
        <p>Doctors request tests and see results in the patient's record. Prescriptions go straight to your pharmacy for dispensing.</p>
      </SplitFeature>

      <Steps
        title="How onboarding works"
        steps={[
          { title: "Sign up", text: "Create your hospital account in a few minutes." },
          { title: "Verification", text: "We verify your hospital (usually within 1–2 working days). You can set up and use the EMR while you wait." },
          { title: "Free trial", text: "30 days of EMR Essentials. Invite your staff and doctors, up to 25 team members." },
          { title: "Go live", text: "Once you're verified, patients can find and book your hospital." },
        ]}
      />

      <section id="pricing" className="mk-section bg-muted/60" aria-labelledby="hospital-pricing-title">
        <div className="mk-container">
          <Reveal className="mb-8 text-center">
            <h2 id="hospital-pricing-title">Simple plans, in naira</h2>
          </Reveal>
          <PricingCards />
        </div>
      </section>

      <section id="pharmacies" className="mk-section scroll-mt-20" aria-labelledby="pharmacies-title">
        <div className="mk-container">
          <Reveal className="mb-8 max-w-2xl">
            <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-primary">For pharmacies</p>
            <h2 id="pharmacies-title">Fill HealingNet prescriptions with confidence</h2>
          </Reveal>
          <ul className="grid gap-4 md:grid-cols-3">
            {PHARMACY_POINTS.map((p) => (
              <li key={p.title} className="rounded-3xl border border-border bg-card p-6">
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><p.icon className="h-5 w-5" aria-hidden /></span>
                <h3 className="mb-2 text-lg font-semibold">{p.title}</h3>
                <p className="text-muted-foreground">{p.text}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup?role=pharmacy" className={mkButton({ size: "lg" })}>Sign up your pharmacy</Link>
            <Link to="/signup?role=pharmacist" className={mkButton({ variant: "secondary", size: "lg" })}>Join as a pharmacist</Link>
          </div>
        </div>
      </section>

      <section className="mk-section bg-muted/60" aria-labelledby="hospitals-faq-title">
        <Reveal className="mk-container max-w-3xl">
          <h2 id="hospitals-faq-title" className="mb-8">Questions from hospitals</h2>
          <FaqAccordion items={HOSPITAL_FAQS} idPrefix="hospitals" />
        </Reveal>
      </section>

      <CtaBand
        title="See it with your team"
        text="We'll walk you through HealingNet and answer your questions."
        primary={{ label: "Book a demo", to: "/contact?topic=demo" }}
        secondary={{ label: "Start 30-day free trial", to: "/signup?role=hospital" }}
      />
    </PageShell>
  );
}
