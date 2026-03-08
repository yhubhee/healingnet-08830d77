import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { ShieldCheck, CheckCircle, Clock, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

const stats = [
  { label: "Insured Patients", value: "578", icon: ShieldCheck, gradient: "gradient-primary" },
  { label: "Claims Approved", value: "₦4.2M", icon: CheckCircle, gradient: "gradient-success" },
  { label: "Pending Claims", value: "₦1.8M", icon: Clock, gradient: "gradient-warning" },
  { label: "HMO Partners", value: "6", icon: Building, gradient: "gradient-info" },
];

const tabs = ["Claims", "HMO Partners", "Verification"];

const mockClaims = [
  { id: 1, patient: "Amara Obi", provider: "NHIS", service: "General Consultation", amount: 15000, date: "2026-03-08", status: "approved" },
  { id: 2, patient: "Chidi Nwosu", provider: "AXA Mansard", service: "Lab Tests", amount: 35000, date: "2026-03-07", status: "pending" },
  { id: 3, patient: "Emeka Eze", provider: "Hygeia", service: "Surgery", amount: 450000, date: "2026-03-05", status: "under_review" },
  { id: 4, patient: "Ngozi Adamu", provider: "Leadway", service: "Pharmacy", amount: 12000, date: "2026-03-04", status: "paid" },
];

const hmoPartners = [
  { name: "NHIS", description: "National Health Insurance Scheme", coverage: "Comprehensive", patients: 245 },
  { name: "AXA Mansard", description: "Private Health Insurance", coverage: "Premium", patients: 128 },
  { name: "Hygeia HMO", description: "Health Maintenance Organization", coverage: "Standard", patients: 98 },
];

export default function HospitalInsurance() {
  const [activeTab, setActiveTab] = useState("Claims");

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Insurance & HMO</h1>
        <p className="text-muted-foreground">Manage insurance claims, HMO partnerships, and patient coverage</p>
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

      {activeTab === "Claims" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Patient", "Provider", "Service", "Amount", "Date", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockClaims.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                    <td className="p-4 font-medium">{c.patient}</td>
                    <td className="p-4 text-sm">{c.provider}</td>
                    <td className="p-4 text-sm">{c.service}</td>
                    <td className="p-4 font-heading font-bold">₦{c.amount.toLocaleString()}</td>
                    <td className="p-4 text-sm text-muted-foreground">{new Date(c.date).toLocaleDateString()}</td>
                    <td className="p-4">
                      <span className={cn("text-xs font-semibold px-3 py-1 rounded-full",
                        c.status === "approved" || c.status === "paid" ? "bg-success/15 text-success" : c.status === "pending" ? "bg-warning/15 text-warning" : "bg-info/15 text-info"
                      )}>{c.status.replace(/_/g, " ")}</span>
                    </td>
                    <td className="p-4"><Button variant="outline" size="sm">View</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "HMO Partners" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {hmoPartners.map((p) => (
            <div key={p.name} className="bg-card border border-border rounded-xl p-5 hover:border-primary transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full gradient-info flex items-center justify-center font-bold text-foreground">
                  {p.name.slice(0, 2)}
                </div>
                <div>
                  <h3 className="font-heading font-bold">{p.name}</h3>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                </div>
              </div>
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>Coverage: {p.coverage}</span>
                <span>Patients: {p.patients}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === "Verification" && (
        <div className="bg-card border border-border rounded-xl p-8 max-w-lg">
          <h3 className="text-lg font-heading font-bold mb-6">Insurance Verification</h3>
          <div className="space-y-4">
            <div><Label>Patient ID or Name</Label><Input placeholder="Search patient..." /></div>
            <div>
              <Label>Insurance Provider</Label>
              <Select><SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nhis">NHIS</SelectItem>
                  <SelectItem value="axa">AXA Mansard</SelectItem>
                  <SelectItem value="hygeia">Hygeia</SelectItem>
                  <SelectItem value="leadway">Leadway</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Policy Number</Label><Input placeholder="Enter policy number..." /></div>
            <Button className="w-full">Verify Coverage</Button>
          </div>
        </div>
      )}
    </HospitalLayout>
  );
}
