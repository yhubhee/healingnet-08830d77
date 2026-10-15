import type { ComponentType } from "react";
import type { IllustrationProps } from "./illustrations/Illustration";
import {
  LicenceIllustration,
  NairaIllustration,
  ShareCodeIllustration,
  BrowserIllustration,
  ShieldIllustration,
  CompassIllustration,
} from "./illustrations";
import { Reveal } from "./Reveal";

interface Fact {
  title: string;
  text: string;
  icon: ComponentType<IllustrationProps>;
}

// True capability facts only. No user counts, ratings, logos or awards.
const FACTS: Fact[] = [
  { icon: LicenceIllustration, title: "Licence-checked doctors", text: "Every doctor's licence is checked with the council that issued it before they see patients." },
  { icon: NairaIllustration, title: "Pay in naira", text: "Secure payments through Paystack." },
  { icon: ShareCodeIllustration, title: "You decide who sees your records", text: "Share them with a one-time code that expires in 15 minutes." },
  { icon: ShieldIllustration, title: "Built for Nigerian law", text: "Built to follow the Nigeria Data Protection Act 2023. Records are encrypted." },
  { icon: BrowserIllustration, title: "No app to download", text: "Works in the browser on any smartphone." },
  { icon: CompassIllustration, title: "Honest triage", text: "Suggests the right specialty and how soon to be seen. It is not a diagnosis." },
];

export function TrustGrid({ title = "Care you can trust" }: { title?: string }) {
  return (
    <section className="mk-section bg-muted/60" aria-labelledby="trust-title">
      <div className="mk-container">
        <Reveal className="mb-10 max-w-2xl">
          <h2 id="trust-title">{title}</h2>
        </Reveal>
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FACTS.map((f, i) => (
            <Reveal as="li" key={f.title} delay={(i % 3) * 80} className="mk-card flex gap-4 p-6">
              <f.icon className="h-14 w-14 shrink-0" />
              <div>
                <h3 className="mb-1 font-body text-lg font-bold tracking-normal">{f.title}</h3>
                <p className="text-base text-muted-foreground">{f.text}</p>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
