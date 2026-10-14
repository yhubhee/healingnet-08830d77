// /admin/activity: every admin_timeseries metric, with previous-period comparison and CSV export.
import { C, ChartCard, RangeSelect, type SeriesSpec, useRange } from "../components/charts";

const GROUPS: { title: string; charts: { title: string; kind: "area" | "bar" | "line"; money?: boolean; series: SeriesSpec[] }[] }[] = [
  {
    title: "Clinical",
    charts: [
      { title: "Check-ins", kind: "area", series: [{ key: "checkins", label: "Check-ins", color: C.c1 }] },
      { title: "Appointments", kind: "area", series: [{ key: "appointments", label: "Appointments", color: C.c1 }] },
      { title: "Consultations", kind: "area", series: [{ key: "consultations", label: "Consultations", color: C.c1 }] },
      { title: "Consult requests", kind: "area", series: [{ key: "consult_requests", label: "Consult requests", color: C.c1 }] },
      { title: "Video calls", kind: "area", series: [{ key: "calls", label: "Calls", color: C.c1 }] },
    ],
  },
  {
    title: "Triage",
    charts: [
      { title: "Triage sessions", kind: "area", series: [{ key: "triage", label: "Triage", color: C.c1 }] },
      { title: "Emergency triage", kind: "bar", series: [{ key: "triage_emergency", label: "Emergency", color: C.bad }] },
    ],
  },
  {
    title: "Signups",
    charts: [
      { title: "Hospital signups", kind: "bar", series: [{ key: "signups_hospitals", label: "Hospitals", color: C.c1 }] },
      { title: "Doctor signups", kind: "bar", series: [{ key: "signups_doctors", label: "Doctors", color: C.c1 }] },
      { title: "Patient signups", kind: "bar", series: [{ key: "signups_patients", label: "Patients", color: C.c1 }] },
    ],
  },
  {
    title: "Money",
    charts: [
      { title: "Revenue", kind: "bar", money: true, series: [{ key: "revenue_naira", label: "Revenue", color: C.c1 }] },
      { title: "Failed payments", kind: "bar", series: [{ key: "payments_failed", label: "Failed payments", color: C.bad }] },
    ],
  },
];

export default function Activity() {
  const { days, setDays } = useRange();
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {days * 2 <= 365 ? `Each chart compares the last ${days} days with the ${days} days before.` : "Showing the last year (no comparison period)."}
        </p>
        <RangeSelect days={days} onChange={setDays} />
      </div>
      {GROUPS.map((g) => (
        <section key={g.title} aria-labelledby={`grp-${g.title}`}>
          <h2 id={`grp-${g.title}`} className="mb-3 font-heading text-lg font-bold">{g.title}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {g.charts.map((c) => (
              <ChartCard key={c.title} title={c.title} kind={c.kind} money={c.money} series={c.series} days={days} height={260} csv />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
