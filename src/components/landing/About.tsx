import { Target, Lightbulb, Heart } from "lucide-react";

const stats = [
  { v: "12+", l: "Integrated modules" },
  { v: "3", l: "Connected portals" },
  { v: "₦", l: "NGN-native billing" },
  { v: "24/7", l: "Real-time queue" },
];

export function About() {
  return (
    <section id="about" className="py-20 container mx-auto">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">About HealingNet</span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2 mb-4">
            Healthcare operations, finally built for the way Nigerian hospitals actually work.
          </h2>
          <p className="text-muted-foreground leading-relaxed mb-4">
            Long physical queues, paper records that get lost, billing done in spreadsheets, doctors with no
            visibility into a patient's history — these are everyday realities. HealingNet replaces that
            chaos with a single connected platform for hospitals, doctors and patients.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            From a small clinic to a multi-ward hospital, HealingNet runs your front desk, clinical
            documentation, lab, pharmacy, billing, insurance and telemedicine in one place — with NHIS and
            HMO support out of the box.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { icon: Target, title: "Our Mission", desc: "Make modern healthcare operations affordable for every Nigerian hospital." },
            { icon: Lightbulb, title: "Our Approach", desc: "Built locally, designed for real Nigerian workflows — not retrofitted from abroad." },
            { icon: Heart, title: "Our Promise", desc: "Faster care, fewer errors, happier patients and staff." },
            { icon: Target, title: "By the numbers", desc: "12 modules, 3 portals, one connected experience." },
          ].map((c) => (
            <div key={c.title} className="bg-card border border-border rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <c.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-heading font-bold mb-1">{c.title}</h3>
              <p className="text-sm text-muted-foreground">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
        {stats.map((s) => (
          <div key={s.l} className="bg-card border border-border rounded-xl p-6 text-center">
            <div className="text-3xl font-heading font-bold text-primary">{s.v}</div>
            <div className="text-sm text-muted-foreground mt-1">{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
