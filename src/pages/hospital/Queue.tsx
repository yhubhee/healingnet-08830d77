import { HospitalLayout } from "@/layouts/HospitalLayout";
import { useState } from "react";
import { Clock, Users, Stethoscope, CheckCircle, AlertTriangle, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePatientCheckins, useRealtimeCheckins, useUpdateCheckin } from "@/hooks/useHospitalData";
import { CheckInDialog } from "@/components/hospital/dialogs/CheckInDialog";
import { CheckinQrDialog } from "@/components/hospital/dialogs/CheckinQrDialog";
import { parseCheckinNotes } from "@/lib/checkin";
import { lagosToday } from "@/lib/dates";
import { QueryState } from "@/components/common/QueryState";

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

const lagosDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos", year: "numeric", month: "2-digit", day: "2-digit" });

/** "Checked in with app" and the patient's own reason, for check-ins made by scanning the QR code. */
function AppCheckinNote({ notes }: { notes: string | null }) {
  const { viaApp, reason } = parseCheckinNotes(notes);
  if (!viaApp) return null;
  return (
    <div className="mt-1 space-y-0.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-info/15 px-2 py-0.5 text-xs font-semibold text-info"><Smartphone className="h-3 w-3" aria-hidden />Checked in with app</span>
      {reason && <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">Reason:</span> {reason}</p>}
    </div>
  );
}

export default function HospitalQueue() {
  useRealtimeCheckins();
  const { data: allCheckins = [], isLoading, isError, error, refetch } = usePatientCheckins();
  // Queue numbers restart every day (the database gives them out), so the queue is today's.
  const today = lagosToday();
  const checkins = allCheckins.filter((q: any) => q.checkin_time && lagosDay.format(new Date(q.checkin_time)) === today);
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
          <p className="text-muted-foreground">Today's queue, updated live. Queue numbers start again at 1 each day.</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <CheckinQrDialog />
          <CheckInDialog />
        </div>
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
        <QueryState isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {(
          <>
          {/* Mobile / tablet cards */}
          <div className="lg:hidden divide-y divide-border/50">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No patients in the queue today</div>
            ) : filtered.map((q: any) => (
              <div key={q.id} className={cn("p-4 space-y-2 border-l-4", priorityBorder[q.urgency || "routine"])}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      <span className="text-muted-foreground font-heading mr-1">#{q.queue_number || "—"}</span>
                      {q.patients?.first_name} {q.patients?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {q.department || "—"} • {q.doctors ? `Dr. ${q.doctors.first_name} ${q.doctors.last_name}` : "No doctor"}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {q.checkin_type === "walk_in" ? "Walk-in" : "Booked"} • {q.urgency || "routine"} • waited {getWaitTime(q.checkin_time)}
                    </p>
                    <AppCheckinNote notes={q.notes} />
                  </div>
                  <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full shrink-0", statusColors[q.status] || "bg-muted text-muted-foreground")}>
                    {q.status.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {q.status === "called" && <Button size="sm" onClick={() => updateCheckin.mutate({ id: q.id, status: "in_consultation", consultation_start: new Date().toISOString() })}>Acknowledge</Button>}
                  {q.status === "checked_in" && <Button size="sm" onClick={() => updateCheckin.mutate({ id: q.id, status: "in_consultation", consultation_start: new Date().toISOString() })}>Start</Button>}
                  {q.status === "in_consultation" && <Button size="sm" variant="outline" onClick={() => updateCheckin.mutate({ id: q.id, status: "completed", consultation_end: new Date().toISOString() })}>Complete</Button>}
                </div>
              </div>
            ))}
          </div>

          <div className="hidden lg:block overflow-x-auto">
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
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No patients in the queue today</td></tr>
                ) : filtered.map((q: any) => (
                  <tr key={q.id} className={cn("border-b border-border/50 hover:bg-sidebar-accent transition-colors border-l-4", priorityBorder[q.urgency || "routine"])}>
                    <td className="p-4 font-heading font-bold text-muted-foreground">{q.queue_number || "—"}</td>
                    <td className="p-4">
                      <div className="font-medium">{q.patients?.first_name} {q.patients?.last_name}</div>
                      <div className="text-xs text-muted-foreground">{getAge(q.patients?.date_of_birth)}y • {q.patients?.gender || "—"}</div>
                      <AppCheckinNote notes={q.notes} />
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
          </>
        )}
        </QueryState>
      </div>
    </HospitalLayout>
  );
}
