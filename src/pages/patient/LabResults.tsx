import { PatientLayout } from "@/layouts/PatientLayout";
import { useState } from "react";
import { mockPatientLabResults } from "@/lib/mockData";
import { ChevronDown, FlaskConical, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PatientLabResults() {
  const [open, setOpen] = useState<string | null>(mockPatientLabResults[0]?.id || null);
  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Lab Results</h1>
        <p className="text-muted-foreground text-sm">All tests requested by your doctors</p>
      </div>

      <div className="space-y-3">
        {mockPatientLabResults.map((l) => {
          const expanded = open === l.id;
          return (
            <div key={l.id} className="bg-card border border-border rounded-xl overflow-hidden">
              <button onClick={() => setOpen(expanded ? null : l.id)} className="w-full flex items-center justify-between p-5 hover:bg-muted/20 transition">
                <div className="flex items-center gap-3 text-left">
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", l.abnormal ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>
                    <FlaskConical className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-heading font-bold">{l.name}</h3>
                    <p className="text-xs text-muted-foreground">{l.date} • {l.hospital} • Ordered by {l.orderedBy}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", l.abnormal ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success")}>
                    {l.abnormal ? "Review needed" : "Normal"}
                  </span>
                  <ChevronDown className={cn("w-4 h-4 transition", expanded && "rotate-180")} />
                </div>
              </button>
              {expanded && (
                <div className="border-t border-border p-5 bg-muted/10">
                  <table className="w-full text-sm">
                    <thead><tr className="text-xs text-muted-foreground text-left"><th className="pb-2">Test</th><th className="pb-2">Result</th><th className="pb-2">Range</th><th className="pb-2">Flag</th></tr></thead>
                    <tbody>
                      {l.tests.map((t, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="py-2">{t.name}</td>
                          <td className="py-2 font-medium">{t.value} {t.unit}</td>
                          <td className="py-2 text-muted-foreground">{t.range}</td>
                          <td className="py-2"><span className={cn("text-xs px-2 py-0.5 rounded-full", t.abnormal ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success")}>{t.abnormal ? "Abnormal" : "Normal"}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary"><Download className="w-4 h-4" />Download PDF</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </PatientLayout>
  );
}
