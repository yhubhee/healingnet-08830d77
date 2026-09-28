import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const sb = supabase as any;

function useSummary(patientId: string, consultationId: string) {
  return useQuery({
    queryKey: ["consultation", consultationId, "summary", patientId],
    queryFn: async () => {
      const [visits, labs, meds, imaging, docs] = await Promise.all([
        sb.from("consultations").select("id,started_at,submitted_at,provisional_diagnosis,final_diagnosis, consultation_history(chief_complaints)").eq("patient_id", patientId).neq("id", consultationId).not("submitted_at", "is", null).order("started_at", { ascending: false }).limit(10),
        sb.from("lab_results").select("id,created_at, lab_result_tests(test_name, lab_result_parameters(parameter_name,result_value,unit_snapshot,flag))").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(10),
        sb.from("prescriptions").select("id,drug_name,dosage,frequency,duration,created_at,status").eq("patient_id", patientId).order("created_at", { ascending: false }).limit(15),
        sb.from("diagnostic_requests").select("id,item_name,reported_at,report_text").eq("patient_id", patientId).not("reported_at", "is", null).order("reported_at", { ascending: false }).limit(10),
        sb.from("patient_letters").select("id,title,letter_type,issued_at").eq("patient_id", patientId).order("issued_at", { ascending: false }).limit(10),
      ]);
      return { visits: visits.data || [], labs: labs.data || [], meds: meds.data || [], imaging: imaging.data || [], docs: docs.data || [] };
    },
  });
}

export function PatientSummary({ patientId, consultationId }: { patientId: string; consultationId: string }) {
  const { data, isLoading, isError, refetch } = useSummary(patientId, consultationId);
  if (isLoading) return <div className="p-4 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading summary…</div>;
  if (isError || !data) return <div className="p-4 text-sm text-destructive">Couldn't load summary. <button className="underline" onClick={() => refetch()}>Try again</button></div>;

  // Latest value per parameter, with the previous value for a simple trend.
  const byParam = new Map<string, any[]>();
  for (const o of data.labs) for (const t of o.lab_result_tests || []) for (const p of t.lab_result_parameters || []) {
    if (!p.result_value) continue;
    const arr = byParam.get(p.parameter_name) || [];
    arr.push({ ...p, date: o.created_at });
    byParam.set(p.parameter_name, arr);
  }

  return (
    <Tabs defaultValue="visits" className="w-full">
      <TabsList className="w-full flex overflow-x-auto justify-start">
        <TabsTrigger value="visits">Visits</TabsTrigger>
        <TabsTrigger value="labs">Labs</TabsTrigger>
        <TabsTrigger value="meds">Meds</TabsTrigger>
        <TabsTrigger value="imaging">Imaging</TabsTrigger>
        <TabsTrigger value="docs">Docs</TabsTrigger>
      </TabsList>
      <div className="mt-3 text-sm">
        <TabsContent value="visits">
          <List empty="No previous visits." items={data.visits} render={(v: any) => (
            <a href={`/doctor/consultation/${v.id}`} className="block hover:text-primary">
              <div className="text-xs text-muted-foreground">{new Date(v.started_at).toLocaleDateString()}</div>
              <div className="capitalize">{(v.consultation_history?.chief_complaints || v.consultation_history?.[0]?.chief_complaints || []).map((c: any) => c.name).join(", ") || "—"}</div>
              <div className="text-xs">Dx: {v.final_diagnosis || v.provisional_diagnosis || "—"}</div>
            </a>
          )} />
        </TabsContent>
        <TabsContent value="labs">
          <List empty="No lab results." items={[...byParam.entries()].slice(0, 20)} render={([name, arr]: any) => {
            const [latest, prev] = arr; const f = (latest.flag || "").toLowerCase();
            const trend = prev && !isNaN(+latest.result_value) && !isNaN(+prev.result_value) ? (+latest.result_value > +prev.result_value ? "↑" : +latest.result_value < +prev.result_value ? "↓" : "→") : "";
            return (
              <div className="flex justify-between gap-2">
                <span className="truncate">{name}</span>
                <span className={cn("font-medium whitespace-nowrap", f.includes("critical") ? "text-destructive" : f === "high" || f === "low" ? "text-warning" : "")}>
                  {latest.result_value} {latest.unit_snapshot} {f === "high" ? "H" : f === "low" ? "L" : ""} {trend && <span className="text-muted-foreground" title={`Previous: ${prev.result_value}`}>{trend}</span>}
                </span>
              </div>
            );
          }} />
        </TabsContent>
        <TabsContent value="meds">
          <List empty="No prescriptions." items={data.meds} render={(m: any) => (
            <div><div>{m.drug_name}</div><div className="text-xs text-muted-foreground">{[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")} — {new Date(m.created_at).toLocaleDateString()}</div></div>
          )} />
        </TabsContent>
        <TabsContent value="imaging">
          <List empty="No imaging reports." items={data.imaging} render={(r: any) => (
            <div><div>{r.item_name}</div><div className="text-xs text-muted-foreground line-clamp-2">{r.report_text}</div></div>
          )} />
        </TabsContent>
        <TabsContent value="docs">
          <List empty="No documents." items={data.docs} render={(d: any) => (
            <div><div>{d.title}</div><div className="text-xs text-muted-foreground">{d.letter_type} · {d.issued_at}</div></div>
          )} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

function List({ items, render, empty }: { items: any[]; render: (i: any) => React.ReactNode; empty: string }) {
  if (!items.length) return <p className="text-muted-foreground">{empty}</p>;
  return <ul className="space-y-2 divide-y divide-border/50">{items.map((i, n) => <li key={n} className="pt-2 first:pt-0">{render(i)}</li>)}</ul>;
}
