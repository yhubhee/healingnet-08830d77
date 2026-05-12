import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Phone, Users, Loader2 } from "lucide-react";

export default function DoctorPatients() {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["doctor", "patients"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: doc } = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      if (!doc) return [];
      const { data: appts } = await supabase.from("patient_appointments").select("patient_id").eq("doctor_id", doc.id);
      const ids = Array.from(new Set((appts || []).map((a: any) => a.patient_id)));
      if (!ids.length) return [];
      const { data: ps } = await supabase.from("patients").select("*").in("id", ids);
      return ps || [];
    },
  });

  const list = (data || []).filter((p: any) =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <DoctorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">My Patients</h1>
        <p className="text-muted-foreground text-sm">{(data || []).length} patient{(data || []).length === 1 ? "" : "s"} under your care</p>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patients..." className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm outline-none" />
      </div>

      {isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        list.length === 0 ? <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm"><Users className="w-10 h-10 mx-auto mb-2" />No patients yet.</div> :
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className="text-left p-3">Patient</th><th className="text-left p-3">Phone</th><th className="text-left p-3">Genotype</th><th className="text-left p-3">Blood</th></tr></thead>
            <tbody>
              {list.map((p: any) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground flex items-center justify-center font-bold text-sm">{p.first_name?.[0]}</div>
                      <div><div className="font-medium text-sm">{p.first_name} {p.last_name}</div><div className="text-xs text-muted-foreground">{p.gender || "—"}</div></div>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{p.phone || "—"}</span></td>
                  <td className="p-3 text-sm">{p.genotype || "—"}</td>
                  <td className="p-3 text-sm">{p.blood_group || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>}
    </DoctorLayout>
  );
}
