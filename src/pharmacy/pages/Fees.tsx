import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { QueryState } from "@/components/common/QueryState";
import { cn } from "@/lib/utils";
import { fmtDate, formatKobo, useMyPharmacy } from "@/lib/pharmacy";

type Fee = { id: string; request_id: string; amount_kobo: number; status: "accrued" | "waived" | "invoiced" | "paid"; note: string | null; created_at: string };

const TONE: Record<Fee["status"], string> = {
  accrued: "bg-warning/15 text-warning",
  waived: "bg-muted text-muted-foreground",
  invoiced: "bg-info/15 text-info",
  paid: "bg-success/15 text-success",
};
const LABEL: Record<Fee["status"], string> = { accrued: "Owed", waived: "Waived", invoiced: "Invoiced", paid: "Paid" };

const monthKey = (d: string) => d.slice(0, 7);
const monthLabel = (k: string) => new Date(k + "-01T00:00:00").toLocaleDateString("en-NG", { month: "long", year: "numeric" });

export default function PharmacyFees() {
  const { data: me } = useMyPharmacy();
  const pid = me?.pharmacy.id;
  const { data = [], isLoading, isError, error, refetch } = useQuery({
    enabled: !!pid,
    queryKey: ["pharmacy", "fees", pid],
    queryFn: async () => {
      const { data, error } = await supabase.from("pharmacy_fees").select("id, request_id, amount_kobo, status, note, created_at")
        .eq("pharmacy_id", pid!).order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return (data ?? []) as Fee[];
    },
    meta: { inlineError: true },
  });

  const allFree = data.length > 0 && data.every((f) => f.status === "waived" && Number(f.amount_kobo) === 0);
  const months = [...new Set(data.map((f) => monthKey(f.created_at)))];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="mb-1 font-heading text-2xl font-bold">Fees</h1>
        <p className="text-sm text-muted-foreground">One row for each patient who collected a prescription they sent you through HealingNet. HealingNet never takes payment for medicine.</p>
      </div>
      {(allFree || data.length === 0) && !isLoading && (
        <p className="rounded-xl border border-success/40 bg-success/10 p-4 text-sm" data-testid="fees-free">HealingNet is free while we launch. Patients sent to you are recorded here.</p>
      )}
      <QueryState isLoading={isLoading || !pid} isError={isError} error={error} onRetry={() => refetch()} isEmpty={data.length === 0} emptyMessage="No patients collected through HealingNet yet.">
        <div className="space-y-5">
          {months.map((m) => {
            const rows = data.filter((f) => monthKey(f.created_at) === m);
            const owed = rows.filter((f) => f.status === "accrued").reduce((s, f) => s + Number(f.amount_kobo), 0);
            return (
              <section key={m}>
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-heading font-bold">{monthLabel(m)}</h2>
                  <p className="text-sm text-muted-foreground">{rows.length} patient{rows.length === 1 ? "" : "s"} · owed {formatKobo(owed)}</p>
                </div>
                <ul className="divide-y divide-border rounded-xl border border-border bg-card" data-testid="fee-rows">
                  {rows.map((f) => (
                    <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                      <span className="text-muted-foreground">{fmtDate(f.created_at)}</span>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{formatKobo(f.amount_kobo)}</span>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", TONE[f.status])}>{LABEL[f.status]}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </QueryState>
    </div>
  );
}
