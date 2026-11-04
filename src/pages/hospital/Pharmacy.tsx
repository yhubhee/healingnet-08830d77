import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { Pill, AlertTriangle, Package, TrendingUp, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { usePharmacyInventory } from "@/hooks/useHospitalData";
import { AddInventoryDialog } from "@/components/hospital/dialogs/AddInventoryDialog";
import { PrescriptionQueue, usePrescriptionQueue } from "@/components/hospital/PrescriptionQueue";
import { DispenseDrugDialog } from "@/components/hospital/dialogs/DispenseDrugDialog";
import { QueryState } from "@/components/common/QueryState";

const tabs = ["Prescriptions", "Inventory", "Low Stock", "Expiring soon"];

const EXPIRY_WINDOW_DAYS = 90;
/** Days until the item expires (negative once expired); null when there is no expiry date. */
function daysToExpiry(d: string | null | undefined): number | null {
  if (!d) return null;
  const t = new Date(d + "T00:00:00");
  if (Number.isNaN(t.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((+t - +today) / 86_400_000);
}
const expiresSoon = (i: any) => {
  const n = daysToExpiry(i.expiry_date);
  return n !== null && n <= EXPIRY_WINDOW_DAYS;
};
function expiryText(i: any): string {
  const n = daysToExpiry(i.expiry_date);
  if (n === null) return "—";
  const date = new Date(i.expiry_date + "T00:00:00").toLocaleDateString();
  if (n < 0) return `${date} (expired)`;
  if (n <= EXPIRY_WINDOW_DAYS) return `${date} (${n} day${n === 1 ? "" : "s"})`;
  return date;
}

export default function HospitalPharmacy() {
  const { data: inventory = [], isLoading, isError, error, refetch } = usePharmacyInventory();
  const [activeTab, setActiveTab] = useState("Prescriptions");
  const { data: rxQueue = [] } = usePrescriptionQueue();

  const displayed = activeTab === "Low Stock"
    ? inventory.filter((i: any) => (i.quantity_in_stock || 0) <= (i.reorder_level || 50))
    : activeTab === "Expiring soon"
    ? inventory.filter(expiresSoon).sort((a: any, b: any) => String(a.expiry_date).localeCompare(String(b.expiry_date)))
    : inventory;
  const expiringCount = inventory.filter(expiresSoon).length;

  const lowStockCount = inventory.filter((i: any) => (i.quantity_in_stock || 0) <= (i.reorder_level || 50)).length;

  const stats = [
    { label: "Total Items", value: inventory.length, icon: Package, gradient: "gradient-primary" },
    { label: "Low Stock", value: lowStockCount, icon: AlertTriangle, gradient: "gradient-danger" },
    { label: "Categories", value: new Set(inventory.map((i: any) => i.category)).size, icon: Pill, gradient: "gradient-success" },
    { label: "Total Value", value: `₦${(inventory.reduce((s: number, i: any) => s + (Number(i.unit_price) || 0) * (i.quantity_in_stock || 0), 0) / 1000).toFixed(0)}K`, icon: TrendingUp, gradient: "gradient-info" },
  ];

  return (
    <HospitalLayout>
      <div className="mb-6 flex flex-wrap gap-3 justify-between items-start">
        <div>
          <h1 className="text-2xl font-heading font-bold mb-1">Pharmacy</h1>
          <p className="text-muted-foreground">Inventory management, dispensing, and stock alerts</p>
        </div>
        <div className="flex gap-2"><DispenseDrugDialog /><AddInventoryDialog /></div>
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

      {expiringCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm" role="status" data-testid="expiry-warning">
          <CalendarClock className="h-5 w-5 shrink-0 text-warning" aria-hidden />
          <p className="min-w-0 flex-1 font-medium">{expiringCount} item{expiringCount === 1 ? "" : "s"} expire{expiringCount === 1 ? "s" : ""} within {EXPIRY_WINDOW_DAYS} days</p>
          {activeTab !== "Expiring soon" && <Button size="sm" variant="outline" onClick={() => setActiveTab("Expiring soon")}>Show them</Button>}
        </div>
      )}

      <div className="flex flex-wrap gap-1 mb-6">
        {tabs.map((t) => (
          <Button key={t} variant={activeTab === t ? "default" : "secondary"} size="sm" onClick={() => setActiveTab(t)}>{t === "Prescriptions" ? `Prescriptions to dispense (${rxQueue.length})` : t === "Expiring soon" ? `Expiring soon (${expiringCount})` : t}</Button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {activeTab === "Prescriptions" ? <PrescriptionQueue /> : (
        <QueryState isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {displayed.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{activeTab === "Expiring soon" ? `Nothing expires within ${EXPIRY_WINDOW_DAYS} days.` : "No inventory items"}</div>
        ) : (
          <>
            <div className="lg:hidden divide-y divide-border/50">
              {displayed.map((item: any) => {
                const low = (item.quantity_in_stock || 0) <= (item.reorder_level || 50);
                const soon = expiresSoon(item);
                return (
                  <div key={item.id} className={cn("p-4 space-y-1", soon && "bg-warning/10")}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.drug_name}</p>
                        <p className="text-xs text-muted-foreground">{item.category || "—"} · {item.dosage_form || "—"}{item.nafdac_reg_no ? ` · NAFDAC ${item.nafdac_reg_no}` : ""}</p>
                      </div>
                      <span className={cn("font-heading font-bold", low ? "text-destructive" : "text-foreground")}>
                        {item.quantity_in_stock || 0}
                        {low && <AlertTriangle className="inline h-3.5 w-3.5 ml-1" />}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>₦{Number(item.unit_price || 0).toLocaleString()} / unit</span>
                      <span className={cn(soon && "font-semibold text-warning")}>{item.expiry_date ? `Exp. ${expiryText(item)}` : "No expiry"}</span>
                    </div>
                    <AddInventoryDialog item={item} trigger={<Button variant="outline" size="sm" className="mt-1">Edit</Button>} />
                  </div>
                );
              })}
            </div>

            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {["Drug Name", "Category", "Form", "NAFDAC no.", "Stock", "Reorder Level", "Unit Price", "Expiry", "Actions"].map((h) => (
                      <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((item: any) => (
                    <tr key={item.id} className={cn("border-b border-border/50 hover:bg-sidebar-accent transition-colors", expiresSoon(item) && "bg-warning/10")}>
                      <td className="p-4 font-medium">{item.drug_name}</td>
                      <td className="p-4 text-sm">{item.category || "—"}</td>
                      <td className="p-4 text-sm">{item.dosage_form || "—"}</td>
                      <td className="p-4 text-sm font-mono">{item.nafdac_reg_no || "—"}</td>
                      <td className="p-4">
                        <span className={cn("font-heading font-bold", (item.quantity_in_stock || 0) <= (item.reorder_level || 50) ? "text-destructive" : "text-foreground")}>
                          {item.quantity_in_stock || 0}
                        </span>
                        {(item.quantity_in_stock || 0) <= (item.reorder_level || 50) && <AlertTriangle className="inline h-3.5 w-3.5 text-destructive ml-1" />}
                      </td>
                      <td className="p-4 text-sm text-muted-foreground">{item.reorder_level || 50}</td>
                      <td className="p-4 text-sm">₦{Number(item.unit_price || 0).toLocaleString()}</td>
                      <td className={cn("p-4 text-sm", expiresSoon(item) ? "font-semibold text-warning" : "text-muted-foreground")}>{expiryText(item)}</td>
                      <td className="p-4"><AddInventoryDialog item={item} trigger={<Button variant="outline" size="sm">Edit</Button>} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        </QueryState>
        )}
      </div>

    </HospitalLayout>
  );
}
