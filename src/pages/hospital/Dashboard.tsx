import { HospitalLayout } from "@/layouts/HospitalLayout";
import { Users, UserCheck, CreditCard, Video, Clock, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

const stats = [
  { label: "Patients Today", value: "47", subtitle: "+12% from yesterday", icon: Users, gradient: "gradient-primary", trend: "up" },
  { label: "Active Doctors", value: "8", subtitle: "2 on leave", icon: UserCheck, gradient: "gradient-success", trend: "neutral" },
  { label: "Today's Revenue", value: "₦2.4M", subtitle: "+8% from yesterday", icon: CreditCard, gradient: "gradient-warning", trend: "up" },
  { label: "External Consults", value: "3", subtitle: "1 pending", icon: Video, gradient: "gradient-info", trend: "neutral" },
];

const queueItems = [
  { number: 1, name: "Amara Obi", department: "General Practice", status: "in_consultation", priority: "normal", time: "9:15 AM" },
  { number: 2, name: "Chidi Nwosu", department: "Cardiology", status: "waiting", priority: "priority", time: "9:30 AM" },
  { number: 3, name: "Fatima Bello", department: "Pediatrics", status: "waiting", priority: "emergency", time: "9:45 AM" },
  { number: 4, name: "Emeka Eze", department: "Orthopedics", status: "checked_in", priority: "normal", time: "10:00 AM" },
  { number: 5, name: "Ngozi Adamu", department: "Dermatology", status: "checked_in", priority: "normal", time: "10:15 AM" },
];

const doctors = [
  { name: "Dr. Chidi Adebayo", specialty: "General Practice", type: "full_time", available: true },
  { name: "Dr. Ngozi Okonkwo", specialty: "Cardiologist", type: "full_time", available: true },
  { name: "Dr. Emeka Nnamdi", specialty: "Orthopedics", type: "visiting_consultant", available: false },
  { name: "Dr. Aisha Mohammed", specialty: "Pediatrics", type: "full_time", available: true },
];

const recentBilling = [
  { patient: "Amara Obi", type: "Consultation", amount: 15000, status: "paid" },
  { patient: "Chidi Nwosu", type: "Lab Test", amount: 8500, status: "pending" },
  { patient: "Fatima Bello", type: "Pharmacy", amount: 22000, status: "paid" },
  { patient: "Emeka Eze", type: "Procedure", amount: 45000, status: "pending" },
];

const activities = [
  { text: "New patient Ngozi Adamu checked in", time: "2 min ago", type: "checkin" },
  { text: "Lab results ready for Patient #1024", time: "15 min ago", type: "lab" },
  { text: "Dr. Adebayo completed consultation", time: "30 min ago", type: "consultation" },
  { text: "Payment received: ₦15,000 from Amara Obi", time: "45 min ago", type: "billing" },
  { text: "Surgery scheduled for tomorrow 8:00 AM", time: "1h ago", type: "surgery" },
];

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
  const todayStr = new Date().toLocaleDateString("en-NG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <HospitalLayout>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-heading font-bold text-foreground mb-1">
          Hospital Operations
        </h1>
        <p className="text-muted-foreground">Dashboard — Today: {todayStr}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={cn("relative rounded-xl p-5 text-foreground overflow-hidden card-hover", stat.gradient)}
          >
            <stat.icon className="stat-card-icon" />
            <p className="text-sm opacity-80 mb-1">{stat.label}</p>
            <h3 className="text-2xl font-heading font-bold">{stat.value}</h3>
            <p className="text-xs opacity-70 mt-1 flex items-center gap-1">
              {stat.trend === "up" && <ArrowUpRight className="h-3 w-3" />}
              {stat.trend === "down" && <ArrowDownRight className="h-3 w-3" />}
              {stat.subtitle}
            </p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="xl:col-span-2 space-y-6">
          {/* Queue */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Patient Queue
              </h3>
              <a href="/hospital/queue" className="text-sm text-primary hover:underline">View all</a>
            </div>
            <div className="space-y-2">
              {queueItems.map((item) => (
                <div
                  key={item.number}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-lg bg-background border-l-4 transition-colors hover:bg-sidebar-accent",
                    priorityBorder[item.priority]
                  )}
                >
                  <span className="font-heading font-bold text-muted-foreground min-w-[2rem]">
                    {item.number}
                  </span>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">{item.name}</h4>
                    <p className="text-xs text-muted-foreground">{item.department} • {item.time}</p>
                  </div>
                  <span className={cn("text-xs font-semibold px-3 py-1 rounded-full", statusColors[item.status])}>
                    {item.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Billing */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-bold flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Recent Billing
              </h3>
              <a href="/hospital/billing" className="text-sm text-primary hover:underline">View all</a>
            </div>
            <div className="space-y-2">
              {recentBilling.map((bill, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background hover:bg-sidebar-accent transition-colors">
                  <div>
                    <h4 className="text-sm font-medium">{bill.patient}</h4>
                    <p className="text-xs text-muted-foreground">{bill.type}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-heading font-bold">₦{bill.amount.toLocaleString()}</span>
                    <span className={cn(
                      "text-xs font-semibold px-3 py-1 rounded-full",
                      bill.status === "paid" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                    )}>
                      {bill.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Doctors */}
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-bold flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-primary" />
                Doctor Overview
              </h3>
              <a href="/hospital/doctors" className="text-sm text-primary hover:underline">View all</a>
            </div>
            <div className="space-y-2">
              {doctors.map((doc, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-background hover:bg-sidebar-accent transition-colors">
                  <div className="w-10 h-10 rounded-full gradient-info flex items-center justify-center text-sm font-bold text-foreground">
                    {doc.name.split(" ").slice(1).map((n) => n[0]).join("")}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium">{doc.name}</h4>
                    <p className="text-xs text-muted-foreground">{doc.specialty}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider", typeColors[doc.type])}>
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
            <h3 className="text-lg font-heading font-bold flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-primary" />
              Recent Activity
            </h3>
            <div className="space-y-3">
              {activities.map((act, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                  <div>
                    <p className="text-sm">{act.text}</p>
                    <p className="text-xs text-muted-foreground">{act.time}</p>
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
