import { PageShell } from "@/components/landing/PageShell";
import { PageHero } from "@/components/landing/PageHero";
import { PageMeta } from "@/components/landing/PageMeta";
import { Pricing as PricingBlock } from "@/components/landing/Pricing";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const compare: { feature: string; emr: boolean | string; tele: boolean | string }[] = [
  { feature: "Patient records & queue", emr: true, tele: true },
  { feature: "EMR with structured notes", emr: true, tele: true },
  { feature: "Billing, payments & revenue", emr: true, tele: true },
  { feature: "Laboratory module", emr: true, tele: true },
  { feature: "Pharmacy inventory", emr: true, tele: true },
  { feature: "Maternity & Surgery", emr: true, tele: true },
  { feature: "Insurance / HMO claims", emr: true, tele: true },
  { feature: "Bed & ward management", emr: true, tele: true },
  { feature: "Staff seats", emr: "Up to 25", tele: "Unlimited" },
  { feature: "Analytics", emr: "Basic", tele: "Advanced" },
  { feature: "Teleconsultations", emr: false, tele: true },
  { feature: "Doctor marketplace", emr: false, tele: true },
  { feature: "Patient messaging", emr: false, tele: true },
  { feature: "Priority support", emr: false, tele: true },
];

const faqs = [
  { q: "What counts as a staff seat?", a: "Any unique user with a hospital login — admin, receptionist, nurse, lab tech, pharmacist, manager or medical officer. Doctors invited to your hospital count as staff." },
  { q: "Do patients pay?", a: "Never. The patient portal is free forever. Hospitals pay for staff access; patients book, view records and message their care team at no cost." },
  { q: "Can I switch plans later?", a: "Yes. Upgrade from EMR Essentials to the Telemedicine Suite anytime from Settings → Subscription. Your data carries over instantly." },
  { q: "Is there a free trial?", a: "Yes — sign up and explore the entire EMR Essentials feature set. We'll work with you on commercial terms before any charge." },
  { q: "What about payment methods?", a: "Naira bank transfer, card, and POS supported via standard channels. For Telemedicine Suite, annual billing comes with ~17% discount." },
  { q: "Is my data ever locked in?", a: "No. We provide CSV/JSON exports of your data on request. Your records belong to your hospital." },
];

function Cell({ v }: { v: boolean | string }) {
  if (v === true) return <Check className="w-5 h-5 text-success mx-auto" />;
  if (v === false) return <X className="w-5 h-5 text-muted-foreground/50 mx-auto" />;
  return <span className="text-sm">{v}</span>;
}

export default function Pricing() {
  return (
    <PageShell>
      <PageMeta title="Pricing — HealingNet plans for Nigerian hospitals" description="Simple, transparent Naira pricing. EMR Essentials from ₦75K/mo or Telemedicine Suite from ₦150K/mo. Patients always free." />
      <PageHero
        eyebrow="Pricing"
        title="Naira pricing. No surprises."
        subtitle="Two clear plans. Patients use HealingNet free, forever. Hospitals pick what fits and upgrade whenever they need more."
      />

      <PricingBlock />

      <section className="py-16 container mx-auto">
        <h2 className="text-3xl font-heading font-bold mb-3">Side-by-side comparison</h2>
        <p className="text-muted-foreground mb-8">Everything in EMR Essentials, plus what unlocks at the Telemedicine Suite tier.</p>
        <div className="overflow-x-auto bg-card border border-border rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-background/50 border-b border-border">
              <tr>
                <th className="text-left p-4 font-heading font-bold">Feature</th>
                <th className="p-4 font-heading font-bold text-center">EMR Essentials</th>
                <th className="p-4 font-heading font-bold text-center text-primary">Telemedicine Suite</th>
              </tr>
            </thead>
            <tbody>
              {compare.map((row, i) => (
                <tr key={row.feature} className={i % 2 ? "bg-background/30" : ""}>
                  <td className="p-4">{row.feature}</td>
                  <td className="p-4 text-center"><Cell v={row.emr} /></td>
                  <td className="p-4 text-center"><Cell v={row.tele} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="py-16 bg-card/30 border-y border-border">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-3xl font-heading font-bold mb-8">Pricing FAQ</h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <div key={f.q} className="bg-background border border-border rounded-xl p-5">
                <h3 className="font-heading font-bold mb-1.5">{f.q}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 container mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3">Need a custom plan?</h2>
        <p className="text-muted-foreground mb-6">For multi-site hospital groups or government facilities, we tailor terms.</p>
        <Button asChild size="lg"><Link to="/contact">Talk to sales</Link></Button>
      </section>
    </PageShell>
  );
}
