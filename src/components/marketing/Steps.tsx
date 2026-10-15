import type { ComponentType, ReactNode } from "react";
import type { IllustrationProps } from "./illustrations/Illustration";
import { Reveal } from "./Reveal";
import { cn } from "@/lib/utils";

export interface Step {
  title: string;
  text: ReactNode;
  illustration?: ComponentType<IllustrationProps>;
}

/** Numbered steps (3 or 4), with optional small illustrations. */
export function Steps({ title, intro, steps, id, className }: {
  title: string;
  intro?: string;
  steps: Step[];
  id?: string;
  className?: string;
}) {
  const headingId = `${id ?? "steps"}-title`;
  return (
    <section id={id} className={cn("mk-section", className)} aria-labelledby={headingId}>
      <div className="mk-container">
        <Reveal className="mb-10 max-w-2xl md:mb-14">
          <h2 id={headingId}>{title}</h2>
          {intro && <p className="mt-4 text-muted-foreground">{intro}</p>}
        </Reveal>
        <ol className={cn("grid gap-6", steps.length === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-3")}>
          {steps.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 80} className="mk-card flex flex-col p-6">
              {s.illustration && <s.illustration className="mb-4 h-28 w-auto self-start" />}
              <span className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary font-body text-sm font-bold text-primary-foreground" aria-hidden>
                {i + 1}
              </span>
              <h3 className="mb-2"><span className="sr-only">Step {i + 1}: </span>{s.title}</h3>
              <div className="text-base text-muted-foreground">{s.text}</div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
