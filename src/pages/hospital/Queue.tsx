import { HospitalLayout } from "@/layouts/HospitalLayout";
import { useState } from "react";
import { Clock, Users, Stethoscope, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const filters = ["All", "Waiting", "In Consultation", "Checked In", "Completed"];

const mockQueue = [
  { id: 1, number: 1, name: "Amara Obi", age: 34, gender: "F", department: "General Practice", doctor: "Dr. Adebayo", status: "in_consultation", priority: "normal", type: "pre_booked", time: "9:15 AM", waitTime: "25 min" },
  { id: 2, number: 2, name: "Chidi Nwosu", age: 56, gender: "M", department: "Cardiology", doctor: "Dr. Okonkwo", status: "waiting", priority: "priority", type: "pre_booked", time: "9:30 AM", waitTime: "40 min" },
  { id: 3, number: 3, name: "Fatima Bello", age: 8, gender: "F", department: "Pediatrics", doctor: "Dr. Mohammed", status: "waiting", priority: "emergency", type: "walk_in", time: "9:45 AM", waitTime: "15 min" },
  { id: 4, number: 4, name: "Emeka Eze", age: 42, gender: "M", department: "Orthopedics", doctor: "Dr. Nnamdi", status: "checked_in", priority: "normal", type: "walk_in", time: "10:00 AM", waitTime: "5 min" },
  { id: 5, number: 5, name: "Ngozi Adamu", age: 29, gender: "F", department: "Dermatology", doctor: "—", status: "checked_in", priority: "normal", type: "walk_in", time: "10:15 AM", waitTime: "2 min" },
  { id: 6, number: 6, name: "Ibrahim Musa", age: 65, gender: "M", department: "Internal Medicine", doctor: "Dr. Adebayo", status: "completed", priority: "normal", type: "pre_booked", time: "8:30 AM", waitTime: "—" },
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

export default function HospitalQueue() {
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = activeFilter === "All"
    ? mockQueue
    : mockQueue.filter((q) => q.status === activeFilter.toLowerCase().replace(/ /g, "_"));

  const stats = [
    { label: "In Queue", value: mockQueue.filter((q) => q.status !== "completed").length, icon: Users, gradient: "gradient-primary" },
    { label: "Waiting", value: mockQueue.filter((q) => q.status === "waiting").length, icon: Clock, gradient: "gradient-warning" },
    { label: "In Consultation", value: mockQueue.filter((q) => q.status === "in_consultation").length, icon: Stethoscope, gradient: "gradient-info" },
    { label: "Completed", value: mockQueue.filter((q) => q.status === "completed").length, icon: CheckCircle, gradient: "gradient-success" },
  ];

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Patient Queue</h1>
        <p className="text-muted-foreground">Real-time patient queue and wait time management</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className={cn("relative rounded-xl p-5 text-foreground overflow-hidden", s.gradient)}>
            <s.icon className="stat-card-icon" />
            <p className="text-sm opacity-80">{s.label}</p>
            <h3 className="text-2xl font-heading font-bold">{s.value}</h3>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((f) => (
          <Button
            key={f}
            variant={activeFilter === f ? "default" : "outline"}
            size="sm"
            className="rounded-full"
            onClick={() => setActiveFilter(f)}
          >
            {f}
          </Button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">#</th>
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Patient</th>
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Department</th>
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Doctor</th>
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Type</th>
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Priority</th>
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Wait Time</th>
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Status</th>
                <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((q) => (
                <tr key={q.id} className={cn("border-b border-border/50 hover:bg-sidebar-accent transition-colors border-l-4", priorityBorder[q.priority])}>
                  <td className="p-4 font-heading font-bold text-muted-foreground">{q.number}</td>
                  <td className="p-4">
                    <div className="font-medium">{q.name}</div>
                    <div className="text-xs text-muted-foreground">{q.age}y • {q.gender} • {q.time}</div>
                  </td>
                  <td className="p-4 text-sm">{q.department}</td>
                  <td className="p-4 text-sm">{q.doctor}</td>
                  <td className="p-4">
                    <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", q.type === "walk_in" ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary")}>
                      {q.type === "walk_in" ? "Walk-in" : "Booked"}
                    </span>
                  </td>
                  <td className="p-4">
                    {q.priority === "emergency" && <AlertTriangle className="h-4 w-4 text-destructive inline mr-1" />}
                    <span className="text-sm capitalize">{q.priority}</span>
                  </td>
                  <td className="p-4 text-sm">{q.waitTime}</td>
                  <td className="p-4">
                    <span className={cn("text-xs font-semibold px-3 py-1 rounded-full", statusColors[q.status])}>
                      {q.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </span>
                  </td>
                  <td className="p-4">
                    <Button variant="outline" size="sm">View</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </HospitalLayout>
  );
}
