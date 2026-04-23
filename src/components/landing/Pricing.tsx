import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    id: "emr",
    name: "EMR Essentials",
    tagline: "Everything to run a modern hospital",
    monthly: 75000,
    yearly: 750000,
    features: ["Patient records & queue", "EMR with structured notes", "Billing & revenue tracking", "Laboratory module", "Pharmacy inventory", "Maternity & Surgery", "Insurance claims", "Basic analytics", "Up to 25 staff members"],
  },
  {
    id: "telemedicine",
    name: "Telemedicine Suite",
    tagline: "Essentials + virtual care superpowers",
    monthly: 150000,
    yearly: 1500000,
    featured: true,
    features: ["Everything in EMR Essentials", "Teleconsultations & video calls", "Doctor marketplace access", "External consultations", "Patient messaging", "Advanced analytics & reports", "Priority support", "Unlimited staff members"],
  },
];

export function Pricing() {
  const [yearly, setYearly] = useState(false);
  return (
    <section id="pricing" className="py-20 bg-card/30">
      <div className="container mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3">Simple, transparent pricing</h2>
          <p className="text-muted-foreground text-lg mb-6">Patients use HealingNet free, forever.</p>
          <div className="inline-flex items-center gap-1 p-1 bg-background border border-border rounded-full">
            <button onClick={() => setYearly(false)} className={`px-5 py-1.5 rounded-full text-sm font-medium transition-colors ${!yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Monthly</button>
            <button onClick={() => setYearly(true)} className={`px-5 py-1.5 rounded-full text-sm font-medium transition-colors ${yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Yearly <span className="text-xs opacity-80">−17%</span></button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
          {plans.map((p) => (
            <div key={p.id} className={`relative bg-background border-2 rounded-2xl p-8 ${p.featured ? "border-primary shadow-2xl shadow-primary/10" : "border-border"}`}>
              {p.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> MOST POPULAR
                </div>
              )}
              <h3 className="text-xl font-heading font-bold mb-1">{p.name}</h3>
              <p className="text-sm text-muted-foreground mb-5">{p.tagline}</p>
              <div className="mb-6">
                <span className="text-4xl font-heading font-bold">₦{((yearly ? p.yearly : p.monthly) / 1000).toFixed(0)}K</span>
                <span className="text-muted-foreground">/{yearly ? "year" : "month"}</span>
              </div>
              <Button asChild className="w-full mb-6" variant={p.featured ? "default" : "outline"}>
                <Link to={`/signup?plan=${p.id}`}>Start with {p.name.split(" ")[0]}</Link>
              </Button>
              <ul className="space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="text-sm flex items-start gap-2">
                    <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="text-center mt-10 text-sm text-muted-foreground">
          Need something custom? <a href="mailto:hello@healingnet.app" className="text-primary hover:underline">Talk to sales</a>
        </div>
      </div>
    </section>
  );
}
