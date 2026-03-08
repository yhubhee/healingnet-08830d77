import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { Baby, Heart, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const stats = [
  { label: "Active ANC", value: 18, icon: Baby, gradient: "gradient-primary" },
  { label: "High Risk", value: 3, icon: AlertTriangle, gradient: "gradient-danger" },
  { label: "Due This Week", value: 4, icon: Heart, gradient: "gradient-warning" },
  { label: "Delivered (Month)", value: 12, icon: CheckCircle, gradient: "gradient-success" },
];

const tabs = ["ANC Register", "Labour Ward", "Delivered", "Postnatal"];

const mockRecords = [
  { id: 1, patient: "Ngozi Adamu", edd: "2026-03-20", weeks: 38, gravida: 2, para: 1, risk: "low", status: "active_anc", blood: "O+", doctor: "Dr. Okonkwo" },
  { id: 2, patient: "Amina Yusuf", edd: "2026-03-15", weeks: 39, gravida: 1, para: 0, risk: "high", status: "active_anc", blood: "B+", doctor: "Dr. Okonkwo" },
  { id: 3, patient: "Blessing Okafor", edd: "2026-03-10", weeks: 40, gravida: 3, para: 2, risk: "moderate", status: "labour", blood: "A+", doctor: "Dr. Mohammed" },
  { id: 4, patient: "Fatima Abubakar", edd: "2026-03-01", weeks: 41, gravida: 2, para: 1, risk: "low", status: "delivered", blood: "O-", doctor: "Dr. Okonkwo" },
];

const riskColors: Record<string, string> = {
  low: "bg-success/15 text-success",
  moderate: "bg-warning/15 text-warning",
  high: "bg-destructive/15 text-destructive",
};

export default function HospitalMaternity() {
  const [activeTab, setActiveTab] = useState("ANC Register");

  const filtered = activeTab === "ANC Register" ? mockRecords.filter((r) => r.status.includes("anc")) :
    activeTab === "Labour Ward" ? mockRecords.filter((r) => r.status === "labour") :
    activeTab === "Delivered" ? mockRecords.filter((r) => r.status === "delivered") :
    mockRecords.filter((r) => r.status === "postnatal");

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Maternity</h1>
        <p className="text-muted-foreground">Antenatal care, labour monitoring, delivery records, and postnatal follow-up</p>
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
                {["Patient", "EDD", "Weeks", "G/P", "Blood Group", "Risk Level", "Doctor", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length ? filtered.map((r) => (
                <tr key={r.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                  <td className="p-4 font-medium">{r.patient}</td>
                  <td className="p-4 text-sm">{new Date(r.edd).toLocaleDateString()}</td>
                  <td className="p-4 font-heading font-bold">{r.weeks}</td>
                  <td className="p-4 text-sm">G{r.gravida}P{r.para}</td>
                  <td className="p-4"><span className="bg-primary/15 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">{r.blood}</span></td>
                  <td className="p-4"><span className={cn("text-xs font-semibold px-3 py-1 rounded-full", riskColors[r.risk])}>{r.risk}</span></td>
                  <td className="p-4 text-sm">{r.doctor}</td>
                  <td className="p-4"><span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/15 text-primary">{r.status.replace(/_/g, " ")}</span></td>
                  <td className="p-4"><Button variant="outline" size="sm">View</Button></td>
                </tr>
              )) : (
                <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No records in this category</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </HospitalLayout>
  );
}
