import { HospitalLayout } from "@/layouts/HospitalLayout";
import { Users, UserCheck, CreditCard, Video, Clock, Activity, ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { usePatientCheckins, useRealtimeCheckins, useHospitalDoctors, useHospitalBilling, useHospitalNotifications, useRealtimeNotifications, useHospitalId } from "@/hooks/useHospitalData";

const statusColors: Record<string, string> = {
  waiting: "bg-warning/15 text-warning",
  in_consultation: "bg-primary/15 text-primary",
  checked_in: "bg-success/15 text-success",
  completed: "bg-muted text-muted-foreground",
};

const priorityBorder: Record<string, string> = {
  normal: "border-l-primary",
  priority: "border-l-warning",
  emergency: "border-l-destructive",
};

const typeColors: Record<string, string> = {
  full_time: "bg-primary/15 text-primary",
  visiting_consultant: "bg-warning/15 text-warning",
  locum: "bg-purple-500/15 text-purple-400",
};

export default function HospitalDashboard() {
  useRealtimeCheckins();
  useRealtimeNotifications();

  const { data: checkins = [] } = usePatientCheckins();
  const { data: hospitalDoctors = [] } = useHospitalDoctors();
  const { data: billing = [] } = useHospitalBilling();
  const { data: notifications = [] } = useHospitalNotifications();

  const todayStr = new Date().toLocaleDateString("en-NG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const todayCheckins = checkins.filter((c: any) => new Date(c.checkin_time).toDateString() === new Date().toDateString());
  const activeDocCount = hospitalDoctors.filter((hd: any) => hd.doctors?.is_available).length;
  const todayBilling = billing.filter((b: any) => new Date(b.created_at).toDateString() === new Date().toDateString());
  const todayRevenue = todayBilling.reduce((sum: number, b: any) => sum + (b.payment_status === "paid" ? Number(b.total) : 0), 0);

  const stats = [
    { label: "Patients Today", value: String(todayCheckins.length), subtitle: "check-ins today", icon: Users, gradient: "gradient-primary", trend: "neutral" as const },
    { label: "Active Doctors", value: String(activeDocCount), subtitle: `${hospitalDoctors.length} total`, icon: UserCheck, gradient: "gradient-success", trend: "neutral" as const },
    { label: "Today's Revenue", value: `₦${(todayRevenue / 1000).toFixed(0)}K`, subtitle: `${todayBilling.length} transactions`, icon: CreditCard, gradient: "gradient-warning", trend: "up" as const },
    { label: "External Consults", value: "—", subtitle: "coming soon", icon: Video, gradient: "gradient-info", trend: "neutral" as const },
  ];

  const queueItems = todayCheckins.filter((c: any) => c.status !== "completed").slice(0, 5);
  const recentBills = todayBilling.slice(0, 4);
  const recentActivity = notifications.slice(0, 5);

  const doctors = hospitalDoctors.slice(0, 4).map((hd: any) => ({
    name: `Dr. ${hd.doctors?.first_name || ""} ${hd.doctors?.last_name || ""}`,
    specialty: hd.doctors?.specialty || "—",
    type: hd.employment_type,
    available: hd.doctors?.is_available ?? false,
  }));

  return (
    <HospitalLayout>
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground mb-1">Hospital Operations</h1>
        <p className="text-muted-foreground">Dashboard — Today: {todayStr}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className={cn("relative rounded-xl p-5 text-foreground overflow-hidden card-hover", stat.gradient)}>
            <stat.icon className="stat-card-icon" />
            <p className="text-sm opacity-80 mb-1">{stat.label}</p>
            <h3 className="text-2xl font-heading font-bold">{stat.value}</h3>
            <p className="text-xs opacity-70 mt-1 flex items-center gap-1">
              {stat.trend === "up" && <ArrowUpRight className="h-3 w-3" />}
              {stat.subtitle}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Queue */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-bold flex items-center gap-2"><Clock className="h-5 w-5 text-primary" />Patient Queue</h3>
              <a href="/hospital/queue" className="text-sm text-primary hover:underline">View all</a>
            </div>
            <div className="space-y-2">
              {queueItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No patients in queue today</p>
              ) : queueItems.map((item: any, i: number) => (
                <div key={item.id} className={cn("flex items-center gap-4 p-3 rounded-lg bg-background border-l-4 transition-colors hover:bg-sidebar-accent", priorityBorder[item.priority || "normal"])}>
                  <span className="font-heading font-bold text-muted-foreground min-w-[2rem]">{item.queue_number || i + 1}</span>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">{item.patients?.first_name} {item.patients?.last_name}</h4>
                    <p className="text-xs text-muted-foreground">{item.department || "—"} • {item.checkin_time ? new Date(item.checkin_time).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
                  </div>
                  <span className={cn("text-xs font-semibold px-3 py-1 rounded-full", statusColors[item.status] || "bg-muted text-muted-foreground")}>
                    {item.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Billing */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-bold flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Recent Billing</h3>
              <a href="/hospital/billing" className="text-sm text-primary hover:underline">View all</a>
            </div>
            <div className="space-y-2">
              {recentBills.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No billing today</p>
              ) : recentBills.map((bill: any) => (
                <div key={bill.id} className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-sidebar-accent transition-colors">
                  <div>
                    <h4 className="text-sm font-medium">{bill.patients?.first_name} {bill.patients?.last_name}</h4>
                    <p className="text-xs text-muted-foreground">{bill.billing_type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-heading font-bold">₦{Number(bill.total).toLocaleString()}</span>
                    <span className={cn("text-xs font-semibold px-3 py-1 rounded-full", bill.payment_status === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{bill.payment_status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Doctors */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-bold flex items-center gap-2"><UserCheck className="h-5 w-5 text-primary" />Doctor Overview</h3>
              <a href="/hospital/doctors" className="text-sm text-primary hover:underline">View all</a>
            </div>
            <div className="space-y-2">
              {doctors.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No doctors assigned</p>
              ) : doctors.map((doc: any, i: number) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-background hover:bg-sidebar-accent transition-colors">
                  <div className="w-10 h-10 rounded-full gradient-info flex items-center justify-center text-sm font-bold text-foreground">
                    {doc.name.split(" ").slice(1).map((n: string) => n[0]).join("")}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">{doc.name}</h4>
                    <p className="text-xs text-muted-foreground">{doc.specialty}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider", typeColors[doc.type] || "bg-muted text-muted-foreground")}>
                      {doc.type === "full_time" ? "FT" : doc.type === "visiting_consultant" ? "VC" : "LC"}
                    </span>
                    <span className={cn("w-2.5 h-2.5 rounded-full", doc.available ? "bg-success shadow-[0_0_6px] shadow-success" : "bg-muted-foreground")} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-heading font-bold flex items-center gap-2 mb-4"><Activity className="h-5 w-5 text-primary" />Recent Activity</h3>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              ) : recentActivity.map((act: any) => (
                <div key={act.id} className="flex gap-3">
                  <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", act.is_read ? "bg-muted-foreground" : "bg-primary")} />
                  <div>
                    <p className="text-sm">{act.title}</p>
                    <p className="text-xs text-muted-foreground">{act.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </HospitalLayout>
  );
}
