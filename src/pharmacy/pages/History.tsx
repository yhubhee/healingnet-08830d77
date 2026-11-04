import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { QueryState } from "@/components/common/QueryState";
import { fmtDateTime, useMyPharmacy } from "@/lib/pharmacy";

type Row = { id: string; pharmacist_name: string; pcn_reg_no: string; quantity: string | null; is_refill: boolean; dispensed_at: string; request_id: string | null };

export default function PharmacyHistory() {
  const { data: me } = useMyPharmacy();
  const pid = me?.pharmacy.id;
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data = [], isLoading, isError, error, refetch } = useQuery({
    enabled: !!pid,
    queryKey: ["pharmacy", "history", pid, from, to],
    queryFn: async () => {
      let query = supabase.from("rx_dispenses")
        .select("id, pharmacist_name, pcn_reg_no, quantity, is_refill, dispensed_at, request_id")
        .eq("pharmacy_id", pid!).order("dispensed_at", { ascending: false }).limit(500);
      if (from) query = query.gte("dispensed_at", new Date(from + "T00:00:00").toISOString());
      if (to) query = query.lte("dispensed_at", new Date(to + "T23:59:59").toISOString());
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    meta: { inlineError: true },
  });

  const term = q.trim().toLowerCase();
  const list = term ? data.filter((r) => `${r.pharmacist_name} ${r.pcn_reg_no} ${r.quantity ?? ""}`.toLowerCase().includes(term)) : data;

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="mb-1 font-heading text-2xl font-bold">Dispensing history</h1>
      <p className="mb-5 text-sm text-muted-foreground">Every medicine dispensed at this pharmacy, newest first.</p>
      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input className="pl-9" placeholder="Search pharmacist, PCN or quantity" aria-label="Search history" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      <QueryState isLoading={isLoading || !pid} isError={isError} error={error} onRetry={() => refetch()} isEmpty={list.length === 0} emptyMessage="Nothing dispensed yet.">
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {list.map((r) => (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 p-4 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{r.pharmacist_name} <span className="text-muted-foreground">· PCN {r.pcn_reg_no}</span></p>
                <p className="text-muted-foreground">
                  {r.quantity || "Quantity not given"}{r.is_refill ? " · refill" : ""}{r.request_id ? " · via HealingNet request" : ""}
                </p>
              </div>
              <time className="text-xs text-muted-foreground" dateTime={r.dispensed_at}>{fmtDateTime(r.dispensed_at)}</time>
            </li>
          ))}
        </ul>
      </QueryState>
    </div>
  );
}
