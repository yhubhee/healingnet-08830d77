import { PageShell } from "@/components/landing/PageShell";
import { PageHero } from "@/components/landing/PageHero";
import { PageMeta } from "@/components/landing/PageMeta";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  FileText, Clock, CreditCard, Microscope, Pill, Baby, Scissors, ShieldCheck,
  Video, Search, BarChart3, Bed, Brain, Users,
} from "lucide-react";

type Service = { icon: any; name: string; problem: string; solution: string; applied: string };

const services: Service[] = [
  {
    icon: FileText,
    name: "Electronic Medical Records (EMR)",
    problem: "Patient files are paper folders that get lost, misfiled or damaged. Doctors waste minutes per visit hunting for history and writing the same notes over and over.",
    solution: "Structured digital records with 13 clinical entry types — vitals, history, examination, diagnoses, prescriptions, lab orders, surgery notes and more. One patient = one timeline accessible from any portal.",
    applied: "A doctor in cardiology opens a patient's record and instantly sees their last BP reading, current medications, drug allergies, and recent lab results — without flipping through a folder.",
  },
  {
    icon: Clock,
    name: "Live Patient Queue",
    problem: "Patients arrive at 7am and sit on benches until late afternoon. Staff manage order on paper, leading to disputes about who came first and patients giving up and leaving.",
    solution: "A real-time digital queue. Front-desk checks patients in, the system routes them to the right doctor by specialty and urgency, and every screen shows the live position.",
    applied: "Receptionist taps 'Check In' → patient receives a queue number → doctor sees their list update live → patient (or their family on the patient portal) tracks their position from anywhere in the building.",
  },
  {
    icon: CreditCard,
    name: "Billing & Revenue",
    problem: "Cash, POS, transfers and HMO collections are tracked across notebooks, Excel and a cashier's memory. Reconciliation takes days and revenue quietly leaks.",
    solution: "Itemized invoices in Naira, multi-method payments, discounts, partial payments and a clean revenue ledger. Every charge is tied to a patient and a service.",
    applied: "Lab raises an invoice for a malaria test → cashier accepts cash → invoice marked paid automatically → admin's dashboard shows updated revenue for the day in real time.",
  },
  {
    icon: Microscope,
    name: "Laboratory",
    problem: "Lab requests are scribbled on paper slips that get lost. Results come back hours later on yet another slip and may never reach the doctor's notes.",
    solution: "Doctors order tests directly from EMR. Lab techs see a queue of pending tests, capture structured results across 11 medical categories, and abnormal values are auto-flagged.",
    applied: "Doctor orders FBC + Malaria → lab tech runs the test, enters values → result appears on the doctor's screen with red flags on anything out of range, and is permanently stored in the patient record.",
  },
  {
    icon: Pill,
    name: "Pharmacy",
    problem: "Drug stock is counted by hand once a week. Items run out without warning, expired drugs get dispensed, and there's no link between a prescription and what was actually given.",
    solution: "Live inventory with low-stock alerts, expiry tracking, and a dispensing flow that ties every dispensed drug back to a prescription.",
    applied: "Doctor writes a prescription in EMR → pharmacist sees it in their queue → dispenses, stock auto-decrements → pharmacist gets alerted when a fast-moving drug drops below reorder level.",
  },
  {
    icon: Baby,
    name: "Maternity",
    problem: "ANC visits, gestational age, scans and delivery notes live in a separate paper register. Continuity from antenatal to delivery to postnatal is fragile.",
    solution: "A dedicated maternity module with ANC register, gestational tracking, risk flags, delivery logs and postnatal follow-ups — all linked to the same patient record.",
    applied: "An expecting mother registers for ANC at 12 weeks → every visit auto-updates gestational age → at delivery, the midwife logs the outcome → postnatal visits are scheduled automatically.",
  },
  {
    icon: Scissors,
    name: "Surgery",
    problem: "OT scheduling is whiteboard-based. Op notes are handwritten and rarely make it back to the patient's main file. Post-op monitoring is inconsistent.",
    solution: "Surgery scheduling, structured op notes, and post-op observation logs that live inside the patient's EMR.",
    applied: "Surgeon books a theatre slot for an appendectomy → anaesthetist and theatre nurse see it on their schedule → post-op vitals get logged into the same record the GP can see at follow-up.",
  },
  {
    icon: ShieldCheck,
    name: "Insurance & HMO",
    problem: "Filing NHIS and HMO claims is a separate manual workflow. Approvals take weeks, denials are common, and tracking reimbursements is a nightmare.",
    solution: "File claims directly from a patient encounter, attach supporting documentation, and track approval/payment status in one place.",
    applied: "Patient with an HMO comes in → encounter is logged → admin files a claim with one click → claim status moves from Submitted → Approved → Paid, all visible from the dashboard.",
  },
  {
    icon: Video,
    name: "Telemedicine",
    problem: "Patients in Lagos can't easily see a specialist in Abuja. Follow-ups for stable patients waste a clinic slot when a 10-minute call would do.",
    solution: "Built-in teleconsultations with auto-generated meeting links, visible to both doctor and patient, with the same EMR access as an in-person visit.",
    applied: "Patient books a teleconsult on the patient portal → doctor sees it on their schedule → both join via the link at the appointed time → notes and prescriptions flow into the same record.",
  },
  {
    icon: Search,
    name: "Doctor Marketplace",
    problem: "Hospitals occasionally need a specialist they don't have on staff — a paediatric cardiologist, a dermatologist for a rare case. Finding one is ad-hoc.",
    solution: "A network of vetted external specialists hospitals can request consultations from, with transparent fee splits and SLA-based response times.",
    applied: "GP encounters a complex skin case → requests a marketplace consult with a dermatologist → specialist accepts, reviews EMR, and joins a teleconsult — fees are auto-split between hospital and specialist.",
  },
  {
    icon: BarChart3,
    name: "Analytics & Reporting",
    problem: "Hospital owners can't answer basic questions — patients today, revenue this week, top diagnoses, busiest doctors — without staff manually pulling numbers.",
    solution: "Live dashboards with patient flow, revenue trends, top diagnoses and department mix. KPIs update as the day happens.",
    applied: "At the end of the week, the medical director opens Analytics and sees: 482 patients seen, ₦12.3M revenue, malaria as top diagnosis, paediatrics as busiest department — without asking anyone.",
  },
  {
    icon: Bed,
    name: "Bed & Ward Management",
    problem: "Bed availability is tracked on a whiteboard at the nursing station. Daily bed charges are remembered or forgotten at discharge.",
    solution: "Wards and beds modeled in the system with status (available/occupied/cleaning), patient assignment, and automatic daily bed-rate billing.",
    applied: "Patient admitted to Ward B, Bed 3 → bed status flips to occupied → daily bed charges accrue automatically → on discharge, the bed is marked for cleaning and charges are added to the final invoice.",
  },
  {
    icon: Brain,
    name: "AI-Assisted Triage",
    problem: "Patients self-diagnose on Google or wait until symptoms are critical. Walk-in queues mix mild and urgent cases without prioritization.",
    solution: "A guided 4-step symptom triage chat that scores severity 1–10, suggests the right specialty, and proposes the nearest partner hospital.",
    applied: "Patient opens the patient portal at home → describes symptoms → gets a severity score and a recommended specialty → books an appointment that lands on the right doctor's schedule with context.",
  },
  {
    icon: Users,
    name: "Staff Management",
    problem: "Who can access what? Who is on duty? Who handled which patient? In paper-based hospitals, nobody really knows.",
    solution: "Granular roles (admin, receptionist, nurse, lab tech, pharmacist, manager, medical officer), department assignment, and audit trails on every action.",
    applied: "Admin invites a new nurse → assigns them to Maternity → nurse can only see and edit what their role allows → every record edit is timestamped with who made it.",
  },
];

