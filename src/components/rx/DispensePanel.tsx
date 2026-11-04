import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { notDispensableReason, useMyPharmacy, type RxPayload } from "@/lib/pharmacy";

type Pick = { on: boolean; qty: string };

/**
 * Dispense screen: tick medicines, give quantities, confirm the patient's ID, record.
 * The pharmacist's name and PCN number are recorded by the database, not typed here.
 */
export function DispensePanel({ code, doc, onDispensed }: { code: string; doc: RxPayload; onDispensed?: (doc: RxPayload) => void }) {
  const qc = useQueryClient();
  const { data: me } = useMyPharmacy();
  const items = useMemo(() => doc.items ?? [], [doc.items]);
  const initial = useMemo(() => Object.fromEntries(items.map((it) => [it.prescription_id, { on: it.dispensable, qty: "" }])) as Record<string, Pick>, [items]);
  const [picks, setPicks] = useState<Record<string, Pick>>(initial);
  const [idOk, setIdOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { setPicks(initial); setIdOk(false); }, [initial]);

  const chosen = items.filter((it) => it.dispensable && picks[it.prescription_id]?.on);
  const patientName = doc.patient?.name || "the patient";
  const canDispense = !!me?.member.can_dispense;

  async function dispense() {
    setErr(null);
    setBusy(true);
    const { data, error } = await supabase.rpc("rx_dispense", {
      p_code: code,
      p_items: chosen.map((it) => ({ prescription_id: it.prescription_id, quantity: picks[it.prescription_id]?.qty.trim() || null })),
    });
    setBusy(false);
    if (error) {
      const m = friendlyError(error);
      setErr(m);
      toast.error(m);
      return;
    }
    const m = me?.member;
    const msg = `Dispensed. Recorded under ${[m?.first_name, m?.last_name].filter(Boolean).join(" ") || "you"}, PCN ${m?.pcn_reg_no ?? "on file"}.`;
    setDone(msg);
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["pharmacy"] });
    const next = (data as { document?: RxPayload } | null)?.document;
    if (next) onDispensed?.(next);
  }

  if (!canDispense) {
    return (
      <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
        {me?.member.role === "assistant"
          ? "Assistants can't dispense. Ask a verified pharmacist to dispense this prescription."
          : "You can't dispense yet. A verified pharmacist with an in-date licence, at a verified pharmacy, can dispense."}
      </p>
    );
  }

  return (
    <section className="space-y-4 rounded-xl border-2 border-primary/40 bg-card p-4" aria-labelledby="dispense-title">
      <h3 id="dispense-title" className="font-heading text-lg font-bold">Dispense</h3>
      {done && (
        <p className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 p-3 text-sm font-medium text-success" role="status" data-testid="dispense-success">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{done}
        </p>
      )}
      <ul className="space-y-2">
        {items.map((it) => {
          const pick = picks[it.prescription_id] ?? { on: false, qty: "" };
          const id = `disp-${it.prescription_id}`;
          return (
            <li key={it.prescription_id} className={cn("rounded-lg border border-border p-3", !it.dispensable && "opacity-60")}>
              <div className="flex items-start gap-3">
                <input id={id} type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-primary" disabled={!it.dispensable}
                  checked={it.dispensable && pick.on}
                  onChange={(e) => setPicks((p) => ({ ...p, [it.prescription_id]: { ...pick, on: e.target.checked } }))} />
                <label htmlFor={id} className="min-w-0 flex-1">
                  <span className="block font-medium">{it.drug_name}{it.times_dispensed > 0 && it.dispensable ? " (refill)" : ""}</span>
                  <span className="block text-xs text-muted-foreground">{[it.dosage, it.frequency, it.duration].filter(Boolean).join(" · ")}</span>
                  {!it.dispensable && <span className="block text-xs font-medium text-warning">{notDispensableReason(it)}</span>}
                </label>
              </div>
              {it.dispensable && pick.on && (
                <Input className="mt-2" aria-label={`Quantity of ${it.drug_name}`} placeholder="Quantity, e.g. 2 packs" maxLength={60}
                  value={pick.qty} onChange={(e) => setPicks((p) => ({ ...p, [it.prescription_id]: { ...pick, qty: e.target.value } }))} />
              )}
            </li>
          );
        })}
      </ul>
      <label className="flex min-h-11 items-start gap-3 rounded-lg bg-muted/40 p-3 text-sm font-medium">
        <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-primary" checked={idOk} onChange={(e) => setIdOk(e.target.checked)} />
        Confirm the patient's ID matches {patientName}
      </label>
      {err && <p className="text-sm text-destructive" role="alert">{err}</p>}
      <Button className="h-12 w-full text-base" disabled={busy || chosen.length === 0 || !idOk} onClick={dispense}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {chosen.length === 0 ? "Nothing to dispense" : `Dispense ${chosen.length} medicine${chosen.length === 1 ? "" : "s"}`}
      </Button>
    </section>
  );
}
