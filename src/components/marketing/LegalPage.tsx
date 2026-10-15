import type { ReactNode } from "react";
import { FileWarning } from "lucide-react";
import { PageShell } from "@/components/landing/PageShell";
import { PageMeta } from "@/components/landing/PageMeta";

/** Simple long-form page for legal text, with a visible "Draft" note. */
export function LegalPage({ title, description, updated, children }: {
  title: string;
  description: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <PageShell>
      <PageMeta title={`${title} | HealingNet`} description={description} />
      <article className="mk-container max-w-3xl py-12 md:py-20">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent/20 px-4 py-1.5 text-sm font-semibold text-foreground">
          <FileWarning className="h-4 w-4" aria-hidden />
          Draft: this text is waiting for legal review
        </p>
        <h1>{title}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated: {updated}</p>
        <div className="mt-10 space-y-6 text-base [&_h2]:mb-3 [&_h2]:mt-10 [&_h2]:text-[1.6rem] [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_p]:text-muted-foreground [&_ul]:space-y-2 [&_ul]:text-muted-foreground">
          {children}
        </div>
      </article>
    </PageShell>
  );
}
