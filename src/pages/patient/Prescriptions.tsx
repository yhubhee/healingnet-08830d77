import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PatientLayout } from "@/layouts/PatientLayout";
import { supabase } from "@/integrations/supabase/client";
import { QueryState } from "@/components/common/QueryState";
import { usePatientProfile } from "@/hooks/usePatientData";
import { cn } from "@/lib/utils";
import type { RxPayload } from "@/lib/pharmacy";
import { RxCard, type PatientRequest } from "@/components/patient/rx/RxCard";
import type { CheckResult } from "@/components/patient/rx/MedicineCheck";

// The most recent prescription documents loaded on this page.
const MAX_DOCS = 40;

export default function PatientPrescriptions() {
  const qc = useQueryClient();
  const { data: profile } = usePatientProfile();
  const pid = profile?.id as string | undefined;
  const [tab, setTab] = useState<"current" | "all">("all");

  // Each prescription row belongs to a document; load each document's full view (status, items, dispenses).
  const docs = useQuery({
    enabled: !!pid,
    queryKey: ["patient", "rx-documents", pid],
    queryFn: async () => {
      const { data, error } = await supabase.from("prescriptions").select("rx_document_id, created_at")
        .eq("patient_id", pid!).not("rx_document_id", "is", null).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      const ids = [...new Set((data ?? []).map((r) => r.rx_document_id as string))].slice(0, MAX_DOCS);
      const out = await Promise.all(ids.map(async (id) => {
        const { data, error } = await supabase.rpc("rx_document", { p_document_id: id });
        if (error) throw error;
        return data as unknown as RxPayload;
      }));
      return out.filter((d) => d && d.status !== "not_found")
        .sort((a, b) => +new Date(b.issued_at ?? 0) - +new Date(a.issued_at ?? 0));
    },
  });

  const extras = useQuery({
    enabled: !!pid,
    queryKey: ["patient", "rx-requests", pid],
    queryFn: async () => {
      const [req, rev, chk] = await Promise.all([
        supabase.from("rx_pharmacy_requests").select("*, pharmacies(name)").eq("patient_id", pid!).order("created_at", { ascending: false }).limit(300),
        supabase.from("pharmacy_reviews").select("request_id, rating").eq("patient_id", pid!),
        supabase.from("medicine_checks").select("prescription_id, result, created_at").eq("patient_id", pid!).order("created_at", { ascending: false }).limit(500),
      ]);
      const e = req.error || rev.error || chk.error;
      if (e) throw e;
      const reviews: Record<string, number> = {};
      (rev.data ?? []).forEach((r) => { reviews[r.request_id] = r.rating; });
      const checks: Record<string, CheckResult> = {};
      (chk.data ?? []).forEach((c) => { if (c.prescription_id && !checks[c.prescription_id]) checks[c.prescription_id] = c.result as CheckResult; });
      return { requests: (req.data ?? []) as unknown as PatientRequest[], reviews, checks };
    },
  });

  // Live: pharmacy replies and collections.
  useEffect(() => {
    if (!pid) return;
    const ch = supabase
      .channel(`patient-rx-requests-${pid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rx_pharmacy_requests", filter: `patient_id=eq.${pid}` }, () => {
        qc.invalidateQueries({ queryKey: ["patient", "rx-requests"] });
        qc.invalidateQueries({ queryKey: ["patient", "rx-documents"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [pid, qc]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["patient", "rx-requests"] });
    qc.invalidateQueries({ queryKey: ["patient", "rx-documents"] });
  };

  const all = docs.data ?? [];
  const list = useMemo(() => (tab === "current" ? all.filter((d) => d.status === "valid") : all), [all, tab]);
  const byDoc = (id?: string) => (extras.data?.requests ?? []).filter((r) => r.rx_document_id === id);

  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Prescriptions</h1>
        <p className="text-muted-foreground text-sm">Show the code or QR at any HealingNet pharmacy, or send it to one near you. You pay at the counter.</p>
      </div>

      <div className="mb-5 flex w-fit gap-1 rounded-lg bg-muted/30 p-1">
        {([["all", "All"], ["current", "Valid now"]] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} className={cn("min-h-9 rounded-md px-4 py-1.5 text-sm", tab === t ? "bg-card text-foreground shadow" : "text-muted-foreground")}>{label}</button>
        ))}
      </div>

      <QueryState isLoading={docs.isLoading || !profile} isError={docs.isError} error={docs.error} onRetry={() => docs.refetch()}
        isEmpty={list.length === 0} emptyMessage={tab === "current" ? "No valid prescriptions right now. See All for older ones." : "No prescriptions yet."}>
        <div className="grid gap-4 xl:grid-cols-2">
          {list.map((d) => (
            <RxCard key={d.document_id} doc={d} requests={byDoc(d.document_id)} reviews={extras.data?.reviews ?? {}}
              checks={extras.data?.checks ?? {}} profile={profile} onChanged={refresh} />
          ))}
        </div>
      </QueryState>
    </PatientLayout>
  );
}
