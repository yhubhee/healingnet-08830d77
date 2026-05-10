import { PageShell } from "@/components/landing/PageShell";
import { PageHero } from "@/components/landing/PageHero";
import { PageMeta } from "@/components/landing/PageMeta";
import { Target, Lightbulb, Heart, Users, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const problems = [
  { title: "Endless physical queues", desc: "Patients wait for hours on benches with no visibility into where they are in line. Staff manage order on paper, leading to disputes and missed patients." },
  { title: "Paper records that get lost", desc: "Critical history — allergies, past diagnoses, prescriptions — disappears between visits. Doctors make decisions in the dark." },
  { title: "Billing run on spreadsheets", desc: "Cash, POS and HMO collections tracked manually across notebooks and Excel files. Reconciliation is painful and revenue leaks." },
  { title: "Fragmented insurance & NHIS", desc: "Filing claims and tracking reimbursements is a separate, manual workflow disconnected from clinical care." },
  { title: "No visibility for management", desc: "Hospital owners can't answer simple questions: how many patients today, top diagnoses, revenue this week, idle doctors." },
  { title: "Patients are left in the dark", desc: "After a visit, patients have no record, no easy way to refill prescriptions, and no channel to message their doctor." },
];

const values = [
  { icon: Target, title: "Built for Nigeria", desc: "Naira-native billing, NHIS & HMO support, local payment flows. Not a foreign tool retrofitted." },
  { icon: Lightbulb, title: "Pragmatic over fancy", desc: "We solve the boring, painful daily problems first — queues, paper, billing — before chasing buzzwords." },
  { icon: Heart, title: "Care comes first", desc: "Every workflow is designed to give doctors more time with patients, not more time clicking." },
  { icon: ShieldCheck, title: "Trustworthy by default", desc: "Encrypted data, role-based access, audit trails, and RLS on every table. Your records are yours." },
];

const stats = [
  { v: "12+", l: "Integrated modules" },
  { v: "3", l: "Connected portals" },
  { v: "₦", l: "NGN-native billing" },
  { v: "24/7", l: "Real-time queue" },
];

export default function About() {
  return (
    <PageShell>
      <PageMeta title="About HealingNet — Our mission for Nigerian healthcare" description="HealingNet is on a mission to make modern healthcare operations affordable for every Nigerian hospital. Learn our story, mission and approach." />
      <PageHero
        eyebrow="About HealingNet"
        title="Healthcare operations, finally built for the way Nigerian hospitals actually work."
        subtitle="From the small private clinic in Yaba to the multi-ward general hospital in Enugu — HealingNet replaces paper, queues and spreadsheets with one connected platform for hospitals, doctors and patients."
      />

      <section className="py-16 container mx-auto">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-heading font-bold mb-4">Our mission</h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Make modern healthcare operations affordable and accessible for every Nigerian hospital — so that
            patients spend less time waiting, doctors spend more time caring, and hospital owners actually know
            what's happening in their facility.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10">
          {stats.map((s) => (
            <div key={s.l} className="bg-card border border-border rounded-xl p-6 text-center">
              <div className="text-3xl font-heading font-bold text-primary">{s.v}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 bg-card/30 border-y border-border">
        <div className="container mx-auto">
          <h2 className="text-3xl font-heading font-bold mb-3">The problems we're solving</h2>
          <p className="text-muted-foreground mb-10 max-w-2xl">These aren't theoretical. Walk into most Nigerian hospitals today and you'll see all six.</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {problems.map((p) => (
              <div key={p.title} className="bg-background border border-border rounded-xl p-6">
                <h3 className="font-heading font-bold mb-2">{p.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16 container mx-auto">
        <h2 className="text-3xl font-heading font-bold mb-3">What we believe</h2>
        <p className="text-muted-foreground mb-10 max-w-2xl">Four principles guide every decision we make about the product.</p>
        <div className="grid sm:grid-cols-2 gap-5">
          {values.map((v) => (
            <div key={v.title} className="bg-card border border-border rounded-xl p-6">
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <v.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-heading font-bold mb-1">{v.title}</h3>
              <p className="text-sm text-muted-foreground">{v.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-16 container mx-auto">
        <div className="bg-gradient-to-br from-primary/10 via-card to-info/10 border border-border rounded-3xl p-10 md:p-14 text-center">
          <Sparkles className="w-10 h-10 text-primary mx-auto mb-4" />
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3">Want to see it in action?</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">Sign up free or talk to our team about getting HealingNet live at your facility.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/signup">Get Started Free</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/contact">Talk to sales</Link></Button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
