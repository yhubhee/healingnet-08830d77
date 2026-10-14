// /admin/audit: admin_list_audit() as a timeline.
import { Ban, CalendarPlus, Check, Mail, RotateCcw, ScrollText, X, type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAudit, type AuditRow } from "../api";
import { actionLabel, fmtDateTime, times } from "../format";
import { EmptyState, ErrorState, Pager, RelTime } from "../components/bits";
import { useUrlState } from "../components/url-state";
import { useDetail } from "../components/detail-state";

const ICON: Record<string, { icon: LucideIcon; tone: string }> = {
  approve: { icon: Check, tone: "bg-success/15 text-success" },
  reactivate: { icon: Check, tone: "bg-success/15 text-success" },
  reject: { icon: X, tone: "bg-destructive/15 text-destructive" },
  suspend: { icon: Ban, tone: "bg-destructive/15 text-destructive" },
  extend_trial: { icon: CalendarPlus, tone: "bg-warning/15 text-warning" },
  refund_resolved: { icon: RotateCcw, tone: "bg-primary/15 text-primary" },
  handled: { icon: Mail, tone: "bg-muted text-muted-foreground" },
  reopened: { icon: Mail, tone: "bg-muted text-muted-foreground" },
};

function detailsText(a: AuditRow) {
  const d = a.details ?? {};
  const parts: string[] = [];
  if (typeof d.days === "number") parts.push(`+${d.days} days${d.until ? ` (until ${fmtDateTime(String(d.until))})` : ""}`);
  const why = d.reason ?? d.notes ?? d.note;
  if (why) parts.push(`“${String(why)}”`);
  return parts.join(" · ");
}

function Target({ a }: { a: AuditRow }) {
  const { open } = useDetail();
  if ((a.target_type === "hospital" || a.target_type === "doctor") && a.target_id) {
    const kind = a.target_type;
    const id = a.target_id;
    return (
      <button type="button" onClick={() => open(kind, id)} className="font-medium text-primary underline-offset-2 hover:underline">
        {a.target_name ?? (kind === "hospital" ? "a deleted hospital" : "a deleted doctor")}
      </button>
    );
  }
  if (a.target_type === "payment") return <span className="font-medium">{a.target_id?.slice(0, 8) ?? ""}</span>;
  return null;
}

export default function Audit() {
  const { set, page } = useUrlState();
  const q = useAudit(page);

  if (q.isLoading) {
    return <div className="space-y-3" aria-busy="true" aria-label="Loading audit log">{times(6).map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;
  }
  if (q.isError || !q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.data.rows.length === 0) return <EmptyState icon={ScrollText} text="No admin actions recorded yet." />;

  return (
    <div>
      <ol className={`relative space-y-1 transition-opacity ${q.isPlaceholderData ? "opacity-60" : ""}`}>
        {q.data.rows.map((a) => {
          const verb = a.action.split(".")[1] ?? "";
          const { icon: Icon, tone } = ICON[verb] ?? { icon: ScrollText, tone: "bg-muted text-muted-foreground" };
          const details = detailsText(a);
          return (
            <li key={a.id} className="flex gap-3 rounded-2xl p-3 hover:bg-muted/40">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone}`} aria-hidden><Icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  {actionLabel(a.action)} <Target a={a} />
                </p>
                {details && <p className="break-words text-xs text-muted-foreground">{details}</p>}
                <p className="text-xs text-muted-foreground">{a.admin_email ?? "Unknown admin"} · <RelTime iso={a.created_at} /></p>
              </div>
            </li>
          );
        })}
      </ol>
      <Pager page={page} total={q.data.total} onPage={(p) => set({ page: p })} fetching={q.isFetching} />
    </div>
  );
}
