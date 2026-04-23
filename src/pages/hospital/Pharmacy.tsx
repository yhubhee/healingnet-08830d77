import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { Pill, AlertTriangle, Package, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { usePharmacyInventory } from "@/hooks/useHospitalData";
import { AddInventoryDialog } from "@/components/hospital/dialogs/AddInventoryDialog";

const tabs = ["Inventory", "Low Stock"];

export default function HospitalPharmacy() {
  const { data: inventory = [], isLoading } = usePharmacyInventory();
  const [activeTab, setActiveTab] = useState("Inventory");

  const displayed = activeTab === "Low Stock"
    ? inventory.filter((i: any) => (i.quantity_in_stock || 0) <= (i.reorder_level || 50))
    : inventory;

  const lowStockCount = inventory.filter((i: any) => (i.quantity_in_stock || 0) <= (i.reorder_level || 50)).length;

  const stats = [
    { label: "Total Items", value: inventory.length, icon: Package, gradient: "gradient-primary" },
    { label: "Low Stock", value: lowStockCount, icon: AlertTriangle, gradient: "gradient-danger" },
    { label: "Categories", value: new Set(inventory.map((i: any) => i.category)).size, icon: Pill, gradient: "gradient-success" },
    { label: "Total Value", value: `₦${(inventory.reduce((s: number, i: any) => s + (Number(i.unit_price) || 0) * (i.quantity_in_stock || 0), 0) / 1000).toFixed(0)}K`, icon: TrendingUp, gradient: "gradient-info" },
  ];

  return (
    <HospitalLayout>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-heading font-bold mb-1">Pharmacy</h1>
          <p className="text-muted-foreground">Inventory management, dispensing, and stock alerts</p>
        </div>
        <AddInventoryDialog />
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
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading pharmacy...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Drug Name", "Category", "Form", "Stock", "Reorder Level", "Unit Price", "Expiry", "Actions"].map((h) => (
                    <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No inventory items</td></tr>
                ) : displayed.map((item: any) => (
                  <tr key={item.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                    <td className="p-4 font-medium">{item.drug_name}</td>
                    <td className="p-4 text-sm">{item.category || "—"}</td>
                    <td className="p-4 text-sm">{item.dosage_form || "—"}</td>
                    <td className="p-4">
                      <span className={cn("font-heading font-bold", (item.quantity_in_stock || 0) <= (item.reorder_level || 50) ? "text-destructive" : "text-foreground")}>
                        {item.quantity_in_stock || 0}
                      </span>
                      {(item.quantity_in_stock || 0) <= (item.reorder_level || 50) && <AlertTriangle className="inline h-3.5 w-3.5 text-destructive ml-1" />}
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{item.reorder_level || 50}</td>
                    <td className="p-4 text-sm">₦{Number(item.unit_price || 0).toLocaleString()}</td>
                    <td className="p-4 text-sm text-muted-foreground">{item.expiry_date ? new Date(item.expiry_date).toLocaleDateString() : "—"}</td>
                    <td className="p-4"><Button variant="outline" size="sm">Edit</Button></td>
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
