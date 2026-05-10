import { ReactNode } from "react";

export function PageHero({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-info/5 pointer-events-none" />
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/15 rounded-full blur-[120px] pointer-events-none" />
      <div className="container mx-auto relative py-20 lg:py-28">
        <div className="max-w-3xl">
          {eyebrow && (
            <span className="text-sm font-semibold text-primary uppercase tracking-wider">{eyebrow}</span>
          )}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-heading font-bold leading-tight mt-3 mb-5">
            {title}
          </h1>
          {subtitle && <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">{subtitle}</p>}
          {children && <div className="mt-8">{children}</div>}
        </div>
      </div>
    </section>
  );
}
