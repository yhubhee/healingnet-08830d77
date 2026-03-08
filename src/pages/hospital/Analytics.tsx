import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { BarChart3, Users, TrendingUp, Activity } from "lucide-react";
import { usePatientCheckins, useHospitalBilling, useHospitalBeds } from "@/hooks/useHospitalData";

export default function HospitalAnalytics() {
  const { data: checkins = [] } = usePatientCheckins();
  const { data: billing = [] } = useHospitalBilling();
  const { data: beds = [] } = useHospitalBeds();

  const totalPatients = checkins.length;
  const totalRevenue = billing.reduce((s: number, b: any) => s + Number(b.total), 0);
  const avgWait = checkins.length > 0 ? Math.round(checkins.reduce((s: number, c: any) => {
    if (!c.checkin_time || !c.consultation_start) return s;
    return s + (new Date(c.consultation_start).getTime() - new Date(c.checkin_time).getTime()) / 60000;
  }, 0) / checkins.length) : 0;
  const occupancy = beds.length > 0 ? Math.round((beds.filter((b: any) => b.status === "occupied").length / beds.length) * 100) : 0;

  const kpis = [
    { label: "Patient Volume", value: totalPatients.toLocaleString(), change: "", icon: Users, gradient: "gradient-primary" },
    { label: "Revenue", value: `₦${(totalRevenue / 1000000).toFixed(1)}M`, change: "", icon: TrendingUp, gradient: "gradient-success" },
    { label: "Avg Wait Time", value: `${avgWait} min`, change: "", icon: Activity, gradient: "gradient-warning" },
    { label: "Bed Occupancy", value: `${occupancy}%`, change: "", icon: BarChart3, gradient: "gradient-info" },
  ];

  // Group by department
  const deptMap: Record<string, { patients: number; revenue: number }> = {};
  checkins.forEach((c: any) => {
    const dept = c.department || "Unknown";
    if (!deptMap[dept]) deptMap[dept] = { patients: 0, revenue: 0 };
    deptMap[dept].patients++;
  });
  billing.forEach((b: any) => {
    const dept = b.billing_type || "Unknown";
    if (!deptMap[dept]) deptMap[dept] = { patients: 0, revenue: 0 };
    deptMap[dept].revenue += Number(b.total);
  });
  const departments = Object.entries(deptMap).map(([name, d]) => ({ name, ...d, pct: totalPatients > 0 ? Math.round((d.patients / totalPatients) * 100) : 0 })).sort((a, b) => b.patients - a.patients).slice(0, 6);

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
          </div>
        ))}
      </div>
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-lg font-heading font-bold mb-4">Department Performance</h3>
        <div className="space-y-4">
          {departments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet</p>
          ) : departments.map((d) => (
            <div key={d.name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="capitalize">{d.name}</span>
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
