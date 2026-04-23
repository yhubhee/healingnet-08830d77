import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Activity, ShieldCheck, Stethoscope } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-info/5 pointer-events-none" />
      <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="container mx-auto relative py-20 lg:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Activity className="w-4 h-4" /> Trusted healthcare OS
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold leading-tight mb-6">
            One platform for <span className="text-primary">modern healthcare</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
            HealingNet unifies EMR, patient queue, billing, lab, pharmacy, and telemedicine into a single, beautiful workspace —
            built for hospitals, doctors, and the patients they care for.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="text-base h-12 px-8">
              <Link to="/signup">Get Started Free <ArrowRight className="w-4 h-4 ml-2" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-base h-12 px-8">
              <a href="#pricing">View Pricing</a>
            </Button>
          </div>
          <div className="flex items-center justify-center gap-6 mt-10 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-success" /> HIPAA-ready</div>
            <div className="flex items-center gap-2"><Stethoscope className="w-4 h-4 text-info" /> Built with clinicians</div>
          </div>
        </div>

        {/* Mock dashboard preview */}
        <div className="mt-16 max-w-5xl mx-auto">
          <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-background/50">
              <div className="w-3 h-3 rounded-full bg-destructive/70" />
              <div className="w-3 h-3 rounded-full bg-warning/70" />
              <div className="w-3 h-3 rounded-full bg-success/70" />
            </div>
            <div className="grid md:grid-cols-3 gap-4 p-6">
              {[
                { label: "Patients Today", value: "1,284", trend: "+12%" },
                { label: "Active Doctors", value: "47", trend: "+3" },
                { label: "Revenue", value: "₦8.4M", trend: "+18%" },
              ].map((s) => (
                <div key={s.label} className="bg-background rounded-xl p-5 border border-border">
                  <div className="text-sm text-muted-foreground mb-1">{s.label}</div>
                  <div className="text-3xl font-heading font-bold">{s.value}</div>
                  <div className="text-xs text-success mt-2">{s.trend} this week</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
