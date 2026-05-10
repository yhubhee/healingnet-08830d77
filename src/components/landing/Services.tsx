import { Building2, Stethoscope, User } from "lucide-react";

const groups = [
  {
    icon: Building2,
    title: "For Hospitals",
    color: "from-primary to-info",
    items: [
      "Electronic Medical Records (EMR)",
      "Live patient queue & check-in",
      "Billing, payments & revenue",
      "Laboratory orders & results",
      "Pharmacy inventory & dispensing",
      "Maternity (ANC & deliveries)",
      "Surgery scheduling & op notes",
      "Insurance / HMO claims & NHIS",
      "Bed & ward management",
      "Staff roles & analytics",
    ],
  },
  {
    icon: Stethoscope,
    title: "For Doctors",
    color: "from-info to-primary",
    items: [
      "Daily appointment list",
      "Patient roster with full history",
      "e-Prescriptions",
      "Lab order & result review",
      "Telemedicine consultations",
      "External consult marketplace",
      "Earnings & payout tracking",
    ],
  },
  {
    icon: User,
    title: "For Patients",
    color: "from-success to-primary",
    items: [
      "AI-assisted symptom triage",
      "Book appointments online",
      "View prescriptions & request refills",
      "Access lab results securely",
      "Personal medical records",
      "Message your care team",
      "Teleconsult from anywhere",
    ],
  },
];

export function Services() {
  return (
    <section id="services" className="py-20 bg-card/30">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">Services</span>
          <h2 className="text-3xl md:text-4xl font-heading font-bold mt-2 mb-3">
            One platform, three connected experiences
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Every role gets a tailored workspace — and they all share the same patient data in real time.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {groups.map((g) => (
            <div key={g.title} className="bg-background border border-border rounded-2xl p-6 hover:border-primary/40 transition-colors">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${g.color} flex items-center justify-center mb-4`}>
                <g.icon className="w-6 h-6 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-heading font-bold mb-4">{g.title}</h3>
              <ul className="space-y-2">
                {g.items.map((item) => (
                  <li key={item} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
