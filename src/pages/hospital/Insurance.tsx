import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { ShieldCheck, CheckCircle, Clock, Building } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useInsuranceClaims } from "@/hooks/useHospitalData";

const tabs = ["Claims", "HMO Partners", "Verification"];

export default function HospitalInsurance() {
  const { data: claims = [], isLoading } = useInsuranceClaims();
  const [activeTab, setActiveTab] = useState("Claims");

  const totalClaims = claims.reduce((s: number, c: any) => s + Number(c.claim_amount), 0);
  const approved = claims.filter((c: any) => c.status === "approved" || c.status === "paid").reduce((s: number, c: any) => s + Number(c.approved_amount || c.claim_amount), 0);
  const pending = claims.filter((c: any) => c.status === "pending" || c.status === "under_review").reduce((s: number, c: any) => s + Number(c.claim_amount), 0);
  const providers = new Set(claims.map((c: any) => c.insurance_provider)).size;

  const stats = [
    { label: "Total Claims", value: `₦${(totalClaims / 1000000).toFixed(1)}M`, icon: ShieldCheck, gradient: "gradient-primary" },
    { label: "Approved", value: `₦${(approved / 1000000).toFixed(1)}M`, icon: CheckCircle, gradient: "gradient-success" },
    { label: "Pending", value: `₦${(pending / 1000000).toFixed(1)}M`, icon: Clock, gradient: "gradient-warning" },
    { label: "Providers", value: String(providers), icon: Building, gradient: "gradient-info" },
  ];

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
          {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> : (
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
                  {claims.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No claims</td></tr>
                  ) : claims.map((c: any) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                      <td className="p-4 font-medium">{c.patients?.first_name} {c.patients?.last_name}</td>
                      <td className="p-4 text-sm">{c.insurance_provider}</td>
                      <td className="p-4 text-sm">{c.service_description || "—"}</td>
                      <td className="p-4 font-heading font-bold">₦{Number(c.claim_amount).toLocaleString()}</td>
                      <td className="p-4 text-sm text-muted-foreground">{new Date(c.claim_date).toLocaleDateString()}</td>
                      <td className="p-4">
                        <span className={cn("text-xs font-semibold px-3 py-1 rounded-full",
                          c.status === "approved" || c.status === "paid" ? "bg-success/15 text-success" : c.status === "pending" ? "bg-warning/15 text-warning" : "bg-info/15 text-info"
                        )}>{(c.status || "draft").replace(/_/g, " ")}</span>
                      </td>
                      <td className="p-4"><Button variant="outline" size="sm">View</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "Verification" && (
        <div className="bg-card border border-border rounded-xl p-8 max-w-lg">
          <h3 className="text-lg font-heading font-bold mb-6">Insurance Verification</h3>
          <div className="space-y-4">
            <div><Label>Patient ID or Name</Label><Input placeholder="Search patient..." /></div>
            <div><Label>Insurance Provider</Label>
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
