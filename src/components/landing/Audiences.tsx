import { User, Stethoscope, Building2 } from "lucide-react";

const audiences = [
  {
    icon: User,
    title: "For Patients",
    color: "text-info",
    bg: "bg-info/10",
    benefits: ["Book appointments at any partner hospital", "View prescriptions, lab results & medical records", "Direct messaging with your doctor", "Free forever"],
  },
  {
    icon: Stethoscope,
    title: "For Doctors",
    color: "text-primary",
    bg: "bg-primary/10",
    benefits: ["Smart EMR with structured clinical entries", "Manage queue, consultations & telemedicine", "Marketplace to take external consultations", "Earn from your spare hours"],
  },
  {
    icon: Building2,
    title: "For Hospitals",
    color: "text-success",
    bg: "bg-success/10",
    benefits: ["End-to-end operations: queue, EMR, billing", "Lab, pharmacy, surgery & maternity modules", "Insurance & HMO claim management", "Real-time analytics & reporting"],
  },
];

export function Audiences() {
  return (
    <section id="audiences" className="py-20 container mx-auto">
      <div className="text-center mb-12">
        <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3">Built for everyone in healthcare</h2>
        <p className="text-muted-foreground text-lg">One platform, three powerful experiences.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        {audiences.map((a) => (
          <div key={a.title} className="bg-card border border-border rounded-2xl p-8 hover:border-primary/50 transition-colors">
            <div className={`w-14 h-14 rounded-xl ${a.bg} flex items-center justify-center mb-5`}>
              <a.icon className={`w-7 h-7 ${a.color}`} />
            </div>
            <h3 className="text-xl font-heading font-bold mb-4">{a.title}</h3>
            <ul className="space-y-2.5">
              {a.benefits.map((b) => (
                <li key={b} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full ${a.color.replace("text-", "bg-")} shrink-0`} />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
