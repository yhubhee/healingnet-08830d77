import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { Microscope, Clock, FlaskConical, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useLabResults } from "@/hooks/useHospitalData";
import { OrderLabTestDialog } from "@/components/hospital/dialogs/OrderLabTestDialog";
import { EnterLabResultDialog } from "@/components/hospital/dialogs/EnterLabResultDialog";

const tabs = ["All", "Pending", "In Progress", "Completed"];

export default function HospitalLab() {
  const { data: labResults = [], isLoading } = useLabResults();
  const [activeTab, setActiveTab] = useState("All");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const filtered = activeTab === "All" ? labResults :
    labResults.filter((o: any) => o.status === activeTab.toLowerCase().replace(/ /g, "_"));

  const stats = [
    { label: "Total Tests", value: labResults.length, icon: Microscope, gradient: "gradient-primary" },
    { label: "Pending", value: labResults.filter((o: any) => o.status === "pending").length, icon: Clock, gradient: "gradient-warning" },
    { label: "In Progress", value: labResults.filter((o: any) => o.status === "in_progress").length, icon: FlaskConical, gradient: "gradient-info" },
    { label: "Completed", value: labResults.filter((o: any) => o.status === "completed").length, icon: CheckCircle, gradient: "gradient-success" },
  ];

  return (
    <HospitalLayout>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-heading font-bold mb-1">Laboratory</h1>
          <p className="text-muted-foreground">Test orders, results management, sample tracking, and lab analytics</p>
        </div>
        <OrderLabTestDialog />
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
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading lab data...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Order #", "Patient", "Tests", "Ordered By", "Date", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No lab results</td></tr>
                ) : filtered.map((o: any) => (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                    <td className="p-4 font-heading font-bold text-muted-foreground">LAB-{o.id.slice(0, 4)}</td>
                    <td className="p-4 font-medium">{o.patients?.first_name} {o.patients?.last_name}</td>
                    <td className="p-4 text-sm">{o.lab_result_tests?.map((t: any) => t.test_name).join(", ") || "—"}</td>
                    <td className="p-4 text-sm">{o.doctors ? `Dr. ${o.doctors.first_name} ${o.doctors.last_name}` : "—"}</td>
                    <td className="p-4 text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="p-4">
                      <span className={cn("text-xs font-semibold px-3 py-1 rounded-full",
                        o.status === "completed" ? "bg-success/15 text-success" : o.status === "in_progress" ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning"
                      )}>{(o.status || "pending").replace(/_/g, " ")}</span>
                    </td>
                    <td className="p-4"><Button variant="outline" size="sm" onClick={() => setSelectedOrder(o)}>{o.status === "completed" ? "View" : "Enter Results"}</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <EnterLabResultDialog order={selectedOrder} open={!!selectedOrder} onClose={() => setSelectedOrder(null)} />
    </HospitalLayout>
  );
}
