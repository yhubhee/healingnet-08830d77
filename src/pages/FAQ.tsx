import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { PageShell } from "@/components/landing/PageShell";
import { PageMeta } from "@/components/landing/PageMeta";
import { Hero } from "@/components/marketing/Hero";
import { FaqAccordion } from "@/components/marketing/FaqAccordion";
import { CtaBand } from "@/components/marketing/CtaBand";
import { PATIENT_FAQS, HOSPITAL_FAQS, DOCTOR_FAQS, PAYMENT_FAQS, type Faq } from "@/components/marketing/faqs";
import { cn } from "@/lib/utils";

const TABS: { id: string; label: string; items: Faq[] }[] = [
  { id: "patients", label: "Patients", items: PATIENT_FAQS },
  { id: "hospitals", label: "Hospitals", items: HOSPITAL_FAQS },
  { id: "doctors", label: "Doctors", items: DOCTOR_FAQS },
  { id: "payments", label: "Payments & privacy", items: PAYMENT_FAQS },
];

/** Grouped FAQ. Each tab has a deep link: /faq#patients, /faq#hospitals, /faq#doctors, /faq#payments. */
export default function FAQ() {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const fromHash = () => TABS.find((t) => `#${t.id}` === hash)?.id ?? TABS[0].id;
  const [active, setActive] = useState(fromHash);

  useEffect(() => setActive(fromHash()), [hash]); // eslint-disable-line react-hooks/exhaustive-deps

  function select(id: string) {
    setActive(id);
    navigate({ hash: id }, { replace: true });
  }

  function onKeyDown(e: React.KeyboardEvent, index: number) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = TABS[(index + step + TABS.length) % TABS.length];
    select(next.id);
    document.getElementById(`tab-${next.id}`)?.focus();
  }

  const tab = TABS.find((t) => t.id === active) ?? TABS[0];

  return (
    <PageShell>
      <PageMeta
        title="Frequently asked questions | HealingNet"
        description="Answers for patients, hospitals and doctors: the free trial, team limits, video visits, payments in naira and how your records are protected."
      />
      <Hero eyebrow="FAQ" title="Questions and answers" subtitle="Can't find what you need? Get in touch and we'll help." />

      <section className="pb-16 md:pb-24">
        <div className="mk-container max-w-3xl">
          <div role="tablist" aria-label="Question groups" className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {TABS.map((t, i) => (
              <button
                key={t.id}
                id={`tab-${t.id}`}
                role="tab"
                type="button"
                aria-selected={active === t.id}
                aria-controls={`panel-${t.id}`}
                tabIndex={active === t.id ? 0 : -1}
                onClick={() => select(t.id)}
                onKeyDown={(e) => onKeyDown(e, i)}
                className={cn(
                  "min-h-11 shrink-0 rounded-full border px-5 text-sm font-semibold transition-colors md:text-base",
                  active === t.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div id={`panel-${tab.id}`} role="tabpanel" aria-labelledby={`tab-${tab.id}`}>
            <h2 className="sr-only">{tab.label}</h2>
            <FaqAccordion key={tab.id} items={tab.items} idPrefix={tab.id} />
          </div>
          <p className="mt-8 text-muted-foreground">
            Still have a question? <Link to="/contact" className="font-semibold text-primary underline underline-offset-4">Contact us</Link>.
          </p>
        </div>
      </section>

      <CtaBand />
    </PageShell>
  );
}
