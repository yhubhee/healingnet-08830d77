import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pill, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DoctorPrescriptions() {
  const { data, isLoading } = useQuery({
    queryKey: ["doctor", "prescriptions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: doc } = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      if (!doc) return [];
      const { data } = await supabase.from("prescriptions").select("*, patients(first_name,last_name)").eq("doctor_id", doc.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <DoctorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Prescriptions</h1>
        <p className="text-muted-foreground text-sm">All prescriptions you've issued</p>
      </div>

      {isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        (data || []).length === 0 ? <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm"><Pill className="w-10 h-10 mx-auto mb-2" />No prescriptions yet.</div> :
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className="text-left p-3">Drug</th><th className="text-left p-3">Patient</th><th className="text-left p-3">Frequency</th><th className="text-left p-3">Duration</th><th className="text-left p-3">Date</th><th className="text-left p-3">Status</th></tr></thead>
            <tbody>
              {(data || []).map((r: any) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center"><Pill className="w-4 h-4" /></div><span className="font-medium text-sm">{r.drug_name}</span></div></td>
                  <td className="p-3 text-sm">{r.patients ? `${r.patients.first_name} ${r.patients.last_name}` : "—"}</td>
                  <td className="p-3 text-sm text-muted-foreground">{r.frequency || "—"}</td>
                  <td className="p-3 text-sm text-muted-foreground">{r.duration || "—"}</td>
                  <td className="p-3 text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                  <td className="p-3"><span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", r.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </DoctorLayout>
  );
}
