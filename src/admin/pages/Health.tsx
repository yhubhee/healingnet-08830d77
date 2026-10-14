// /admin/health: admin_system_health(), refreshed every minute.
import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  AlertTriangle, BadgeAlert, CalendarClock, CheckCircle2, CreditCard, Database, ExternalLink, KeyRound, PhoneOff,
  UserPlus, XCircle,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { useHealth } from "../api";
import { fmtNum } from "../format";
import { ErrorState, Section } from "../components/bits";
import { C } from "../components/charts";

/** Database size limit on the Supabase free plan. Change here if the plan changes. */
export const DB_LIMIT_MB = 500;
const SUPABASE_DASHBOARD = "https://supabase.com/dashboard/project/prougveoeumxvyallkcm";

type Level = "ok" | "warn" | "bad";
const LEVEL: Record<Level, { box: string; icon: ComponentType<{ className?: string }>; text: string; label: string }> = {
  ok: { box: "border-success/30", icon: CheckCircle2, text: "text-success", label: "OK" },
  warn: { box: "border-warning/40 bg-warning/5", icon: AlertTriangle, text: "text-warning", label: "Check" },
  bad: { box: "border-destructive/40 bg-destructive/5", icon: XCircle, text: "text-destructive", label: "Action needed" },
};

function Tile({ label, value, level, icon: Icon, hint, to }: { label: string; value: number; level: Level; icon: ComponentType<{ className?: string }>; hint: string; to?: string }) {
  const l = LEVEL[level];
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
        <span className={cn("inline-flex items-center gap-1 text-xs font-medium", l.text)}><l.icon className="h-3.5 w-3.5" aria-hidden />{l.label}</span>
      </div>
      <p className="mt-3 text-3xl font-bold tabular-nums">{fmtNum(value)}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </>
  );
  const cls = cn("block rounded-2xl border bg-card p-4", l.box);
  return to ? <Link to={to} className={cn(cls, "transition-colors hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}>{body}</Link> : <div className={cls}>{body}</div>;
}

const lvl = (n: number, warnAbove = 0, badAbove = Infinity): Level => (n > badAbove ? "bad" : n > warnAbove ? "warn" : "ok");

export default function Health() {
  const q = useHealth();
  const h = q.data;

  if (q.isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading system health">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (q.isError || !h) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;

  const usage = Object.entries(h.function_usage_24h ?? {}).map(([fn, n]) => ({ fn, calls: Number(n) })).sort((a, b) => b.calls - a.calls);
  const usageConfig = { calls: { label: "Calls", color: C.c1 } } satisfies ChartConfig;
  const pct = Math.min(100, Math.round((h.database_size_mb / DB_LIMIT_MB) * 100));
  const dbLevel: Level = pct >= 90 ? "bad" : pct >= 70 ? "warn" : "ok";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 lg:grid-cols-4">
        <Tile label="Payments pending over 1 h" value={h.payments_pending_over_1h} level={h.payments_pending_over_1h > 0 ? "bad" : "ok"} icon={CreditCard}
          hint="Webhook may have missed them" to="/admin/payments?status=pending" />
        <Tile label="Failed payments (24 h)" value={h.payments_failed_24h} level={lvl(h.payments_failed_24h, 0, 10)} icon={XCircle}
          hint="Failed or abandoned checkouts" to="/admin/payments?status=failed" />
        <Tile label="Calls open over 4 h" value={h.calls_open_over_4h} level={lvl(h.calls_open_over_4h, 0, 5)} icon={PhoneOff} hint="Calls never ended" />
        <Tile label="Share-code failures (24 h)" value={h.share_code_failures_24h} level={lvl(h.share_code_failures_24h, 20, 100)} icon={KeyRound}
          hint="Amber above 20: possible guessing" />
        <Tile label="Doctor licences expired" value={h.doctor_licences_expired} level={h.doctor_licences_expired > 0 ? "bad" : "ok"} icon={BadgeAlert}
          hint="Approved doctors past expiry" to="/admin/doctors?status=approved" />
        <Tile label="Licences expiring (30 d)" value={h.doctor_licences_expiring_30d} level={lvl(h.doctor_licences_expiring_30d)} icon={CalendarClock}
          hint="Approved doctors" to="/admin/doctors?status=approved" />
        <Tile label="Plans expiring (7 d)" value={h.plans_expiring_7d} level={lvl(h.plans_expiring_7d)} icon={CalendarClock} hint="Paid hospital plans" />
        <Tile label="Pending staff invites" value={h.staff_invites_pending} level={lvl(h.staff_invites_pending, 50)} icon={UserPlus} hint="Not yet accepted, not expired" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Edge functions (24 h)" className="lg:col-span-2">
          {usage.length === 0 ? <p className="text-sm text-muted-foreground">No function calls recorded in the last 24 hours.</p> : (
            <figure>
              <ChartContainer config={usageConfig} className="w-full" style={{ height: Math.max(160, usage.length * 32) }}
                role="img" aria-label={`Edge function calls in the last 24 hours: ${usage.map((u) => `${u.fn} ${u.calls}`).join(", ")}.`}>
                <BarChart data={usage} layout="vertical" margin={{ left: 0, right: 16 }} accessibilityLayer>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} className="text-[11px] tabular-nums" />
                  <YAxis type="category" dataKey="fn" width={150} tickLine={false} axisLine={false} className="text-[11px]" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="calls" fill="var(--color-calls)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </figure>
          )}
        </Section>

        <Section title="Database">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-muted-foreground" aria-hidden />
            <p className="text-2xl font-bold tabular-nums">{h.database_size_mb} MB</p>
            <span className={cn("ml-auto inline-flex items-center gap-1 text-xs font-medium", LEVEL[dbLevel].text)}>
              {(() => { const I = LEVEL[dbLevel].icon; return <I className="h-3.5 w-3.5" aria-hidden />; })()}{pct}% used
            </span>
          </div>
          <Progress value={pct} className="mt-3 h-2" aria-label={`Database ${pct}% of the ${DB_LIMIT_MB} MB plan limit`} />
          <p className="mt-2 text-xs text-muted-foreground tabular-nums">of {DB_LIMIT_MB} MB (free plan limit)</p>
          <a href={SUPABASE_DASHBOARD} target="_blank" rel="noopener noreferrer" className="mt-6 inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline">
            Supabase dashboard (logs, function errors)<ExternalLink className="h-3.5 w-3.5" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
          </a>
        </Section>
      </div>
    </div>
  );
}
