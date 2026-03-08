import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { CreditCard, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const summaryCards = [
  { label: "Total Revenue", value: "₦12.8M", colorClass: "text-success", icon: TrendingUp },
  { label: "Collected", value: "₦9.2M", colorClass: "text-primary", icon: CheckCircle },
  { label: "Pending", value: "₦3.6M", colorClass: "text-warning", icon: Clock },
  { label: "Avg. Bill", value: "₦18,500", colorClass: "text-info", icon: CreditCard },
];

const mockBills = [
  { id: 1, patient: "Amara Obi", type: "Consultation", amount: 15000, total: 15000, method: "Cash", status: "paid", date: "2026-03-08" },
  { id: 2, patient: "Chidi Nwosu", type: "Lab Test", amount: 8500, total: 8500, method: "Transfer", status: "pending", date: "2026-03-08" },
  { id: 3, patient: "Fatima Bello", type: "Pharmacy", amount: 22000, total: 22000, method: "Insurance", status: "paid", date: "2026-03-07" },
  { id: 4, patient: "Emeka Eze", type: "Procedure", amount: 45000, total: 45000, method: "Card", status: "pending", date: "2026-03-07" },
  { id: 5, patient: "Ngozi Adamu", type: "Surgery", amount: 350000, total: 350000, method: "HMO", status: "partial", date: "2026-03-06" },
];

const filters = ["All", "Paid", "Pending", "Partial"];

export default function HospitalBilling() {
  const [activeFilter, setActiveFilter] = useState("All");
  const filtered = activeFilter === "All" ? mockBills : mockBills.filter((b) => b.status === activeFilter.toLowerCase());

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Billing & Revenue</h1>
        <p className="text-muted-foreground">Manage hospital billing, payments, and revenue tracking</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {summaryCards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-5 text-center">
            <p className="text-xs text-muted-foreground mb-2">{c.label}</p>
            <h3 className={cn("text-xl font-heading font-bold", c.colorClass)}>{c.value}</h3>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {filters.map((f) => (
          <Button key={f} variant={activeFilter === f ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setActiveFilter(f)}>
            {f}
          </Button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {["Patient", "Type", "Amount", "Method", "Date", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr key={b.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                  <td className="p-4 font-medium">{b.patient}</td>
                  <td className="p-4 text-sm">{b.type}</td>
                  <td className="p-4 font-heading font-bold">₦{b.total.toLocaleString()}</td>
                  <td className="p-4 text-sm">{b.method}</td>
                  <td className="p-4 text-sm text-muted-foreground">{new Date(b.date).toLocaleDateString()}</td>
                  <td className="p-4">
                    <span className={cn("text-xs font-semibold px-3 py-1 rounded-full",
                      b.status === "paid" ? "bg-success/15 text-success" : b.status === "partial" ? "bg-info/15 text-info" : "bg-warning/15 text-warning"
                    )}>{b.status}</span>
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
