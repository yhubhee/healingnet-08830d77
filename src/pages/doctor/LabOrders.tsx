import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FlaskConical, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DoctorLabOrders() {
  const [tab, setTab] = useState<"pending" | "completed">("pending");
  const { data, isLoading } = useQuery({
    queryKey: ["doctor", "labs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: doc } = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      if (!doc) return [];
      const { data } = await supabase.from("lab_results").select("*, patients(first_name,last_name)").eq("ordered_by", doc.id).order("created_at", { ascending: false });
      return data || [];
    },
  });
  const list = (data || []).filter((o: any) => tab === "pending" ? o.status !== "completed" : o.status === "completed");

  return (
    <DoctorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Lab Orders</h1>
        <p className="text-muted-foreground text-sm">Tests you've ordered for patients</p>
      </div>

      <div className="flex gap-1 mb-5 bg-muted/30 p-1 rounded-lg w-fit">
        {(["pending", "completed"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-1.5 rounded-md text-sm capitalize", tab === t ? "bg-card shadow" : "text-muted-foreground")}>{t}</button>)}
      </div>

      {isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        list.length === 0 ? <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm"><FlaskConical className="w-10 h-10 mx-auto mb-2" />No {tab} lab orders.</div> :
        <div className="space-y-3">
          {list.map((o: any) => (
            <div key={o.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 flex-wrap">
              <div className="w-11 h-11 rounded-xl bg-warning/10 text-warning flex items-center justify-center"><FlaskConical className="w-5 h-5" /></div>
              <div className="flex-1 min-w-[200px]">
                <div className="font-heading font-bold">Lab order #{o.id.slice(0, 8)}</div>
                <div className="text-xs text-muted-foreground">{o.patients ? `${o.patients.first_name} ${o.patients.last_name}` : "Patient"} • Ordered {new Date(o.created_at).toLocaleDateString()}</div>
              </div>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", o.status === "completed" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{o.status}</span>
            </div>
          ))}
        </div>}
    </DoctorLayout>
  );
}
