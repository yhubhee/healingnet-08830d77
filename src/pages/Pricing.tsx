import { Check, X } from "lucide-react";
import { PageShell } from "@/components/landing/PageShell";
import { PageMeta } from "@/components/landing/PageMeta";
import { Hero } from "@/components/marketing/Hero";
import { PricingCards } from "@/components/marketing/PricingCards";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { CtaBand } from "@/components/marketing/CtaBand";
import { Reveal } from "@/components/marketing/Reveal";
import { PAYMENT_FAQS, HOSPITAL_FAQS } from "@/components/marketing/faqs";
import { TRIAL_INCLUDES, TEAM_LIMIT_EMR, TEAM_LIMIT_TELE } from "@/components/marketing/content";

type Cell = boolean | string;
const ROWS: { feature: string; emr: Cell; tele: Cell }[] = [
  { feature: "Team members", emr: TEAM_LIMIT_EMR, tele: TEAM_LIMIT_TELE },
  { feature: "30-day free trial", emr: "Yes, no card needed", tele: "Not included, paid from day one" },
  ...TRIAL_INCLUDES.map((f) => ({ feature: f, emr: true, tele: true })),
  { feature: "Video consultations", emr: false, tele: true },
  { feature: "Consultation requests between hospitals", emr: false, tele: true },
  { feature: "The doctor marketplace", emr: false, tele: true },
];

function Value({ v, plan }: { v: Cell; plan: string }) {
  if (v === true) return <><Check className="mx-auto h-5 w-5 text-success" aria-hidden /><span className="sr-only">Included in {plan}</span></>;
  if (v === false) return <><X className="mx-auto h-5 w-5 text-muted-foreground" aria-hidden /><span className="sr-only">Not in {plan}</span></>;
  return <span className="text-sm font-semibold">{v}</span>;
}

export default function Pricing() {
  const pricingFaqs = [...PAYMENT_FAQS, HOSPITAL_FAQS[3], HOSPITAL_FAQS[4]];
  return (
    <PageShell>
      <PageMeta
        title="Pricing: free for patients, simple plans for hospitals | HealingNet"
        description="Patients use HealingNet free. Hospitals choose EMR Essentials (30-day free trial, no card) or the Telemedicine Suite, priced in naira."
      />
      <Hero
        eyebrow="Pricing"
        title="Simple pricing in naira"
        subtitle="Patients use HealingNet free, always. Hospitals pick the plan that fits and can change it any time."
      />

      <section className="pb-16 md:pb-24" aria-label="Plans">
        <div className="mk-container">
          <PricingCards showPatients />
        </div>
      </section>

      <section className="mk-section bg-muted/60" aria-labelledby="compare-title">
        <div className="mk-container">
          <Reveal className="mb-8 max-w-2xl">
            <h2 id="compare-title">Compare plans</h2>
            <p className="mt-4 text-muted-foreground">Everything in EMR Essentials is also in the Telemedicine Suite.</p>
          </Reveal>

          {/* Desktop: a table. */}
          <div className="mk-card hidden overflow-hidden md:block">
            <table className="w-full text-left text-base">
              <caption className="sr-only">EMR Essentials compared with Telemedicine Suite</caption>
              <thead className="bg-muted/70">
                <tr>
                  <th scope="col" className="p-4 font-semibold">Feature</th>
                  <th scope="col" className="w-56 p-4 text-center font-semibold">EMR Essentials</th>
                  <th scope="col" className="w-56 p-4 text-center font-semibold">Telemedicine Suite</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {ROWS.map((r) => (
                  <tr key={r.feature}>
                    <th scope="row" className="p-4 font-normal">{r.feature}</th>
                    <td className="p-4 text-center"><Value v={r.emr} plan="EMR Essentials" /></td>
                    <td className="p-4 text-center"><Value v={r.tele} plan="Telemedicine Suite" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: one card per plan. */}
          <div className="grid gap-5 md:hidden">
            {(["emr", "tele"] as const).map((plan) => (
              <div key={plan} className="mk-card p-5">
                <h3 className="mb-4 font-body text-lg font-bold tracking-normal">{plan === "emr" ? "EMR Essentials" : "Telemedicine Suite"}</h3>
                <ul className="space-y-3">
                  {ROWS.map((r) => {
                    const v = r[plan];
                    return (
                      <li key={r.feature} className="flex gap-3 text-base">
                        {v === false ? <X className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : <Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden />}
                        <span className={v === false ? "text-muted-foreground" : undefined}>
                          {v === false && <span className="sr-only">Not included: </span>}
                          {r.feature}{typeof v === "string" && <>: <strong>{v}</strong></>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="payments" className="mk-section" aria-labelledby="payments-faq-title">
        <Reveal className="mk-container max-w-3xl">
          <h2 id="payments-faq-title" className="mb-8">Payments and plans</h2>
          <FaqAccordion items={pricingFaqs} idPrefix="pricing" />
        </Reveal>
      </section>

      <CtaBand
        title="Try it with your team"
        text="Start a 30-day free trial of EMR Essentials. No card needed."
        primary={{ label: "Start 30-day free trial", to: "/signup?role=hospital" }}
        secondary={{ label: "Book a demo", to: "/contact?topic=demo" }}
      />
    </PageShell>
  );
}
