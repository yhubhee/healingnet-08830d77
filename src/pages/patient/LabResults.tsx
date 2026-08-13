import { PatientLayout } from "@/layouts/PatientLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronDown, FlaskConical, Loader2, Download, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { buildLabReportDocument, downloadReportPdf, printReport } from "@/lib/reports/documents";

export default function PatientLabResults() {
  const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["patient", "labs"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: p } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
      if (!p) return [];
      const { data: results } = await supabase.from("lab_results").select("*, hospitals(name), lab_result_tests(*, lab_result_parameters(*))").eq("patient_id", p.id).order("created_at", { ascending: false });
      return (results || []).map((r: any) => {
        const tests: any[] = r.lab_result_tests || [];
        const params = tests.flatMap((t: any) => (t.lab_result_parameters || []).map((pp: any) => ({
          id: pp.id,
          test_name: pp.parameter_name,
          parent_test: t.test_name,
          result_value: pp.result_value,
          unit: pp.unit_snapshot,
          reference_range: pp.ref_range_snapshot,
          flag: pp.flag,
          is_abnormal: pp.flag === "low" || pp.flag === "high" || pp.flag === "abnormal",
          sort_order: pp.sort_order,
        })));
        return { ...r, tests: params };
      });
    },
  });

  const buildDoc = (l: any) =>
    buildLabReportDocument({
      hospitalName: l.hospitals?.name,
      patientName: "You",
      orderId: l.id,
      createdAt: l.created_at,
      notes: l.notes,
      tests: (l.lab_result_tests || []).map((t: any) => ({
        test_name: t.test_name,
        category_name: t.category_name,
        parameters: (t.lab_result_parameters || []).map((p: any) => ({
          parameter_name: p.parameter_name,
          result_value: p.result_value,
          unit_snapshot: p.unit_snapshot,
          ref_range_snapshot: p.ref_range_snapshot,
          flag: p.flag,
        })),
      })),
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
                    {l.tests.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button size="sm" variant="outline" onClick={() => downloadReportPdf(buildDoc(l))}>
                          <Download className="w-4 h-4 mr-2" />Download report
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => printReport(buildDoc(l))}>
                          <Printer className="w-4 h-4 mr-2" />Print
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>}
    </PatientLayout>
  );
}
