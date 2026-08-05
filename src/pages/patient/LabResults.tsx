import { PatientLayout } from "@/layouts/PatientLayout";
import { useState } from "react";
import { ChevronDown, FlaskConical, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePatientProfile } from "@/hooks/usePatientData";
import { usePatientLabOrders } from "@/api/hooks/useLab";

export default function PatientLabResults() {
  const [open, setOpen] = useState<string | null>(null);
  const { data: profile } = usePatientProfile();
  const { data: orders = [], isLoading } = usePatientLabOrders(profile?.id);

  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Lab Results</h1>
        <p className="text-muted-foreground text-sm">All tests requested by your doctors</p>
      </div>

      {isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        orders.length === 0 ? <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm"><FlaskConical className="w-10 h-10 mx-auto mb-2" />No lab results yet.</div> :
        <div className="space-y-3">
          {orders.map((l) => {
            const expanded = open === l.id;
            const rows = l.tests.flatMap((t) => t.parameters.map((p) => ({ ...p, parentTest: t.name })));
            return (
              <div key={l.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button onClick={() => setOpen(expanded ? null : l.id)} className="w-full flex items-center justify-between p-5 hover:bg-muted/20 transition">
                  <div className="flex items-center gap-3 text-left">
                    <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", l.hasAbnormal ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>
                      <FlaskConical className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-heading font-bold">Lab order #{l.id.slice(0, 8)}</h3>
                      <p className="text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleDateString()} • {l.hospitalName || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", l.hasAbnormal ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success")}>
                      {l.status === "completed" ? (l.hasAbnormal ? "Review needed" : "Normal") : l.status}
                    </span>
                    <ChevronDown className={cn("w-4 h-4 transition", expanded && "rotate-180")} />
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-border p-5 bg-muted/10 space-y-4">
                    {l.tests.length === 0 ? <p className="text-sm text-muted-foreground">No test entries yet.</p> : l.tests.map((t) => (
                      <div key={t.id}>
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-semibold">{t.name}</h4>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", t.status === "completed" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{t.status}</span>
                        </div>
                        {t.parameters.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Awaiting results.</p>
                        ) : (
                          <table className="w-full text-sm">
                            <thead><tr className="text-xs text-muted-foreground text-left"><th className="pb-2">Parameter</th><th className="pb-2">Result</th><th className="pb-2">Range</th><th className="pb-2">Flag</th></tr></thead>
                            <tbody>
                              {t.parameters.map((p) => (
                                <tr key={p.id} className="border-t border-border/50">
                                  <td className="py-2">{p.name}</td>
                                  <td className="py-2 font-medium">{p.resultValue || "—"} {p.unit || ""}</td>
                                  <td className="py-2 text-muted-foreground">{p.referenceRange || "—"}</td>
                                  <td className="py-2"><span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", p.isAbnormal ? "bg-destructive/15 text-destructive" : p.flag === "normal" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{p.flag === "unknown" ? "—" : p.flag}</span></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    ))}
                    {rows.length === 0 && l.tests.length > 0 && <p className="text-xs text-muted-foreground">Results have not been entered yet.</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>}
    </PatientLayout>
  );
}
