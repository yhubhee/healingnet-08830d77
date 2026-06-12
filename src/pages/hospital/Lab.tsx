import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { Microscope, Clock, FlaskConical, CheckCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useLabResults } from "@/hooks/useHospitalData";
import { OrderLabTestDialog } from "@/components/hospital/dialogs/OrderLabTestDialog";
import { EnterLabResultDialog } from "@/components/hospital/dialogs/EnterLabResultDialog";

const tabs = ["All", "Pending", "Processing", "Completed", "Final"];

export default function HospitalLab() {
  const { data: labResults = [], isLoading } = useLabResults();
  const [activeTab, setActiveTab] = useState("All");
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filtered = (activeTab === "All" ? labResults :
    labResults.filter((o: any) => o.status === activeTab.toLowerCase().replace(/ /g, "_")))
    .filter((o: any) => {
      const patientName = `${o.patients?.first_name} ${o.patients?.last_name}`.toLowerCase();
      const doctorName = `${o.doctors?.first_name} ${o.doctors?.last_name}`.toLowerCase();
      return patientName.includes(searchTerm.toLowerCase()) || doctorName.includes(searchTerm.toLowerCase());
    });

  const stats = [
    { label: "Total Tests", value: labResults.length, icon: Microscope, gradient: "gradient-primary" },
    { label: "Pending", value: labResults.filter((o: any) => o.status === "pending").length, icon: Clock, gradient: "gradient-warning" },
    { label: "Processing", value: labResults.filter((o: any) => o.status === "in_progress" || o.status === "processing").length, icon: FlaskConical, gradient: "gradient-info" },
    { label: "Completed", value: labResults.filter((o: any) => o.status === "completed" || o.status === "final").length, icon: CheckCircle, gradient: "gradient-success" },
  ];

  return (
    <HospitalLayout>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-heading font-bold mb-1">Laboratory Management</h1>
          <p className="text-muted-foreground">Test orders, results entry, sample tracking, and lab analytics — optimized for lab technicians</p>
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

      <div className="bg-card border border-border rounded-xl p-4 mb-6 space-y-4">
        <div className="flex gap-2 items-center">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search patient or doctor name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Button key={t} variant={activeTab === t ? "default" : "outline"} size="sm" onClick={() => setActiveTab(t)}>
              {t}
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading lab data...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {["Order #", "Patient", "Tests", "Ordered By", "Date", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No lab results found</td></tr>
                ) : filtered.map((o: any) => (
                  <tr key={o.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                    <td className="p-4 font-heading font-bold text-muted-foreground">LAB-{o.id.slice(0, 4).toUpperCase()}</td>
                    <td className="p-4">
                      <p className="font-medium text-sm">{o.patients?.first_name} {o.patients?.last_name}</p>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="flex gap-1 flex-wrap max-w-xs">
                        {o.lab_result_tests?.slice(0, 2).map((t: any) => (
                          <span key={t.id} className="px-2 py-1 bg-muted rounded text-xs">{t.test_name}</span>
                        ))}
                        {o.lab_result_tests?.length > 2 && (
                          <span className="px-2 py-1 bg-muted rounded text-xs">+{o.lab_result_tests.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-sm">{o.doctors ? `Dr. ${o.doctors.first_name} ${o.doctors.last_name}` : "—"}</td>
                    <td className="p-4 text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString()}</td>
                    <td className="p-4">
                      <span className={cn("text-xs font-semibold px-3 py-1 rounded-full",
                        o.status === "completed" || o.status === "final" ? "bg-success/15 text-success" :
                        o.status === "in_progress" || o.status === "processing" ? "bg-info/15 text-info" :
                        "bg-warning/15 text-warning"
                      )}>{(o.status || "pending").replace(/_/g, " ")}</span>
                    </td>
                    <td className="p-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedOrder(o)}
                      >
                        {o.status === "completed" || o.status === "final" ? "View" : "Enter Results"}
                      </Button>
                    </td>
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
