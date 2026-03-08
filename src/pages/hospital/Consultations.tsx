import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { Send, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const mockConsults = [
  { id: 1, patient: "Amara Obi", doctor: "Dr. Specialist A", specialty: "Neurology", urgency: "high", type: "virtual", status: "pending", date: "2026-03-08" },
  { id: 2, patient: "Chidi Nwosu", doctor: "Dr. Specialist B", specialty: "Oncology", urgency: "moderate", type: "in_person", status: "accepted", date: "2026-03-07" },
  { id: 3, patient: "Ibrahim Musa", doctor: "Dr. Specialist C", specialty: "Nephrology", urgency: "low", type: "virtual", status: "completed", date: "2026-03-05" },
];

const tabs = ["All", "Pending", "Accepted", "Completed"];

export default function HospitalConsultations() {
  const [activeTab, setActiveTab] = useState("All");
  const filtered = activeTab === "All" ? mockConsults : mockConsults.filter((c) => c.status === activeTab.toLowerCase());

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Consultation Requests</h1>
        <p className="text-muted-foreground">Request and manage external specialist consultations</p>
      </div>
      <div className="flex flex-wrap gap-1 mb-6">
        {tabs.map((t) => (<Button key={t} variant={activeTab === t ? "default" : "secondary"} size="sm" onClick={() => setActiveTab(t)}>{t}</Button>))}
      </div>
      <div className="space-y-3">
        {filtered.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-heading font-bold">{c.patient}</h4>
                <p className="text-sm text-muted-foreground">{c.specialty} • {c.doctor}</p>
              </div>
              <span className={cn("text-xs font-semibold px-3 py-1 rounded-full",
                c.status === "completed" ? "bg-success/15 text-success" : c.status === "accepted" ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning"
              )}>{c.status}</span>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Urgency: {c.urgency}</span><span>Type: {c.type}</span><span>{new Date(c.date).toLocaleDateString()}</span>
            </div>
          </div>
        ))}
      </div>
    </HospitalLayout>
  );
}
