import { LayoutDashboard, Users, FileText, FlaskConical, Pill, Receipt, BedDouble } from "lucide-react";

// A static, simplified picture of the hospital dashboard, built in HTML. Every name
// and value is made up and the panel says so. It does not import any real dashboard code.
const NAV = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: Users, label: "Queue", active: true },
  { icon: FileText, label: "EMR" },
  { icon: FlaskConical, label: "Lab" },
  { icon: Pill, label: "Pharmacy" },
  { icon: Receipt, label: "Billing" },
  { icon: BedDouble, label: "Beds" },
];

const QUEUE = [
  { name: "Adaeze O.", reason: "Follow-up visit", status: "With doctor", tone: "bg-primary/15 text-primary" },
  { name: "Tunde B.", reason: "Lab results review", status: "Waiting", tone: "bg-muted text-muted-foreground" },
  { name: "Halima S.", reason: "Antenatal check", status: "Checked in", tone: "bg-[hsl(var(--brand-cyan)/0.15)] text-foreground" },
  { name: "Chinedu E.", reason: "New patient", status: "Waiting", tone: "bg-muted text-muted-foreground" },
];

export function DashboardMock() {
  return (
    <figure className="relative" aria-label="Simplified example of the HealingNet hospital dashboard, with sample data">
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-[hsl(192_45%_12%/0.08)]" aria-hidden>
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/60 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="h-2.5 w-2.5 rounded-full bg-border" />
          <span className="ml-3 text-xs font-semibold text-muted-foreground">Your hospital · Patient queue</span>
        </div>
        <div className="grid grid-cols-[auto_1fr]">
          <ul className="hidden space-y-1 border-r border-border p-3 sm:block">
            {NAV.map((n) => (
              <li key={n.label} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${n.active ? "bg-primary/10 font-semibold text-primary" : "text-muted-foreground"}`}>
                <n.icon className="h-4 w-4" />
                {n.label}
              </li>
            ))}
          </ul>
          <div className="p-4 md:p-5">
            <div className="mb-4 grid grid-cols-3 gap-2">
              {["Waiting", "With doctor", "Done today"].map((t) => (
                <div key={t} className="rounded-2xl border border-border p-3">
                  <div className="text-[0.7rem] text-muted-foreground">{t}</div>
                  <div className="mt-1 h-2 w-10 rounded-full bg-primary/25" />
                </div>
              ))}
            </div>
            <ul className="divide-y divide-border rounded-2xl border border-border">
              {QUEUE.map((q, i) => (
                <li key={q.name} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{q.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{q.reason}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${q.tone}`}>{q.status}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <figcaption className="absolute -top-3 right-4 rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">Sample data</figcaption>
    </figure>
  );
}
