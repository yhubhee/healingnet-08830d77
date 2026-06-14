import { HospitalLayout } from "@/layouts/HospitalLayout";
import { useState } from "react";
import { Clock, Users, Stethoscope, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePatientCheckins, useRealtimeCheckins, useUpdateCheckin } from "@/hooks/useHospitalData";
import { CheckInDialog } from "@/components/hospital/dialogs/CheckInDialog";

const filters = ["All", "Waiting", "Called", "In Consultation", "Checked In", "Completed"];

const statusColors: Record<string, string> = {
  waiting: "bg-warning/15 text-warning",
  called: "bg-info/15 text-info",
  in_consultation: "bg-primary/15 text-primary",
  checked_in: "bg-success/15 text-success",
  completed: "bg-muted text-muted-foreground",
};

const priorityBorder: Record<string, string> = {
  routine: "border-l-primary",
  soon: "border-l-warning",
  urgent: "border-l-yellow-500",
  emergency: "border-l-destructive",
};

export default function HospitalQueue() {
  useRealtimeCheckins();
  const { data: checkins = [], isLoading } = usePatientCheckins();
  const updateCheckin = useUpdateCheckin();
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = activeFilter === "All"
    ? checkins
    : checkins.filter((q: any) => q.status === activeFilter.toLowerCase().replace(/ /g, "_"));

  const stats = [
    { label: "In Queue", value: checkins.filter((q: any) => q.status !== "completed").length, icon: Users, gradient: "gradient-primary" },
    { label: "Waiting", value: checkins.filter((q: any) => q.status === "waiting").length, icon: Clock, gradient: "gradient-warning" },
    { label: "Called", value: checkins.filter((q: any) => q.status === "called").length, icon: Stethoscope, gradient: "gradient-info" },
    { label: "Completed", value: checkins.filter((q: any) => q.status === "completed").length, icon: CheckCircle, gradient: "gradient-success" },
  ];

  const getAge = (dob: string | null) => {
    if (!dob) return "—";
    return String(Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
  };

  const getWaitTime = (checkinTime: string | null) => {
    if (!checkinTime) return "—";
    const mins = Math.floor((Date.now() - new Date(checkinTime).getTime()) / 60000);
    return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <HospitalLayout>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-heading font-bold mb-1">Patient Queue</h1>
          <p className="text-muted-foreground">Real-time patient queue and wait time management</p>
        </div>
        <CheckInDialog />
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
          <Button key={f} variant={activeFilter === f ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setActiveFilter(f)}>{f}</Button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading queue...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">#</th>
                  <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Patient</th>
                  <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Department</th>
                  <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Doctor</th>
                  <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Type</th>
                  <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Urgency</th>
                  <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Wait Time</th>
                  <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Status</th>
                  <th className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No patients in queue</td></tr>
                ) : filtered.map((q: any) => (
                  <tr key={q.id} className={cn("border-b border-border/50 hover:bg-sidebar-accent transition-colors border-l-4", priorityBorder[q.urgency || "routine"])}>
                    <td className="p-4 font-heading font-bold text-muted-foreground">{q.queue_number || "—"}</td>
                    <td className="p-4">
                      <div className="font-medium">{q.patients?.first_name} {q.patients?.last_name}</div>
                      <div className="text-xs text-muted-foreground">{getAge(q.patients?.date_of_birth)}y • {q.patients?.gender || "—"}</div>
                    </td>
                    <td className="p-4 text-sm">{q.department || "—"}</td>
                    <td className="p-4 text-sm">{q.doctors ? `Dr. ${q.doctors.first_name} ${q.doctors.last_name}` : "—"}</td>
                    <td className="p-4">
                      <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", q.checkin_type === "walk_in" ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary")}>
                        {q.checkin_type === "walk_in" ? "Walk-in" : "Booked"}
                      </span>
                    </td>
                    <td className="p-4">
                      {q.urgency === "emergency" && <AlertTriangle className="h-4 w-4 text-destructive inline mr-1" />}
                      <span className="text-sm capitalize">{q.urgency || "routine"}</span>
                    </td>
                    <td className="p-4 text-sm">{getWaitTime(q.checkin_time)}</td>
                    <td className="p-4">
                      <span className={cn("text-xs font-semibold px-3 py-1 rounded-full", statusColors[q.status] || "bg-muted text-muted-foreground")}>
                        {q.status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                    </td>
                    <td className="p-4 space-x-1">
                      {q.status === "called" && <Button size="sm" onClick={() => updateCheckin.mutate({ id: q.id, status: "in_consultation", consultation_start: new Date().toISOString() })}>Acknowledge</Button>}
                      {q.status === "checked_in" && <Button size="sm" onClick={() => updateCheckin.mutate({ id: q.id, status: "in_consultation", consultation_start: new Date().toISOString() })}>Start</Button>}
                      {q.status === "in_consultation" && <Button size="sm" variant="outline" onClick={() => updateCheckin.mutate({ id: q.id, status: "completed", consultation_end: new Date().toISOString() })}>Complete</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </HospitalLayout>
  );
}
