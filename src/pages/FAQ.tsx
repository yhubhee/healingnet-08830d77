import { PageShell } from "@/components/landing/PageShell";
import { PageHero } from "@/components/landing/PageHero";
import { PageMeta } from "@/components/landing/PageMeta";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const groups: { title: string; items: { q: string; a: string }[] }[] = [
  {
    title: "Security & data",
    items: [
      { q: "Is my hospital data secure?", a: "Yes. All data is encrypted in transit and at rest. Every table uses row-level security so users only see what their role allows. Sensitive actions are audit-logged." },
      { q: "Where is my data stored?", a: "On managed cloud infrastructure with daily automated backups. Your hospital owns the data and can request a full export anytime." },
      { q: "Can different staff see different things?", a: "Yes. We support 7+ granular roles (admin, receptionist, nurse, lab tech, pharmacist, manager, medical officer), each scoped to relevant modules and patients." },
    ],
  },
  {
    title: "Setup & onboarding",
    items: [
      { q: "How long does setup take?", a: "Most hospitals are live within a day. You sign up, configure wards/departments, invite staff, and start checking in patients the same evening." },
      { q: "Do you migrate our existing patient data?", a: "Yes — we offer guided CSV/Excel migration. For larger datasets we work with your team directly." },
      { q: "Do you provide training?", a: "Yes. We provide written guides, in-app walkthroughs, and live onboarding sessions for staff." },
    ],
  },
  {
    title: "Billing & subscriptions",
    items: [
      { q: "What does a subscription cost?", a: "EMR Essentials starts at ₦75,000/month and Telemedicine Suite at ₦150,000/month. Annual billing saves ~17%. Patients are free forever." },
      { q: "Can I switch plans?", a: "Yes — upgrade or downgrade from Settings → Subscription. Data and configuration carry over." },
      { q: "Do you support insurance & HMO billing?", a: "Yes. File and track claims with all major HMOs and NHIS directly from the patient encounter." },
    ],
  },
  {
    title: "For patients",
    items: [
      { q: "Do patients pay?", a: "No. Patients use HealingNet completely free to book appointments, view results and message their care team." },
      { q: "Can I see my records?", a: "Yes. From the patient portal you can view appointments, prescriptions, lab results and your full medical record at any HealingNet hospital you've visited." },
      { q: "Can I do a teleconsult?", a: "Yes — provided your hospital uses the Telemedicine Suite plan. You'll see a 'Teleconsult' option when booking." },
    ],
  },
  {
    title: "For doctors",
    items: [
      { q: "Can I work across multiple hospitals?", a: "Yes. Doctors can be invited to multiple hospitals and switch context from their portal. Earnings are tracked per hospital." },
      { q: "Is there a marketplace for external consultations?", a: "Yes. With the Telemedicine Suite, doctors can take consultation requests from other hospitals with transparent fee splits." },
    ],
  },
  {
    title: "Integrations",
    items: [
      { q: "Do you have an API?", a: "An API is on our roadmap. Today, all data is exportable as CSV/JSON on request. Contact us for integration discussions." },
      { q: "Do you support lab analyzers?", a: "Direct analyzer integration is on the roadmap. Today, lab techs enter results into structured forms (11 categories, auto-flagging abnormal values)." },
    ],
  },
];

export default function FAQ() {
  return (
    <PageShell>
      <PageMeta title="FAQ — HealingNet questions answered" description="Answers to common questions about HealingNet's security, setup, pricing, patient experience, doctor workflows and integrations." />
      <PageHero
        eyebrow="FAQ"
        title="Questions, answered."
        subtitle="If your question isn't here, reach us at hello@healingnet.app or via the Contact page."
      />

      <section className="py-16 container mx-auto max-w-3xl space-y-10">
        {groups.map((g) => (
          <div key={g.title}>
            <h2 className="text-xl font-heading font-bold mb-4 text-primary">{g.title}</h2>
            <Accordion type="single" collapsible className="space-y-2">
              {g.items.map((f, i) => (
                <AccordionItem key={i} value={`${g.title}-${i}`} className="bg-card border border-border rounded-xl px-5">
                  <AccordionTrigger className="font-heading font-semibold hover:no-underline text-left">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}
      </section>

      <section className="py-12 container mx-auto text-center">
        <p className="text-muted-foreground mb-4">Still have questions?</p>
        <Button asChild><Link to="/contact">Contact us</Link></Button>
      </section>
    </PageShell>
  );
}
