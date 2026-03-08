import { HospitalLayout } from "@/layouts/HospitalLayout";
import { cn } from "@/lib/utils";
import { Share2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useHospitalReferrals } from "@/hooks/useHospitalData";

const tabs = ["All", "Outgoing", "Incoming", "Internal"];
const urgencyColors: Record<string, string> = { routine: "bg-success/15 text-success", urgent: "bg-warning/15 text-warning", emergency: "bg-destructive/15 text-destructive" };
const statusColors: Record<string, string> = { pending: "bg-warning/15 text-warning", accepted: "bg-primary/15 text-primary", in_progress: "bg-info/15 text-info", completed: "bg-success/15 text-success", declined: "bg-destructive/15 text-destructive" };

export default function HospitalReferrals() {
  const { data: referrals = [], isLoading } = useHospitalReferrals();
  const [activeTab, setActiveTab] = useState("All");

  const filtered = activeTab === "All" ? referrals :
    activeTab === "Outgoing" ? referrals.filter((r: any) => r.referral_type === "external_outgoing") :
    activeTab === "Incoming" ? referrals.filter((r: any) => r.referral_type === "external_incoming") :
    referrals.filter((r: any) => r.referral_type === "internal");

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Referrals</h1>
        <p className="text-muted-foreground">Manage patient referrals — incoming, outgoing, and internal</p>
      </div>

      <div className="flex flex-wrap gap-1 mb-6">
        {tabs.map((t) => (
          <Button key={t} variant={activeTab === t ? "default" : "secondary"} size="sm" onClick={() => setActiveTab(t)}>{t}</Button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? <div className="p-8 text-center text-muted-foreground">Loading...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Patient", "From", "To", "Specialty", "Urgency", "Type", "Date", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No referrals</td></tr>
                ) : filtered.map((r: any) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                    <td className="p-4 font-medium">{r.patients?.first_name} {r.patients?.last_name}</td>
                    <td className="p-4 text-sm">{r.referring_doctor ? `Dr. ${r.referring_doctor.first_name} ${r.referring_doctor.last_name}` : "—"}</td>
                    <td className="p-4 text-sm">{r.referred_to_hospital || (r.referred_to_doctor ? `Dr. ${r.referred_to_doctor.first_name} ${r.referred_to_doctor.last_name}` : "—")}</td>
                    <td className="p-4 text-sm">{r.specialty || "—"}</td>
                    <td className="p-4"><span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", urgencyColors[r.urgency || "routine"])}>{r.urgency || "routine"}</span></td>
                    <td className="p-4">
                      {r.referral_type === "external_outgoing" ? <ArrowUpRight className="h-4 w-4 text-warning inline" /> :
                       r.referral_type === "external_incoming" ? <ArrowDownRight className="h-4 w-4 text-success inline" /> :
                       <Share2 className="h-4 w-4 text-primary inline" />}
                      <span className="text-sm ml-1">{(r.referral_type || "").replace(/_/g, " ").replace(/external /g, "")}</span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="p-4"><span className={cn("text-xs font-semibold px-3 py-1 rounded-full", statusColors[r.status || "pending"])}>{(r.status || "pending").replace(/_/g, " ")}</span></td>
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
