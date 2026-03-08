import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { CreditCard, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useHospitalBilling } from "@/hooks/useHospitalData";

const filters = ["All", "Paid", "Pending", "Partial"];

export default function HospitalBilling() {
  const { data: billing = [], isLoading } = useHospitalBilling();
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = activeFilter === "All" ? billing : billing.filter((b: any) => b.payment_status === activeFilter.toLowerCase());

  const totalRevenue = billing.reduce((s: number, b: any) => s + Number(b.total), 0);
  const collected = billing.filter((b: any) => b.payment_status === "paid").reduce((s: number, b: any) => s + Number(b.total), 0);
  const pending = billing.filter((b: any) => b.payment_status === "pending").reduce((s: number, b: any) => s + Number(b.total), 0);
  const avg = billing.length > 0 ? Math.round(totalRevenue / billing.length) : 0;

  const summaryCards = [
    { label: "Total Revenue", value: `₦${(totalRevenue / 1000000).toFixed(1)}M`, colorClass: "text-success", icon: TrendingUp },
    { label: "Collected", value: `₦${(collected / 1000000).toFixed(1)}M`, colorClass: "text-primary", icon: CheckCircle },
    { label: "Pending", value: `₦${(pending / 1000000).toFixed(1)}M`, colorClass: "text-warning", icon: Clock },
    { label: "Avg. Bill", value: `₦${avg.toLocaleString()}`, colorClass: "text-info", icon: CreditCard },
  ];

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
          <Button key={f} variant={activeFilter === f ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setActiveFilter(f)}>{f}</Button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading billing...</div> : (
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
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No billing records</td></tr>
                ) : filtered.map((b: any) => (
                  <tr key={b.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                    <td className="p-4 font-medium">{b.patients?.first_name} {b.patients?.last_name}</td>
                    <td className="p-4 text-sm">{b.billing_type}</td>
                    <td className="p-4 font-heading font-bold">₦{Number(b.total).toLocaleString()}</td>
                    <td className="p-4 text-sm">{b.payment_method}</td>
                    <td className="p-4 text-sm text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</td>
                    <td className="p-4">
                      <span className={cn("text-xs font-semibold px-3 py-1 rounded-full",
                        b.payment_status === "paid" ? "bg-success/15 text-success" : b.payment_status === "partial" ? "bg-info/15 text-info" : "bg-warning/15 text-warning"
                      )}>{b.payment_status}</span>
                    </td>
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
