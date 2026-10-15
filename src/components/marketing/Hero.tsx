import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Page hero: eyebrow, the page's single H1, a short line of text, actions,
 * and optional media (two columns from lg, stacked below).
 */
export function Hero({ eyebrow, title, subtitle, children, media, className }: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  media?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden", className)}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_80%_0%,hsl(var(--primary)/0.10),transparent_70%)]"
      />
      <div className={cn("mk-container grid items-center gap-10 py-12 md:py-20", media && "lg:grid-cols-[1.1fr_0.9fr] lg:gap-14")}>
        <div className="max-w-2xl">
          {eyebrow && <p className="mk-eyebrow mb-4">{eyebrow}</p>}
          <h1>{title}</h1>
          {subtitle && <p className="mt-5 max-w-xl text-lg text-muted-foreground md:text-xl">{subtitle}</p>}
          {children && <div className="mt-8">{children}</div>}
        </div>
        {media && <div className="relative">{media}</div>}
      </div>
    </section>
  );
}
