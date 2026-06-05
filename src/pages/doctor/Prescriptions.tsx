import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pill, Loader2, Search, MoreHorizontal, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NewPrescriptionDialog } from "@/components/doctor/NewPrescriptionDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useDoctor } from "@/hooks/useDoctor";

const tabs = ["all", "active", "completed", "cancelled"] as const;

export default function DoctorPrescriptions() {
  const [tab, setTab] = useState<typeof tabs[number]>("all");
  const [q, setQ] = useState("");
  const qc = useQueryClient();
  const { data: ctx } = useDoctor();
  const { data, isLoading } = useQuery({
    enabled: !!ctx?.doctor?.id,
    queryKey: ["doctor", "prescriptions", ctx?.doctor?.id],
    queryFn: async () => {
      const { data } = await supabase.from("prescriptions").select("*, patients(first_name,last_name)").eq("doctor_id", ctx!.doctor.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const list = (data || []).filter((r: any) => {
    if (tab !== "all" && r.status !== tab) return false;
    if (q && !`${r.drug_name} ${r.patients?.first_name || ""} ${r.patients?.last_name || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  async function discontinue(id: string) {
    const { error } = await supabase.from("prescriptions").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Discontinued");
    qc.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
  }
  async function renew(r: any) {
    const { error } = await supabase.from("prescriptions").insert({
      patient_id: r.patient_id, doctor_id: r.doctor_id, hospital_id: r.hospital_id,
      drug_name: r.drug_name, dosage: r.dosage, frequency: r.frequency, duration: r.duration,
      instructions: r.instructions, refills_allowed: r.refills_allowed, status: "active",
    });
    if (error) return toast.error(error.message);
    toast.success("Renewed");
    qc.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
  }

  return (
    <DoctorLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-2xl font-heading font-bold">Prescriptions</h1><p className="text-muted-foreground text-sm">All prescriptions you've issued</p></div>
        <NewPrescriptionDialog trigger={<Button><Plus className="w-4 h-4" />New prescription</Button>} />
      </div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex gap-1 bg-muted/30 p-1 rounded-lg">
          {tabs.map((t) => <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-1.5 rounded-md text-sm capitalize", tab === t ? "bg-card shadow" : "text-muted-foreground")}>{t}</button>)}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search drug or patient..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        list.length === 0 ? <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm"><Pill className="w-10 h-10 mx-auto mb-2" />No prescriptions yet.</div> :
        <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className="text-left p-3">Drug</th><th className="text-left p-3">Patient</th><th className="text-left p-3">Frequency</th><th className="text-left p-3">Duration</th><th className="text-left p-3">Date</th><th className="text-left p-3">Status</th><th /></tr></thead>
            <tbody>
              {list.map((r: any) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center"><Pill className="w-4 h-4" /></div><span className="font-medium text-sm">{r.drug_name}</span></div></td>
                  <td className="p-3 text-sm">{r.patients ? `${r.patients.first_name} ${r.patients.last_name}` : "—"}</td>
                  <td className="p-3 text-sm text-muted-foreground">{r.frequency || "—"}</td>
                  <td className="p-3 text-sm text-muted-foreground">{r.duration || "—"}</td>
                  <td className="p-3 text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-3"><span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", r.status === "active" ? "bg-success/15 text-success" : r.status === "cancelled" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}>{r.status}</span></td>
                  <td className="p-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => renew(r)}>Renew</DropdownMenuItem>
                        {r.status === "active" && <DropdownMenuItem onClick={() => discontinue(r.id)}>Discontinue</DropdownMenuItem>}
                        <DropdownMenuItem onClick={() => window.print()}>Print</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </DoctorLayout>
  );
}