export default function Services() {
  return (
    <PageShell>
      <PageMeta title="Services — Everything HealingNet does for your hospital" description="14 fully integrated services covering EMR, queue, billing, lab, pharmacy, maternity, surgery, insurance, telemedicine and more — explained in detail." />
      <PageHero
        eyebrow="Services"
        title="One platform. Fourteen services. Zero swivel-chair."
        subtitle="Each service below explains the everyday problem it solves in a Nigerian hospital, how HealingNet solves it, and exactly how it gets used in practice."
      />

      <section className="py-12 container mx-auto">
        <div className="space-y-6">
          {services.map((s, i) => (
            <article key={s.name} className="bg-card border border-border rounded-2xl p-6 md:p-8 hover:border-primary/40 transition-colors">
              <div className="flex items-start gap-5">
                <div className="shrink-0 w-12 h-12 md:w-14 md:h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                  <s.icon className="w-6 h-6 md:w-7 md:h-7 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground font-mono mb-1">{String(i + 1).padStart(2, "0")}</div>
                  <h2 className="text-xl md:text-2xl font-heading font-bold mb-4">{s.name}</h2>
                  <div className="grid md:grid-cols-3 gap-5">
                    <div>
                      <div className="text-xs font-semibold text-destructive uppercase tracking-wider mb-1.5">The problem</div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.problem}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-primary uppercase tracking-wider mb-1.5">How we solve it</div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.solution}</p>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-success uppercase tracking-wider mb-1.5">In practice</div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.applied}</p>
                    </div>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="py-16 container mx-auto">
        <div className="bg-gradient-to-br from-primary/10 via-card to-info/10 border border-border rounded-3xl p-10 md:p-14 text-center">
          <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3">Pick the modules you need</h2>
          <p className="text-muted-foreground mb-6 max-w-xl mx-auto">Start with EMR Essentials or unlock everything with the Telemedicine Suite.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/pricing">See Pricing</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/signup">Get Started Free</Link></Button>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
