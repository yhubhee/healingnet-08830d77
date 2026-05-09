import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { BarChart3, Users, TrendingUp, Activity } from "lucide-react";
import { usePatientCheckins, useHospitalBilling, useHospitalBeds } from "@/hooks/useHospitalData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--muted-foreground))"];

function last30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

export default function HospitalAnalytics() {
  const { data: checkins = [] } = usePatientCheckins();
  const { data: billing = [] } = useHospitalBilling();
  const { data: beds = [] } = useHospitalBeds();

  const { data: emr = [] } = useQuery({
    queryKey: ["emr-diagnoses"],
    queryFn: async () => {
      const { data } = await supabase.from("emr_entries").select("title, entry_type").eq("entry_type", "diagnosis").limit(500);
      return data || [];
    },
  });

  const totalPatients = checkins.length;
  const totalRevenue = billing.reduce((s: number, b: any) => s + Number(b.total), 0);
  const avgWait = checkins.length > 0 ? Math.round(checkins.reduce((s: number, c: any) => {
    if (!c.checkin_time || !c.consultation_start) return s;
    return s + (new Date(c.consultation_start).getTime() - new Date(c.checkin_time).getTime()) / 60000;
  }, 0) / checkins.length) : 0;
  const occupancy = beds.length > 0 ? Math.round((beds.filter((b: any) => b.status === "occupied").length / beds.length) * 100) : 0;

  const kpis = [
    { label: "Patient Volume", value: totalPatients.toLocaleString(), icon: Users, gradient: "gradient-primary" },
    { label: "Revenue", value: `₦${(totalRevenue / 1000000).toFixed(1)}M`, icon: TrendingUp, gradient: "gradient-success" },
    { label: "Avg Wait Time", value: `${avgWait} min`, icon: Activity, gradient: "gradient-warning" },
    { label: "Bed Occupancy", value: `${occupancy}%`, icon: BarChart3, gradient: "gradient-info" },
  ];

  // Patient flow last 30d
  const days = last30Days();
  const flowData = days.map((d) => ({
    date: d.slice(5),
    patients: checkins.filter((c: any) => (c.checkin_time || "").slice(0, 10) === d).length,
  }));

  // Revenue trend last 30d (paid vs pending)
  const revenueData = days.map((d) => {
    const paid = billing.filter((b: any) => (b.created_at || "").slice(0, 10) === d && b.payment_status === "paid")
      .reduce((s: number, b: any) => s + Number(b.total), 0);
    const pending = billing.filter((b: any) => (b.created_at || "").slice(0, 10) === d && b.payment_status !== "paid")
      .reduce((s: number, b: any) => s + Number(b.total), 0);
    return { date: d.slice(5), Paid: paid, Pending: pending };
  });

  // Top diagnoses
  const diagMap: Record<string, number> = {};
  emr.forEach((e: any) => { const t = e.title || "Unknown"; diagMap[t] = (diagMap[t] || 0) + 1; });
  const topDiagnoses = Object.entries(diagMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }));

  // Department mix
  const deptMap: Record<string, number> = {};
  checkins.forEach((c: any) => { const d = c.department || "Unknown"; deptMap[d] = (deptMap[d] || 0) + 1; });
  const deptData = Object.entries(deptMap).map(([name, value]) => ({ name, value }));

  // Bed status distribution
  const bedMap: Record<string, number> = {};
  beds.forEach((b: any) => { bedMap[b.status] = (bedMap[b.status] || 0) + 1; });
  const bedData = Object.entries(bedMap).map(([name, value]) => ({ name, value }));

  const chartCard = "bg-card border border-border rounded-xl p-5";

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <div className={chartCard}>
          <h3 className="font-heading font-bold mb-3">Patient Flow (last 30 days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={flowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Line type="monotone" dataKey="patients" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className={chartCard}>
          <h3 className="font-heading font-bold mb-3">Revenue Trend (last 30 days)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Paid" stackId="1" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.3)" />
              <Area type="monotone" dataKey="Pending" stackId="1" stroke="hsl(var(--warning))" fill="hsl(var(--warning) / 0.3)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className={chartCard}>
          <h3 className="font-heading font-bold mb-3">Top Diagnoses</h3>
          {topDiagnoses.length === 0 ? <p className="text-sm text-muted-foreground p-6 text-center">No diagnosis data yet</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={topDiagnoses} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className={chartCard}>
          <h3 className="font-heading font-bold mb-3">Department Mix</h3>
          {deptData.length === 0 ? <p className="text-sm text-muted-foreground p-6 text-center">No data yet</p> : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={deptData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e: any) => e.name}>
                  {deptData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className={chartCard}>
        <h3 className="font-heading font-bold mb-3">Bed Status Distribution</h3>
        {bedData.length === 0 ? <p className="text-sm text-muted-foreground p-6 text-center">No bed data yet</p> : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={bedData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="value" fill="hsl(var(--info))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </HospitalLayout>
  );
}
