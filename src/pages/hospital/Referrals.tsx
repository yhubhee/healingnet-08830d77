import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { Share2, ArrowUpRight, ArrowDownRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const tabs = ["All", "Outgoing", "Incoming", "Internal"];

const mockReferrals = [
  { id: 1, patient: "Amara Obi", from: "Dr. Adebayo", to: "Lagos University Teaching Hospital", specialty: "Neurology", urgency: "urgent", type: "external_outgoing", status: "pending", date: "2026-03-08" },
  { id: 2, patient: "Chidi Nwosu", from: "Dr. Adebayo", to: "Dr. Okonkwo", specialty: "Cardiology", urgency: "routine", type: "internal", status: "accepted", date: "2026-03-07" },
  { id: 3, patient: "Ibrahim Musa", from: "General Hospital Abuja", to: "Dr. Nnamdi", specialty: "Orthopedics", urgency: "routine", type: "external_incoming", status: "in_progress", date: "2026-03-06" },
  { id: 4, patient: "Fatima Bello", from: "Dr. Mohammed", to: "Eko Hospital", specialty: "ENT", urgency: "emergency", type: "external_outgoing", status: "completed", date: "2026-03-05" },
];

const urgencyColors: Record<string, string> = { routine: "bg-success/15 text-success", urgent: "bg-warning/15 text-warning", emergency: "bg-destructive/15 text-destructive" };
const statusColors: Record<string, string> = { pending: "bg-warning/15 text-warning", accepted: "bg-primary/15 text-primary", in_progress: "bg-info/15 text-info", completed: "bg-success/15 text-success", declined: "bg-destructive/15 text-destructive" };

export default function HospitalReferrals() {
  const [activeTab, setActiveTab] = useState("All");

  const filtered = activeTab === "All" ? mockReferrals :
    activeTab === "Outgoing" ? mockReferrals.filter((r) => r.type === "external_outgoing") :
    activeTab === "Incoming" ? mockReferrals.filter((r) => r.type === "external_incoming") :
    mockReferrals.filter((r) => r.type === "internal");

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Referrals</h1>
        <p className="text-muted-foreground">Manage patient referrals — incoming, outgoing, and internal</p>
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
                {["Patient", "From", "To", "Specialty", "Urgency", "Type", "Date", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                  <td className="p-4 font-medium">{r.patient}</td>
                  <td className="p-4 text-sm">{r.from}</td>
                  <td className="p-4 text-sm">{r.to}</td>
                  <td className="p-4 text-sm">{r.specialty}</td>
                  <td className="p-4"><span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", urgencyColors[r.urgency])}>{r.urgency}</span></td>
                  <td className="p-4">
                    {r.type === "external_outgoing" ? <ArrowUpRight className="h-4 w-4 text-warning inline" /> :
                     r.type === "external_incoming" ? <ArrowDownRight className="h-4 w-4 text-success inline" /> :
                     <Share2 className="h-4 w-4 text-primary inline" />}
                    <span className="text-sm ml-1">{r.type.replace(/_/g, " ").replace(/external /g, "")}</span>
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="p-4"><span className={cn("text-xs font-semibold px-3 py-1 rounded-full", statusColors[r.status])}>{r.status.replace(/_/g, " ")}</span></td>
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
