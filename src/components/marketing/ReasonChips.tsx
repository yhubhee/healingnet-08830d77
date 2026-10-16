import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { EMERGENCY_LINE, REASONS, triagePath } from "./content";
import { useCareLink } from "./useCareLink";
import { Reveal } from "./Reveal";

/** One-tap reasons for a visit; each opens the triage assistant with the reason filled in. */
export function ReasonChips({ title = "Common reasons people visit" }: { title?: string }) {
  const { linkProps } = useCareLink();
  return (
    <section className="mk-section pb-8 md:pb-12" aria-labelledby="reasons-title">
      <Reveal className="mk-container">
        <h2 id="reasons-title" className="mb-2">{title}</h2>
        <p className="mb-6 text-muted-foreground">Tap one and our triage assistant will help you find the right doctor.</p>
        {/* Wraps on desktop; a swipeable row on small screens. */}
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {REASONS.map((r) => (
            <li key={r} className="shrink-0 snap-start">
              <Link
                {...linkProps(triagePath(r))}
                className="group inline-flex min-h-12 items-center gap-2 rounded-full border border-border bg-card px-5 text-base font-medium text-foreground transition-colors hover:border-primary hover:text-primary"
              >
                {r}
                <ArrowRight className="h-4 w-4 opacity-60 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">{EMERGENCY_LINE}</p>
      </Reveal>
    </section>
  );
}
