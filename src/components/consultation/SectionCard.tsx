import { ReactNode, useState } from "react";
import { ChevronDown, Circle, CircleDot, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type Completion = "empty" | "progress" | "done";

export function SectionCard({ title, completion, actions, children, defaultOpen = true }: {
  title: string; completion: Completion; actions?: ReactNode; children: ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = completion === "done" ? CheckCircle2 : completion === "progress" ? CircleDot : Circle;
  return (
    <section className="bg-card border border-border rounded-xl">
      <header className="flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-2 flex-1 min-w-0 text-left" aria-expanded={open}>
          <Icon className={cn("w-4 h-4 shrink-0", completion === "done" ? "text-success" : completion === "progress" ? "text-warning" : "text-muted-foreground")} />
          <h2 className="font-heading font-semibold truncate">{title}</h2>
          <ChevronDown className={cn("w-4 h-4 ml-auto shrink-0 transition-transform", open && "rotate-180")} />
        </button>
        {actions}
      </header>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </section>
  );
}
