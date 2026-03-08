import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { Microscope, Clock, FlaskConical, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const stats = [
  { label: "Tests Today", value: 26, icon: Microscope, gradient: "gradient-primary" },
  { label: "Pending", value: 8, icon: Clock, gradient: "gradient-warning" },
  { label: "In Progress", value: 5, icon: FlaskConical, gradient: "gradient-info" },
  { label: "Completed", value: 13, icon: CheckCircle, gradient: "gradient-success" },
];

const tabs = ["Pending Orders", "In Progress", "Completed", "Sample Tracking"];

const mockOrders = [
  { id: 1, patient: "Amara Obi", tests: "Full Blood Count, Malaria RDT", category: "Hematology", sample: "Blood", doctor: "Dr. Adebayo", status: "pending" },
  { id: 2, patient: "Chidi Nwosu", tests: "Lipid Profile", category: "Biochemistry", sample: "Blood", doctor: "Dr. Okonkwo", status: "in_progress" },
  { id: 3, patient: "Fatima Bello", tests: "Urinalysis", category: "Microbiology", sample: "Urine", doctor: "Dr. Mohammed", status: "completed" },
  { id: 4, patient: "Emeka Eze", tests: "ESR, Blood Film", category: "Hematology", sample: "Blood", doctor: "Dr. Nnamdi", status: "pending" },
  { id: 5, patient: "Ngozi Adamu", tests: "Liver Function Test", category: "Biochemistry", sample: "Blood", doctor: "Dr. Adebayo", status: "in_progress" },
];

export default function HospitalLab() {
  const [activeTab, setActiveTab] = useState("Pending Orders");

  const filtered = activeTab === "Sample Tracking" ? mockOrders :
    mockOrders.filter((o) => {
      if (activeTab === "Pending Orders") return o.status === "pending";
      if (activeTab === "In Progress") return o.status === "in_progress";
      if (activeTab === "Completed") return o.status === "completed";
      return true;
    });

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Laboratory</h1>
        <p className="text-muted-foreground">Test orders, results management, sample tracking, and lab analytics</p>
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
          <Button key={t} variant={activeTab === t ? "default" : "secondary"} size="sm" onClick={() => setActiveTab(t)}>
            {t}
          </Button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Order #", "Patient", "Test(s)", "Category", "Sample", "Ordered By", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                  <td className="p-4 font-heading font-bold text-muted-foreground">LAB-{o.id}</td>
                  <td className="p-4 font-medium">{o.patient}</td>
                  <td className="p-4 text-sm">{o.tests}</td>
                  <td className="p-4 text-sm">{o.category}</td>
                  <td className="p-4 text-sm">{o.sample}</td>
                  <td className="p-4 text-sm">{o.doctor}</td>
                  <td className="p-4">
                    <span className={cn("text-xs font-semibold px-3 py-1 rounded-full",
                      o.status === "completed" ? "bg-success/15 text-success" : o.status === "in_progress" ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning"
                    )}>{o.status.replace(/_/g, " ")}</span>
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
