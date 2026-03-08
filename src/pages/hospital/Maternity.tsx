import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { Baby, Heart, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useMaternityRecords } from "@/hooks/useHospitalData";

const tabs = ["ANC Register", "Labour Ward", "Delivered", "Postnatal"];
const riskColors: Record<string, string> = { low: "bg-success/15 text-success", moderate: "bg-warning/15 text-warning", high: "bg-destructive/15 text-destructive" };

export default function HospitalMaternity() {
  const { data: records = [], isLoading } = useMaternityRecords();
  const [activeTab, setActiveTab] = useState("ANC Register");

  const filtered = activeTab === "ANC Register" ? records.filter((r: any) => (r.status || "").includes("anc")) :
    activeTab === "Labour Ward" ? records.filter((r: any) => r.status === "labour") :
    activeTab === "Delivered" ? records.filter((r: any) => r.status === "delivered") :
    records.filter((r: any) => r.status === "postnatal");

  const stats = [
    { label: "Active ANC", value: records.filter((r: any) => (r.status || "").includes("anc")).length, icon: Baby, gradient: "gradient-primary" },
    { label: "High Risk", value: records.filter((r: any) => r.risk_level === "high").length, icon: AlertTriangle, gradient: "gradient-danger" },
    { label: "In Labour", value: records.filter((r: any) => r.status === "labour").length, icon: Heart, gradient: "gradient-warning" },
    { label: "Delivered", value: records.filter((r: any) => r.status === "delivered").length, icon: CheckCircle, gradient: "gradient-success" },
  ];

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
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> : (
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
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No records in this category</td></tr>
                ) : filtered.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                    <td className="p-4 font-medium">{r.patients?.first_name} {r.patients?.last_name}</td>
                    <td className="p-4 text-sm">{r.edd ? new Date(r.edd).toLocaleDateString() : "—"}</td>
                    <td className="p-4 font-heading font-bold">{r.gestational_age_weeks || "—"}</td>
                    <td className="p-4 text-sm">G{r.gravida || 0}P{r.para || 0}</td>
                    <td className="p-4">{r.patients?.blood_group ? <span className="bg-primary/15 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">{r.patients.blood_group}</span> : "—"}</td>
                    <td className="p-4"><span className={cn("text-xs font-semibold px-3 py-1 rounded-full", riskColors[r.risk_level || "low"])}>{r.risk_level || "low"}</span></td>
                    <td className="p-4 text-sm">{r.doctors ? `Dr. ${r.doctors.first_name} ${r.doctors.last_name}` : "—"}</td>
                    <td className="p-4"><span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/15 text-primary">{(r.status || "").replace(/_/g, " ")}</span></td>
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
