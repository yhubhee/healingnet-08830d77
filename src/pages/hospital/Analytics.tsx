import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { BarChart3, Users, TrendingUp, Activity } from "lucide-react";

const kpis = [
  { label: "Patient Volume", value: "1,247", change: "+12%", icon: Users, gradient: "gradient-primary" },
  { label: "Revenue (Month)", value: "₦12.8M", change: "+8%", icon: TrendingUp, gradient: "gradient-success" },
  { label: "Avg Wait Time", value: "22 min", change: "-15%", icon: Activity, gradient: "gradient-warning" },
  { label: "Bed Occupancy", value: "78%", change: "+3%", icon: BarChart3, gradient: "gradient-info" },
];

const departments = [
  { name: "General Practice", patients: 420, revenue: 3200000, pct: 85 },
  { name: "Cardiology", patients: 180, revenue: 2800000, pct: 72 },
  { name: "Pediatrics", patients: 210, revenue: 1500000, pct: 60 },
  { name: "Orthopedics", patients: 95, revenue: 2100000, pct: 45 },
];

export default function HospitalAnalytics() {
  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Analytics</h1>
        <p className="text-muted-foreground">Hospital performance metrics and operational insights</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className={cn("relative rounded-xl p-5 text-foreground overflow-hidden", k.gradient)}>
            <k.icon className="stat-card-icon" />
            <p className="text-sm opacity-80">{k.label}</p>
            <h3 className="text-2xl font-heading font-bold">{k.value}</h3>
            <p className="text-xs opacity-70 mt-1">{k.change}</p>
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-heading font-bold mb-4">Department Performance</h3>
        <div className="space-y-4">
          {departments.map((d) => (
            <div key={d.name}>
              <div className="flex justify-between text-sm mb-1">
                <span>{d.name}</span>
                <span className="font-heading font-bold">₦{(d.revenue / 1000000).toFixed(1)}M • {d.patients} patients</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full rounded-full gradient-info" style={{ width: `${d.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </HospitalLayout>
  );
}
