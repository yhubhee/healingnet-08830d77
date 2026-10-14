// Small shared building blocks for the admin console.
import { useState, type ComponentType, type ReactNode } from "react";
import {
  AlertTriangle, Ban, Check, ChevronLeft, ChevronRight, CircleDashed, Clock, Copy, RefreshCw, ShieldCheck,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { friendlyError } from "@/lib/errors";
import { PAGE_SIZE, type PlanState } from "../api";
import { ago, daysUntil, fmtDateTime, fmtNum, naira, nairaShort, titleCase, times } from "../format";

// ---------------------------------------------------------------------------
// Status badges: colour plus an icon and a text label, never colour alone.
// ---------------------------------------------------------------------------
export type Tone = "good" | "warn" | "bad" | "neutral" | "info";

const TONE: Record<Tone, string> = {
  good: "bg-success/10 text-success border-success/30",
  warn: "bg-warning/10 text-warning border-warning/30",
  bad: "bg-destructive/10 text-destructive border-destructive/30",
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-primary/10 text-primary border-primary/30",
};
const TONE_ICON: Record<Tone, ComponentType<{ className?: string }>> = {
  good: Check, warn: Clock, bad: XCircle, neutral: CircleDashed, info: ShieldCheck,
};

export function StatusBadge({ tone, label, icon, className }: { tone: Tone; label: ReactNode; icon?: ComponentType<{ className?: string }>; className?: string }) {
  const Icon = icon ?? TONE_ICON[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium", TONE[tone], className)}>
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {label}
    </span>
  );
}

export function VerificationBadge({ status, active = true }: { status: string; active?: boolean }) {
  if (!active) return <StatusBadge tone="bad" label="Suspended" icon={Ban} />;
  switch (status) {
    case "approved": return <StatusBadge tone="good" label="Approved" />;
    case "pending":
    case "pending_review": return <StatusBadge tone="warn" label="Pending review" />;
    case "rejected": return <StatusBadge tone="bad" label="Rejected" />;
    case "unverified": return <StatusBadge tone="neutral" label="Unverified" />;
    default: return <StatusBadge tone="neutral" label={titleCase(status)} />;
  }
}

export function PlanBadge({ plan, trialEndsAt, planExpiresAt }: { plan: PlanState; trialEndsAt?: string | null; planExpiresAt?: string | null }) {
  if (plan === "trialing") {
    const d = daysUntil(trialEndsAt);
    return <StatusBadge tone="warn" label={d == null ? "Trial" : d <= 0 ? "Trial ends today" : `Trial · ${d} d left`} />;
  }
  if (plan === "emr" || plan === "telemedicine") {
    const d = daysUntil(planExpiresAt);
    const soon = d != null && d <= 7;
    return <StatusBadge tone={soon ? "warn" : "good"} label={`${plan === "emr" ? "EMR" : "Telemedicine"}${soon ? ` · ${d} d left` : ""}`} />;
  }
  if (plan === "lapsed") return <StatusBadge tone="neutral" label="Expired" icon={AlertTriangle} />;
  return <StatusBadge tone="neutral" label="No plan" />;
}

export function PaymentStatusBadge({ status, review }: { status: string; review?: string | null }) {
  if (review === "duplicate_payment_refund_needed") return <StatusBadge tone="bad" label="Refund needed" icon={AlertTriangle} />;
  if (review === "refund_resolved") return <StatusBadge tone="neutral" label="Refunded" />;
  switch (status) {
    case "success": return <StatusBadge tone="good" label="Success" />;
    case "pending": return <StatusBadge tone="warn" label="Pending" />;
    case "failed": return <StatusBadge tone="bad" label="Failed" />;
    case "abandoned": return <StatusBadge tone="neutral" label="Abandoned" />;
    default: return <StatusBadge tone="neutral" label={titleCase(status)} />;
  }
}

// ---------------------------------------------------------------------------
// Times and money with the full value in a tooltip
// ---------------------------------------------------------------------------
export function RelTime({ iso, className }: { iso: string | null | undefined; className?: string }) {
  if (!iso) return <span className={className}>—</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <time dateTime={iso} className={cn("tabular-nums cursor-default", className)} tabIndex={0}>{ago(iso)}</time>
      </TooltipTrigger>
      <TooltipContent>{fmtDateTime(iso)} (Lagos)</TooltipContent>
    </Tooltip>
  );
}

export function Money({ value, compact, className }: { value: number; compact?: boolean; className?: string }) {
  const short = compact ? nairaShort(value) : naira(value);
  if (short === naira(value)) return <span className={cn("tabular-nums", className)}>{short}</span>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn("tabular-nums cursor-default", className)} tabIndex={0}>{short}</span>
      </TooltipTrigger>
      <TooltipContent className="tabular-nums">{naira(value)}</TooltipContent>
    </Tooltip>
  );
}

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label={`${label}: ${value}`}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(value).then(
          () => { setDone(true); setTimeout(() => setDone(false), 1500); },
          () => toast.error("Couldn't copy"),
        );
      }}
    >
      {done ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Page states
// ---------------------------------------------------------------------------
export function EmptyState({ icon: Icon, text, action }: { icon: ComponentType<{ className?: string }>; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-10 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{text}</p>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-10 text-center">
      <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
      <div>
        <p className="font-medium">Couldn't load this</p>
        <p className="mt-1 text-sm text-muted-foreground">{friendlyError(error, "Something went wrong on our side. Please try again.")}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button>
    </div>
  );
}

/** Skeleton shaped like a list: a table on desktop, cards on mobile. */
export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="hidden overflow-hidden rounded-2xl border md:block">
        <Skeleton className="h-10 rounded-none" />
        {times(rows).map((i) => (
          <div key={i} className="flex items-center gap-4 border-t px-4 py-3">
            <Skeleton className="h-4 w-1/4" /><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-24" /><Skeleton className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-2 md:hidden">
        {times(Math.min(rows, 5)).map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
    </div>
  );
}

export function Pager({ page, total, onPage, fetching }: { page: number; total: number; onPage: (p: number) => void; fetching?: boolean }) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total <= PAGE_SIZE) return <p className="mt-3 text-xs text-muted-foreground tabular-nums">{fmtNum(total)} {total === 1 ? "result" : "results"}</p>;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  return (
    <nav aria-label="Pagination" className="mt-3 flex items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
        {fmtNum(from)}–{fmtNum(to)} of {fmtNum(total)}{fetching ? " · loading…" : ""}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="px-2 text-sm tabular-nums">{page} / {pages}</span>
        <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}

/** A card that becomes a list row on mobile: title, a few facts, a status, a chevron. */
export function MobileRow({ title, facts, status, onOpen }: { title: ReactNode; facts: ReactNode[]; status?: ReactNode; onOpen: () => void }) {
  return (
    <button
      type="button" onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="truncate font-medium">{title}</div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {facts.map((f, i) => <span key={i} className="tabular-nums">{f}</span>)}
        </div>
        {status && <div className="pt-1">{status}</div>}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

export function Section({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border bg-card p-4 sm:p-6", className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="font-heading text-base font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm tabular-nums">{children || "—"}</dd>
    </div>
  );
}
