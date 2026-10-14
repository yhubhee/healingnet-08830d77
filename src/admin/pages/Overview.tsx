// /admin: headline numbers from admin_overview() plus trend charts from admin_timeseries().
import type { ComponentType, ReactNode } from "react";
import { Link } from "react-router-dom";
import { Cell, Pie, PieChart } from "recharts";
import {
  AlertTriangle, ArrowRight, Banknote, CalendarClock, ClipboardCheck, CreditCard, Hospital, Mail, PhoneCall,
  ShieldCheck, Siren, Stethoscope, TrendingUp, Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { useOverview, type Overview as OverviewData } from "../api";
import { fmtNum, koboToNaira, times } from "../format";
import { ErrorState, Money, Section } from "../components/bits";
import { C, ChartCard, RangeSelect, useRange } from "../components/charts";

function Kpi({ label, icon: Icon, value, sub }: { label: string; icon: ComponentType<{ className?: string }>; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted-foreground tabular-nums">{sub}</p>}
    </div>
  );
}

function Attention({ o }: { o: OverviewData }) {
  const items = [
    { n: o.inbox.verifications_pending, label: "pending verifications", to: "/admin/verifications", icon: ShieldCheck },
    { n: o.inbox.refunds_needed, label: "refunds needed", to: "/admin/payments?tab=refunds", icon: AlertTriangle },
    { n: o.inbox.contact_unhandled, label: "unhandled messages", to: "/admin/messages", icon: Mail },
    { n: o.hospitals.trials_ending_7d, label: "trials ending in 7 days", to: "/admin/hospitals?plan=trialing", icon: CalendarClock },
    { n: o.payments.stuck_pending, label: "stuck pending payments", to: "/admin/payments?status=pending", icon: CreditCard },
  ].filter((i) => i.n > 0);
  if (items.length === 0) return null;
  return (
    <section aria-label="Needs attention" className="rounded-2xl border border-warning/40 bg-warning/5 p-3">
      <h2 className="sr-only">Needs attention</h2>
      <ul className="flex flex-wrap gap-2">
        {items.map((i) => (
          <li key={i.label}>
            <Link to={i.to} className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-card px-3 py-1.5 text-sm transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <i.icon className="h-4 w-4 text-warning" aria-hidden />
              <span className="font-bold tabular-nums">{fmtNum(i.n)}</span> {i.label}
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlanMix({ o }: { o: OverviewData }) {
  const h = o.hospitals;
  const none = Math.max(0, h.total - h.paid_telemedicine - h.paid_emr - h.trialing - h.lapsed);
  const slices = [
    { key: "tele", label: "Paid telemedicine", value: h.paid_telemedicine, color: C.c1 },
    { key: "emr", label: "Paid EMR", value: h.paid_emr, color: C.c3 },
    { key: "trial", label: "Trialing", value: h.trialing, color: C.c4 },
    { key: "lapsed", label: "Lapsed", value: h.lapsed, color: C.c2 },
    { key: "none", label: "No plan", value: none, color: "hsl(var(--muted-foreground))" },
  ];
  const config = Object.fromEntries(slices.map((s) => [s.key, { label: s.label, color: s.color }])) as ChartConfig;
  const summary = slices.map((s) => `${s.label} ${s.value}`).join(", ");
  return (
    <Section title="Plan mix">
      {h.total === 0 ? <p className="text-sm text-muted-foreground">No hospitals yet.</p> : (
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <ChartContainer config={config} className="aspect-square h-44 shrink-0" role="img" aria-label={`Plan mix of ${h.total} hospitals: ${summary}.`}>
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent nameKey="key" hideLabel />} />
              <Pie data={slices.filter((s) => s.value > 0)} dataKey="value" nameKey="key" innerRadius="60%" outerRadius="95%" paddingAngle={2} stroke="hsl(var(--card))" strokeWidth={2}>
                {slices.filter((s) => s.value > 0).map((s) => <Cell key={s.key} fill={s.color} />)}
              </Pie>
            </PieChart>
          </ChartContainer>
          <ul className="w-full space-y-1.5 text-sm">
            {slices.map((s) => (
              <li key={s.key} className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden />
                <span className="flex-1">{s.label}</span>
                <span className="font-medium tabular-nums">{fmtNum(s.value)}</span>
                <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{Math.round((s.value / h.total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true" aria-label="Loading numbers">
      {times(8).map((i) => <Skeleton key={i} className="h-[108px] rounded-2xl" />)}
    </div>
  );
}

export default function Overview() {
  const q = useOverview();
  const { days, setDays } = useRange();
  const o = q.data;

  return (
    <div className="space-y-6">
      {o && <Attention o={o} />}

      {q.isLoading ? <KpiSkeleton /> : q.isError || !o ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="MRR" icon={TrendingUp} value={<Money value={koboToNaira(o.mrr_kobo)} compact />} sub="Paid plans at today's prices" />
          <Kpi label="Revenue (30 days)" icon={Banknote} value={<Money value={koboToNaira(o.payments.revenue_30d_kobo)} compact />}
            sub={<>{fmtNum(o.payments.success_30d)} paid · {fmtNum(o.payments.failed_30d)} failed</>} />
          <Kpi label="Hospitals" icon={Hospital} value={fmtNum(o.hospitals.total)}
            sub={<>{fmtNum(o.hospitals.paid_emr + o.hospitals.paid_telemedicine)} paid · {fmtNum(o.hospitals.trialing)} trial · {fmtNum(o.hospitals.lapsed)} lapsed</>} />
          <Kpi label="Doctors" icon={Stethoscope} value={fmtNum(o.doctors.total)}
            sub={<>{fmtNum(o.doctors.approved)} approved · {fmtNum(o.doctors.pending)} pending</>} />
          <Kpi label="Patients" icon={Users} value={fmtNum(o.patients.total)} sub={<>+{fmtNum(o.patients.new_30d)} in 30 days</>} />
          <Kpi label="Live calls now" icon={PhoneCall} value={fmtNum(o.activity.live_calls)} sub={<>{fmtNum(o.activity.calls_7d)} calls in 7 days</>} />
          <Kpi label="Check-ins (7 days)" icon={ClipboardCheck} value={fmtNum(o.activity.checkins_7d)}
            sub={<>{fmtNum(o.activity.appointments_7d)} appointments</>} />
          <Kpi label="Triage (7 days)" icon={Siren} value={fmtNum(o.activity.triage_7d)}
            sub={<span className={o.activity.triage_emergency_7d > 0 ? "font-medium text-destructive" : undefined}>{fmtNum(o.activity.triage_emergency_7d)} emergency</span>} />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-bold">Trends</h2>
        <RangeSelect days={days} onChange={setDays} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Signups" kind="area" stacked live days={days} series={[
          { key: "signups_hospitals", label: "Hospitals", color: C.c1 },
          { key: "signups_doctors", label: "Doctors", color: C.c2 },
          { key: "signups_patients", label: "Patients", color: C.c3 },
        ]} />
        <ChartCard title="Revenue" kind="bar" money live days={days} series={[{ key: "revenue_naira", label: "Revenue", color: C.c1 }]} />
        <ChartCard title="Clinical activity" kind="line" live days={days} series={[
          { key: "checkins", label: "Check-ins", color: C.c1 },
          { key: "appointments", label: "Appointments", color: C.c2 },
          { key: "consultations", label: "Consultations", color: C.c3 },
          { key: "calls", label: "Calls", color: C.c4 },
        ]} />
        <ChartCard title="Triage" kind="line" live days={days} series={[
          { key: "triage", label: "All triage", color: C.c1 },
          { key: "triage_emergency", label: "Emergency", color: C.bad },
        ]} />
      </div>

      {o && <PlanMix o={o} />}
    </div>
  );
}
