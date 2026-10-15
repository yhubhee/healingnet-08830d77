import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { mkButton } from "./buttons";
import { Reveal } from "./Reveal";

const TICKS = [
  "Digital records and a live patient queue",
  "Billing and payments in naira",
  "Lab and pharmacy in one place",
  "Video visits with the Telemedicine Suite",
];

/** Dark ink-teal band pitching hospitals. The app's cyan is used only for small highlights here. */
export function ProviderBand() {
  return (
    <section className="mk-section" aria-labelledby="provider-title">
      <div className="mk-container">
        <Reveal className="relative overflow-hidden rounded-3xl bg-[hsl(192_45%_12%)] px-6 py-12 text-white md:px-14 md:py-16">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[hsl(var(--brand-cyan)/0.12)] blur-2xl" />
          <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-[hsl(var(--brand-cyan))]">For hospitals</p>
              <h2 id="provider-title" className="text-white">Run your hospital on HealingNet</h2>
              <p className="mt-4 max-w-lg text-white/80">One system for your front desk, clinicians, lab, pharmacy and accounts. Try EMR Essentials free for 30 days, no card needed.</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/signup?role=hospital" className={mkButton({ variant: "light", size: "lg" })}>Start 30-day free trial</Link>
                <Link to="/hospitals" className={mkButton({ variant: "outlineLight", size: "lg" })}>See hospital features</Link>
              </div>
              <Link to="/contact?topic=demo" className="mt-5 inline-flex min-h-11 items-center gap-1.5 font-semibold text-white underline underline-offset-4 hover:text-[hsl(var(--brand-cyan))]">
                Talk to us <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {TICKS.map((t) => (
                <li key={t} className={cn("flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4")}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--brand-cyan)/0.18)] text-[hsl(var(--brand-cyan))]">
                    <Check className="h-4 w-4" aria-hidden />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
