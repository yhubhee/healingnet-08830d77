import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { Scissors, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const stats = [
  { label: "Scheduled Today", value: 4, icon: Scissors, gradient: "gradient-primary" },
  { label: "In Progress", value: 1, icon: Clock, gradient: "gradient-warning" },
  { label: "Completed", value: 2, icon: CheckCircle, gradient: "gradient-success" },
  { label: "Emergency", value: 1, icon: AlertTriangle, gradient: "gradient-danger" },
];

const mockSurgeries = [
  { id: 1, patient: "Emeka Eze", procedure: "Appendectomy", type: "emergency", surgeon: "Dr. Nnamdi", theatre: "OT-1", time: "08:00", status: "completed", anaesthesia: "General" },
  { id: 2, patient: "Amara Obi", procedure: "Hernia Repair", type: "elective", surgeon: "Dr. Adebayo", theatre: "OT-2", time: "10:30", status: "in_progress", anaesthesia: "Spinal" },
  { id: 3, patient: "Ibrahim Musa", procedure: "Knee Replacement", type: "elective", surgeon: "Dr. Nnamdi", theatre: "OT-1", time: "14:00", status: "scheduled", anaesthesia: "General" },
  { id: 4, patient: "Fatima Bello", procedure: "Tonsillectomy", type: "day_case", surgeon: "Dr. Mohammed", theatre: "OT-3", time: "16:00", status: "scheduled", anaesthesia: "General" },
];

const tabs = ["All", "Scheduled", "In Progress", "Completed"];

export default function HospitalSurgery() {
  const [activeTab, setActiveTab] = useState("All");

  const filtered = activeTab === "All" ? mockSurgeries :
    mockSurgeries.filter((s) => s.status === activeTab.toLowerCase().replace(/ /g, "_"));

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Surgery</h1>
        <p className="text-muted-foreground">Operating theatre schedules, surgical records, and post-op monitoring</p>
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
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                  <td className="p-4 font-medium">{s.patient}</td>
                  <td className="p-4 text-sm">{s.procedure}</td>
                  <td className="p-4"><span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", s.type === "emergency" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary")}>{s.type}</span></td>
                  <td className="p-4 text-sm">{s.surgeon}</td>
                  <td className="p-4 text-sm">{s.theatre}</td>
                  <td className="p-4 text-sm">{s.time}</td>
                  <td className="p-4 text-sm">{s.anaesthesia}</td>
                  <td className="p-4">
                    <span className={cn("text-xs font-semibold px-3 py-1 rounded-full",
                      s.status === "completed" ? "bg-success/15 text-success" : s.status === "in_progress" ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning"
                    )}>{s.status.replace(/_/g, " ")}</span>
                  </td>
                  <td className="p-4"><Button variant="outline" size="sm">View</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </HospitalLayout>
  );
}
