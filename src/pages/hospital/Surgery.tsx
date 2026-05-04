import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { Scissors, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useSurgeryRecords } from "@/hooks/useHospitalData";
import { ScheduleSurgeryDialog } from "@/components/hospital/dialogs/ScheduleSurgeryDialog";

const tabs = ["All", "Scheduled", "In Progress", "Completed"];

export default function HospitalSurgery() {
  const { data: surgeries = [], isLoading } = useSurgeryRecords();
  const [activeTab, setActiveTab] = useState("All");

  const filtered = activeTab === "All" ? surgeries :
    surgeries.filter((s: any) => s.status === activeTab.toLowerCase().replace(/ /g, "_"));

  const stats = [
    { label: "Scheduled", value: surgeries.filter((s: any) => s.status === "scheduled").length, icon: Scissors, gradient: "gradient-primary" },
    { label: "In Progress", value: surgeries.filter((s: any) => s.status === "in_progress").length, icon: Clock, gradient: "gradient-warning" },
    { label: "Completed", value: surgeries.filter((s: any) => s.status === "completed").length, icon: CheckCircle, gradient: "gradient-success" },
    { label: "Emergency", value: surgeries.filter((s: any) => s.procedure_type === "emergency").length, icon: AlertTriangle, gradient: "gradient-danger" },
  ];

  return (
    <HospitalLayout>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-heading font-bold mb-1">Surgery</h1>
          <p className="text-muted-foreground">Operating theatre schedules, surgical records, and post-op monitoring</p>
        </div>
        <ScheduleSurgeryDialog />
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

      <div className="flex flex-wrap gap-1 mb-6">
        {tabs.map((t) => (
          <Button key={t} variant={activeTab === t ? "default" : "secondary"} size="sm" onClick={() => setActiveTab(t)}>{t}</Button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Patient", "Procedure", "Type", "Surgeon", "Theatre", "Time", "Anaesthesia", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No surgery records</td></tr>
                ) : filtered.map((s: any) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                    <td className="p-4 font-medium">{s.patients?.first_name} {s.patients?.last_name}</td>
                    <td className="p-4 text-sm">{s.procedure_name}</td>
                    <td className="p-4"><span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", s.procedure_type === "emergency" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>{s.procedure_type}</span></td>
                    <td className="p-4 text-sm">{s.doctors ? `Dr. ${s.doctors.first_name} ${s.doctors.last_name}` : "—"}</td>
                    <td className="p-4 text-sm">{s.theatre_number || "—"}</td>
                    <td className="p-4 text-sm">{s.scheduled_time}</td>
                    <td className="p-4 text-sm">{s.anaesthesia_type || "—"}</td>
                    <td className="p-4">
                      <span className={cn("text-xs font-semibold px-3 py-1 rounded-full",
                        s.status === "completed" ? "bg-success/15 text-success" : s.status === "in_progress" ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning"
                      )}>{(s.status || "scheduled").replace(/_/g, " ")}</span>
                    </td>
                    <td className="p-4"><Button variant="outline" size="sm">View</Button></td>
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
