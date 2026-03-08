import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { Pill, AlertTriangle, Package, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const stats = [
  { label: "Total Items", value: 245, icon: Package, gradient: "gradient-primary" },
  { label: "Low Stock", value: 12, icon: AlertTriangle, gradient: "gradient-danger" },
  { label: "Dispensed Today", value: 38, icon: Pill, gradient: "gradient-success" },
  { label: "Revenue Today", value: "₦185K", icon: TrendingUp, gradient: "gradient-info" },
];

const tabs = ["Inventory", "Dispensing", "Low Stock"];

const mockInventory = [
  { id: 1, name: "Amoxicillin 500mg", category: "Antibiotics", form: "Capsule", stock: 35, reorder: 50, price: 1200, expiry: "2027-06-15" },
  { id: 2, name: "Metformin 500mg", category: "Antidiabetics", form: "Tablet", stock: 150, reorder: 50, price: 800, expiry: "2027-12-01" },
  { id: 3, name: "Paracetamol 500mg", category: "Analgesics", form: "Tablet", stock: 500, reorder: 100, price: 200, expiry: "2028-03-20" },
  { id: 4, name: "Artemether/Lumefantrine", category: "Antimalarials", form: "Tablet", stock: 20, reorder: 50, price: 3500, expiry: "2027-09-30" },
  { id: 5, name: "Normal Saline 500ml", category: "IV Fluids", form: "IV Fluid", stock: 80, reorder: 30, price: 1500, expiry: "2028-01-15" },
];

export default function HospitalPharmacy() {
  const [activeTab, setActiveTab] = useState("Inventory");

  const displayed = activeTab === "Low Stock"
    ? mockInventory.filter((i) => i.stock <= i.reorder)
    : mockInventory;

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Pharmacy</h1>
        <p className="text-muted-foreground">Inventory management, dispensing, and stock alerts</p>
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
                {["Drug Name", "Category", "Form", "Stock", "Reorder Level", "Unit Price", "Expiry", "Actions"].map((h) => (
                  <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayed.map((item) => (
                <tr key={item.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                  <td className="p-4 font-medium">{item.name}</td>
                  <td className="p-4 text-sm">{item.category}</td>
                  <td className="p-4 text-sm">{item.form}</td>
                  <td className="p-4">
                    <span className={cn("font-heading font-bold", item.stock <= item.reorder ? "text-destructive" : "text-foreground")}>
                      {item.stock}
                    </span>
                    {item.stock <= item.reorder && <AlertTriangle className="inline h-3.5 w-3.5 text-destructive ml-1" />}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">{item.reorder}</td>
                  <td className="p-4 text-sm">₦{item.price.toLocaleString()}</td>
                  <td className="p-4 text-sm text-muted-foreground">{new Date(item.expiry).toLocaleDateString()}</td>
                  <td className="p-4"><Button variant="outline" size="sm">Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </HospitalLayout>
  );
}
