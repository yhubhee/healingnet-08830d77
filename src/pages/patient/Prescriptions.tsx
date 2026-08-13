import { PatientLayout } from "@/layouts/PatientLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Pill, RefreshCw, User, Loader2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildPrescriptionDocument, downloadReportPdf } from "@/lib/reports/documents";

export default function PatientPrescriptions() {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const { data, isLoading } = useQuery({
    queryKey: ["patient", "prescriptions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      console.log("🔍 PatientPrescriptions: Auth user:", user?.id);
      if (!user) {
        console.warn("⚠️ No auth user found");
        return [];
      }
      const { data: p, error: pError } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
      console.log("🔍 Patient lookup result:", { patient_id: p?.id, error: pError });
      if (!p) {
        console.warn("⚠️ No patient record found for user");
        return [];
      }
      const { data, error } = await supabase
        .from("prescriptions")
        .select("*, doctors(first_name,last_name)")
        .eq("patient_id", p.id)
        .order("created_at", { ascending: false });
      console.log("🔍 Prescriptions query result:", { count: data?.length, error, patient_id: p.id });
      if (error) console.error("❌ Prescriptions error:", error);
      return data || [];
    },
  });

  const list = (data || []).filter((r: any) => r.status === tab);

  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Prescriptions</h1>
        <p className="text-muted-foreground text-sm">All medications prescribed to you</p>
      </div>

      <div className="flex gap-1 mb-5 bg-muted/30 p-1 rounded-lg w-fit">
        {(["active", "completed"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-1.5 rounded-md text-sm capitalize", tab === t ? "bg-card text-foreground shadow" : "text-muted-foreground")}>{t}</button>
        ))}
      </div>

      {isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        list.length === 0 ? <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm"><Pill className="w-10 h-10 mx-auto mb-2" />No {tab} prescriptions.</div> :
        <div className="grid md:grid-cols-2 gap-4">
          {list.map((r: any) => {
            const refillsLeft = (r.refills_allowed || 0) - (r.refills_used || 0);
            return (
              <div key={r.id} className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-success/10 text-success flex items-center justify-center"><Pill className="w-5 h-5" /></div>
                  <div className="flex-1">
                    <h3 className="font-heading font-bold">{r.drug_name}</h3>
                    <p className="text-sm text-muted-foreground">{r.dosage} {r.frequency && `• ${r.frequency}`}</p>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", r.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{r.status}</span>
                </div>
                {r.instructions && <p className="text-sm mt-3 text-muted-foreground italic">"{r.instructions}"</p>}
                <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
                  <div><div className="text-muted-foreground">Duration</div><div className="font-medium">{r.duration || "—"}</div></div>
                  <div><div className="text-muted-foreground">Refills left</div><div className="font-medium">{refillsLeft}</div></div>
                  <div><div className="text-muted-foreground">Issued</div><div className="font-medium">{new Date(r.created_at).toLocaleDateString()}</div></div>
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3.5 h-3.5" />{r.doctors ? `Dr. ${r.doctors.first_name} ${r.doctors.last_name}` : "—"}</div>
                  <div className="flex items-center gap-3">
                    <button
                      className="text-sm text-primary inline-flex items-center gap-1"
                      onClick={() =>
                        downloadReportPdf(
                          buildPrescriptionDocument({
                            patientName: "You",
                            doctorName: r.doctors ? `${r.doctors.first_name} ${r.doctors.last_name}` : null,
                            issuedAt: r.created_at,
                            referenceId: r.id,
                            items: [r],
                          })
                        )
                      }
                    >
                      <Download className="w-3.5 h-3.5" />Report
                    </button>
                    {r.status === "active" && refillsLeft > 0 && <button className="text-sm text-primary inline-flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" />Request refill</button>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>}
    </PatientLayout>
  );
}
