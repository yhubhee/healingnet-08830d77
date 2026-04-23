import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  { q: "Is my hospital data secure?", a: "Yes. All data is encrypted in transit and at rest, with role-based access control and audit trails." },
  { q: "Can I switch plans later?", a: "Absolutely. Upgrade from EMR Essentials to Telemedicine Suite anytime from your settings — your data carries over." },
  { q: "Do patients need to pay?", a: "Never. Patients use HealingNet completely free to book appointments, view results & message their doctors." },
  { q: "How long does setup take?", a: "Most hospitals are live within a day. We provide guided onboarding and a knowledge base." },
  { q: "Do you support insurance & HMO billing?", a: "Yes. File and track claims with all major insurance providers directly from the platform." },
  { q: "Can I import existing patient data?", a: "Yes — contact our team for a guided data migration from your current system." },
];

export function FAQ() {
  return (
    <section id="faq" className="py-20 container mx-auto max-w-3xl">
      <div className="text-center mb-10">
        <h2 className="text-3xl md:text-4xl font-heading font-bold mb-3">Frequently asked questions</h2>
      </div>
      <Accordion type="single" collapsible className="space-y-2">
        {faqs.map((f, i) => (
          <AccordionItem key={i} value={`q${i}`} className="bg-card border border-border rounded-xl px-5">
            <AccordionTrigger className="font-heading font-semibold hover:no-underline">{f.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
