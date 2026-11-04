import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QueryState } from "@/components/common/QueryState";
import { cn } from "@/lib/utils";
import { fmtDateTime, formatKobo, REQUEST_LABEL, useMyPharmacy, type RequestStatus, type RxRequest } from "@/lib/pharmacy";

const TABS: { id: "new" | "answered" | "done"; label: string; statuses: RequestStatus[] }[] = [
  { id: "new", label: "New", statuses: ["sent"] },
  { id: "answered", label: "Answered", statuses: ["available", "partial"] },
  { id: "done", label: "Done", statuses: ["collected", "unavailable", "cancelled"] },
];

export const REQUEST_TONE: Record<RequestStatus, string> = {
  sent: "bg-info/15 text-info",
  available: "bg-success/15 text-success",
  partial: "bg-warning/15 text-warning",
  unavailable: "bg-destructive/15 text-destructive",
  collected: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

export default function PharmacyRequests() {
  const { data: me } = useMyPharmacy();
  const pid = me?.pharmacy.id;
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.id === params.get("tab")) ?? TABS[0];

  // Kept live by the Realtime channel in PharmacyLayout (it invalidates ["pharmacy","requests"]) plus a 30 s refetch.
  const { data = [], isLoading, isError, error, refetch } = useQuery({
    enabled: !!pid,
    queryKey: ["pharmacy", "requests", "list", pid],
    queryFn: async () => {
      const { data, error } = await supabase.from("rx_pharmacy_requests").select("*").eq("pharmacy_id", pid!)
        .order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return (data ?? []) as RxRequest[];
    },
    refetchInterval: 30_000,
    meta: { inlineError: true },
  });

  const list = data.filter((r) => tab.statuses.includes(r.status));
  const count = (t: (typeof TABS)[number]) => data.filter((r) => t.statuses.includes(r.status)).length;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-1 font-heading text-2xl font-bold">Requests</h1>
      <p className="mb-5 text-sm text-muted-foreground">Prescriptions patients sent to you. Reply with stock, price and pickup time.</p>

      <div className="mb-4 grid grid-cols-3 gap-1 rounded-lg bg-muted/30 p-1" role="tablist" aria-label="Request status">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab.id === t.id} onClick={() => setParams({ tab: t.id }, { replace: true })}
            className={cn("min-h-10 rounded-md px-2 text-sm", tab.id === t.id ? "bg-card font-semibold shadow" : "text-muted-foreground")}>
            {t.label}{count(t) ? ` (${count(t)})` : ""}
          </button>
        ))}
      </div>

      <QueryState isLoading={isLoading || !pid} isError={isError} error={error} onRetry={() => refetch()} isEmpty={list.length === 0}
        emptyMessage={tab.id === "new" ? "No new requests. New ones appear here as patients send them." : "Nothing here yet."}>
        <ul className="space-y-2" role="tabpanel">
          {list.map((r) => (
            <li key={r.id}>
              <Link to={`/pharmacy/requests/${r.id}`} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50" data-testid="pharmacy-request-row">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", REQUEST_TONE[r.status])}>{REQUEST_LABEL[r.status]}</span>
                    <span className="text-xs text-muted-foreground">Sent {fmtDateTime(r.created_at)}</span>
                  </div>
                  {r.patient_note && <p className="mt-1 truncate text-sm">“{r.patient_note}”</p>}
                  {r.price_kobo !== null && <p className="mt-1 text-sm text-muted-foreground">{formatKobo(r.price_kobo)}{r.ready_by ? ` · ready ${fmtDateTime(r.ready_by)}` : ""}</p>}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}
