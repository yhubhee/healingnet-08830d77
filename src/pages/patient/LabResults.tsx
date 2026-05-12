import { PatientLayout } from "@/layouts/PatientLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, FlaskConical, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PatientLabResults() {
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["patient", "labs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: p } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
      if (!p) return [];
      const { data: results } = await supabase.from("lab_results").select("*, hospitals(name)").eq("patient_id", p.id).order("created_at", { ascending: false });
      const ids = (results || []).map((r: any) => r.id);
      const { data: tests } = ids.length ? await supabase.from("lab_result_tests").select("*").in("lab_result_id", ids) : { data: [] as any[] };
      return (results || []).map((r: any) => ({ ...r, tests: (tests || []).filter((t: any) => t.lab_result_id === r.id) }));
    },
  });

  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Lab Results</h1>
        <p className="text-muted-foreground text-sm">All tests requested by your doctors</p>
      </div>

      {isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        (data || []).length === 0 ? <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm"><FlaskConical className="w-10 h-10 mx-auto mb-2" />No lab results yet.</div> :
        <div className="space-y-3">
          {(data || []).map((l: any) => {
            const expanded = open === l.id;
            const abnormal = l.tests.some((t: any) => t.is_abnormal);
            return (
              <div key={l.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button onClick={() => setOpen(expanded ? null : l.id)} className="w-full flex items-center justify-between p-5 hover:bg-muted/20 transition">
                  <div className="flex items-center gap-3 text-left">
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", abnormal ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>
                      <FlaskConical className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold">Lab order #{l.id.slice(0, 8)}</h3>
                      <p className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleDateString()} • {l.hospitals?.name || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", abnormal ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success")}>
                      {l.status === "completed" ? (abnormal ? "Review needed" : "Normal") : l.status}
                    </span>
                    <ChevronDown className={cn("w-4 h-4 transition", expanded && "rotate-180")} />
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-border p-5 bg-muted/10">
                    {l.tests.length === 0 ? <p className="text-sm text-muted-foreground">No test entries yet.</p> :
                      <table className="w-full text-sm">
                        <thead><tr className="text-xs text-muted-foreground text-left"><th className="pb-2">Test</th><th className="pb-2">Result</th><th className="pb-2">Range</th><th className="pb-2">Flag</th></tr></thead>
                        <tbody>
                          {l.tests.map((t: any) => (
                            <tr key={t.id} className="border-t border-border/50">
                              <td className="py-2">{t.test_name}</td>
                              <td className="py-2 font-medium">{t.result_value} {t.unit}</td>
                              <td className="py-2 text-muted-foreground">{t.reference_range || "—"}</td>
                              <td className="py-2"><span className={cn("text-xs px-2 py-0.5 rounded-full", t.is_abnormal ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success")}>{t.is_abnormal ? "Abnormal" : "Normal"}</span></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>}
                  </div>
                )}
              </div>
            );
          })}
        </div>}
    </PatientLayout>
  );
}
