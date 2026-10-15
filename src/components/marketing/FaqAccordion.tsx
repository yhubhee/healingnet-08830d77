import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { Faq } from "./faqs";

/** Questions and answers in an accordion. Headings are left to the caller. */
export function FaqAccordion({ items, idPrefix = "faq" }: { items: Faq[]; idPrefix?: string }) {
  return (
    <Accordion type="single" collapsible className="mk-card divide-y divide-border px-5 md:px-8">
      {items.map((f, i) => (
        <AccordionItem key={f.q} value={`${idPrefix}-${i}`} className="border-b-0">
          <AccordionTrigger className="min-h-14 py-5 text-left text-base font-semibold hover:no-underline md:text-lg [&>svg]:text-primary">
            {f.q}
          </AccordionTrigger>
          <AccordionContent className="pb-5 text-base text-muted-foreground">{f.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
