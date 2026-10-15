import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Photo } from "./Photo";
import { Reveal } from "./Reveal";

/** Image + text side by side; `reverse` puts the image on the right. Stacks on mobile. */
export function SplitFeature({ photo, media, eyebrow, title, children, points, reverse = false, id, className, headingLevel = 2 }: {
  photo?: string;
  /** Use instead of a photo (e.g. an HTML mock-up). */
  media?: ReactNode;
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  points?: string[];
  reverse?: boolean;
  id?: string;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <section id={id} className={cn("mk-section", className)}>
      <div className="mk-container grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <Reveal className={cn(reverse && "md:order-2")}>
          {media ?? (photo && <Photo id={photo} sizes="(min-width: 768px) 45vw, 92vw" className="aspect-[4/3] rounded-3xl" />)}
        </Reveal>
        <Reveal delay={80}>
          {eyebrow && <p className="mk-eyebrow mb-3">{eyebrow}</p>}
          <Heading className={cn("mb-4", headingLevel === 3 && "text-[1.875rem] md:text-[2.25rem]")}>{title}</Heading>
          {children && <div className="space-y-4 text-muted-foreground">{children}</div>}
          {points && (
            <ul className="mt-6 space-y-3">
              {points.map((p) => (
                <li key={p} className="flex gap-3">
                  <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </div>
    </section>
  );
}
