import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useConsultationRequests } from "@/hooks/useHospitalData";
import { CreateConsultationDialog } from "@/components/hospital/dialogs/CreateConsultationDialog";

const tabs = ["All", "Pending", "Accepted", "Completed"];

export default function HospitalConsultations() {
  const { data: consults = [], isLoading } = useConsultationRequests();
  const [activeTab, setActiveTab] = useState("All");
  const filtered = activeTab === "All" ? consults : consults.filter((c: any) => c.status === activeTab.toLowerCase());

  return (
    <HospitalLayout>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-heading font-bold mb-1">Consultation Requests</h1>
          <p className="text-muted-foreground">Request and manage external specialist consultations</p>
        </div>
        <CreateConsultationDialog />
      </div>
      <div className="flex flex-wrap gap-1 mb-6">
        {tabs.map((t) => (<Button key={t} variant={activeTab === t ? "default" : "secondary"} size="sm" onClick={() => setActiveTab(t)}>{t}</Button>))}
      </div>
      {isLoading ? <div className="text-center p-8 text-muted-foreground">Loading...</div> : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No consultation requests</div>
          ) : filtered.map((c: any) => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary transition-colors">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-heading font-bold">{c.patients?.first_name} {c.patients?.last_name}</h4>
                  <p className="text-sm text-muted-foreground">{c.specialty_needed || "—"} • {c.doctors ? `Dr. ${c.doctors.first_name} ${c.doctors.last_name}` : "—"}</p>
                </div>
                <span className={cn("text-xs font-semibold px-3 py-1 rounded-full",
                  c.status === "completed" ? "bg-success/15 text-success" : c.status === "accepted" ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning"
                )}>{c.status || "pending"}</span>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Urgency: {c.urgency || "moderate"}</span>
                <span>Type: {c.request_type || "virtual"}</span>
                <span>{new Date(c.created_at).toLocaleDateString()}</span>
              </div>
              {c.reason && <p className="text-sm text-muted-foreground mt-2">{c.reason}</p>}
            </div>
          ))}
        </div>
      )}
    </HospitalLayout>
  );
}
