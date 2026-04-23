import { FileText, Clock, CreditCard, Microscope, Pill, Baby, Scissors, ShieldCheck, Video, Search, BarChart3, Users } from "lucide-react";

const features = [
  { icon: FileText, title: "Electronic Medical Records", desc: "Structured clinical notes, vitals, diagnoses & history at a glance." },
  { icon: Clock, title: "Patient Queue", desc: "Real-time check-ins, triage & doctor assignment." },
  { icon: CreditCard, title: "Billing & Revenue", desc: "Invoices, payments, discounts & insurance billing." },
  { icon: Microscope, title: "Laboratory", desc: "Order tests, capture results, flag abnormal values." },
  { icon: Pill, title: "Pharmacy", desc: "Inventory tracking, dispensing & low-stock alerts." },
  { icon: Baby, title: "Maternity", desc: "ANC register, gestational tracking, delivery logs." },
  { icon: Scissors, title: "Surgery", desc: "OT scheduling, op notes, post-op monitoring." },
  { icon: ShieldCheck, title: "Insurance & HMO", desc: "File claims, track approvals & reimbursements." },
  { icon: Video, title: "Telemedicine", desc: "Virtual consults with built-in meeting links." },
  { icon: Search, title: "Doctor Marketplace", desc: "Tap external specialists when you need them." },
  { icon: BarChart3, title: "Analytics", desc: "Patient flow, revenue trends & operational KPIs." },
  { icon: Users, title: "Staff Management", desc: "Roles, departments & granular permissions." },
];

export function Features() {
  return (
    <section id="features" className="py-20 bg-card/30">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3">Everything your hospital needs</h2>
          <p className="text-muted-foreground text-lg">Twelve integrated modules, one cohesive experience.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div key={f.title} className="bg-background border border-border rounded-xl p-6 hover:border-primary/40 hover:-translate-y-0.5 transition-all">
              <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-heading font-bold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
