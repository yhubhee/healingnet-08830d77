import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Gift, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlanPrices, priceNaira, formatNaira, type BillingCycle, type PlanName } from "@/hooks/usePlanPrices";
import { mkButton } from "./buttons";
import { TEAM_LIMIT_EMR, TEAM_LIMIT_TELE } from "./content";

const EMR_POINTS = [
  TEAM_LIMIT_EMR,
  "Patient records, queue and check-in",
  "Electronic medical records",
  "Lab, pharmacy, maternity and surgery",
  "Billing, payments and insurance claims",
  "Beds and wards, referrals, reports",
];

const TELE_POINTS = [
  TEAM_LIMIT_TELE,
  "Everything in EMR Essentials",
  "Video consultations with patients",
  "Consultation requests between hospitals",
  "The doctor marketplace",
];

/**
 * Hospital plans with prices from the plan_prices table (never hard-coded),
 * the trial banner and, optionally, the free patient card.
 */
export function PricingCards({ showPatients = false, className }: { showPatients?: boolean; className?: string }) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const { data: prices, isLoading } = usePlanPrices();

  function price(plan: PlanName) {
    const n = priceNaira(prices, plan, cycle);
    if (isLoading) return { amount: formatNaira(null), per: "" };
    if (n == null) return { amount: "Ask us", per: "" };
    return { amount: formatNaira(n), per: cycle === "yearly" ? "/year" : "/month" };
  }

  const emr = price("emr");
  const tele = price("telemedicine");

  return (
    <div className={className}>
      <div className="mb-8 flex flex-col items-center gap-5">
        <p className="flex items-center gap-2 rounded-full bg-primary/10 px-5 py-2.5 text-center text-sm font-semibold text-primary md:text-base">
          <Gift className="h-5 w-5 shrink-0" aria-hidden />
          Hospitals: try EMR Essentials free for 30 days. No card needed.
        </p>
        <div role="group" aria-label="Billing period" className="inline-flex rounded-full border border-border bg-card p-1">
          {(["monthly", "yearly"] as const).map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={cycle === c}
              onClick={() => setCycle(c)}
              className={cn(
                "min-h-11 rounded-full px-6 text-sm font-semibold transition-colors",
                cycle === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c === "monthly" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
      </div>

      <div className={cn("mx-auto grid max-w-5xl gap-6", showPatients ? "lg:grid-cols-3" : "md:grid-cols-2")}>
        {showPatients && (
          <article className="mk-card flex flex-col bg-muted/60 p-7">
            <h3 className="font-body text-xl font-bold tracking-normal">Patients</h3>
            <p className="mt-1 text-muted-foreground">Book visits, see your records, check your symptoms.</p>
            <p className="mt-6 font-display text-4xl font-semibold">Free, always</p>
            <Link to="/signup" className={cn(mkButton({ variant: "secondary" }), "mt-6")}>Create free account</Link>
            <ul className="mt-6 space-y-3 text-base">
              {["No subscription, ever", "Video and in-person visits", "Your records in one place"].map((p) => (
                <li key={p} className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden />{p}</li>
              ))}
            </ul>
          </article>
        )}

        <article className="mk-card flex flex-col p-7">
          <h3 className="font-body text-xl font-bold tracking-normal">EMR Essentials</h3>
          <p className="mt-1 text-muted-foreground">Run your hospital: records, queue, lab, pharmacy and billing.</p>
          <p className="mt-6">
            <span className="font-display text-4xl font-semibold">{emr.amount}</span>
            <span className="text-muted-foreground">{emr.per}</span>
          </p>
          <p className="mt-1 text-sm font-semibold text-primary">30-day free trial, no card needed</p>
          <Link to="/signup?role=hospital" className={cn(mkButton(), "mt-6")}>Start free trial</Link>
          <Link to="/signup?role=hospital&plan=emr" className="mt-3 inline-flex min-h-11 items-center justify-center text-sm font-semibold text-primary underline underline-offset-4">
            or subscribe now
          </Link>
          <p className="text-center text-xs text-muted-foreground">Sign up, then subscribe any time from Settings → Subscription.</p>
          <ul className="mt-6 space-y-3 text-base">
            {EMR_POINTS.map((p) => (
              <li key={p} className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden />{p}</li>
            ))}
          </ul>
        </article>

        <article className="mk-card relative flex flex-col border-primary p-7">
          <p className="absolute -top-3.5 left-7 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
            <Video className="h-3.5 w-3.5" aria-hidden /> Includes video visits
          </p>
          <h3 className="font-body text-xl font-bold tracking-normal">Telemedicine Suite</h3>
          <p className="mt-1 text-muted-foreground">Everything in EMR Essentials, plus virtual care.</p>
          <p className="mt-6">
            <span className="font-display text-4xl font-semibold">{tele.amount}</span>
            <span className="text-muted-foreground">{tele.per}</span>
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Not part of the free trial. Paid from day one.</p>
          <Link to="/signup?role=hospital&plan=telemedicine" className={cn(mkButton(), "mt-6")}>Subscribe now</Link>
          {cycle === "yearly" && (
            <p className="mt-3 text-center text-xs text-muted-foreground">Sign-up checkout is monthly. Switch to yearly billing from Settings → Subscription.</p>
          )}
          <ul className="mt-6 space-y-3 text-base">
            {TELE_POINTS.map((p) => (
              <li key={p} className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-success" aria-hidden />{p}</li>
            ))}
          </ul>
        </article>
      </div>
    </div>
  );
}
