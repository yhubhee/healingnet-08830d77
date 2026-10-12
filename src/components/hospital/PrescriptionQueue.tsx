import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Pill } from "lucide-react";
import { toast } from "sonner";
import { friendlyError } from "@/lib/errors";
import { useHospitalId, usePharmacyInventory } from "@/hooks/useHospitalData";

const sb = supabase as any;

/** Active prescriptions waiting to be dispensed at this hospital. */
export function usePrescriptionQueue() {
  const qc = useQueryClient();
  const { data: hospitalId } = useHospitalId();
  useEffect(() => {
    if (!hospitalId) return;
    const ch = supabase.channel(`rx-queue-${hospitalId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "prescriptions", filter: `hospital_id=eq.${hospitalId}` }, () => qc.invalidateQueries({ queryKey: ["pharmacy", "rx-queue"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hospitalId, qc]);
  return useQuery({
    queryKey: ["pharmacy", "rx-queue", hospitalId],
    enabled: !!hospitalId,
    queryFn: async () => {
      const { data, error } = await sb.from("prescriptions").select("*, patients(first_name,last_name,email), doctors(first_name,last_name)")
        .eq("hospital_id", hospitalId).eq("status", "active").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function PrescriptionQueue() {
  const { data = [], isLoading, isError, refetch } = usePrescriptionQueue();
  const [active, setActive] = useState<any>(null);
  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading prescriptions…</div>;
  if (isError) return <div className="p-8 text-center text-destructive">Couldn't load prescriptions. <button className="underline" onClick={() => refetch()}>Try again</button></div>;
  if (!data.length) return <div className="p-8 text-center text-muted-foreground">No prescriptions waiting.</div>;
  return (
    <>
      <div className="divide-y divide-border/50">
        {data.map((r: any) => (
          <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="font-medium flex items-center gap-2"><Pill className="w-4 h-4 text-primary shrink-0" />{r.drug_name}</p>
              <p className="text-xs text-muted-foreground">{[r.dosage, r.frequency, r.duration].filter(Boolean).join(" · ") || "—"}</p>
              {r.instructions && <p className="text-xs text-muted-foreground">{r.instructions}</p>}
              <p className="text-xs mt-1">{r.patients ? `${r.patients.first_name} ${r.patients.last_name}` : "Patient"} · {r.doctors ? `Dr ${r.doctors.first_name} ${r.doctors.last_name}` : "—"} · {new Date(r.created_at).toLocaleString()}</p>
            </div>
            <Button size="sm" onClick={() => setActive(r)}>Dispense</Button>
          </div>
        ))}
      </div>
      <DispenseRxDialog rx={active} onClose={() => setActive(null)} />
    </>
  );
}

function DispenseRxDialog({ rx, onClose }: { rx: any; onClose: () => void }) {
  const { data: drugs = [] } = usePharmacyInventory();
  const qc = useQueryClient();
  const [drugId, setDrugId] = useState<string>("");
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!rx) return;
    const name = String(rx.drug_name || "").toLowerCase();
    const match = (drugs as any[]).find((d) => name.includes(String(d.drug_name).toLowerCase()) || (d.generic_name && name.includes(String(d.generic_name).toLowerCase())));
    setDrugId(match?.id || "");
    const q = /Qty:\s*(\d+)/.exec(rx.instructions || "");
    setQty(q ? +q[1] : 1);
  }, [rx, drugs]);
  const drug = (drugs as any[]).find((d) => d.id === drugId);

  async function go() {
    setBusy(true);
    try {
      if (!drug) throw new Error("Pick the stock item to dispense from.");
      // dispense_prescription records the dispensing, reduces the stock and completes the prescription.
      const { error } = await sb.rpc("dispense_prescription", { p_rx_id: rx.id, p_drug_id: drug.id, p_qty: qty });
      if (error) throw error;
      toast.success("Dispensed");
      ["pharmacy", "pharmacy-dispensing", "pharmacy-inventory"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    } catch (e: any) { toast.error(e?.message === "Pick the stock item to dispense from." ? e.message : friendlyError(e)); } finally { setBusy(false); }
  }

  return (
    <Dialog open={!!rx} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dispense {rx?.drug_name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Stock item</Label>
            <Select value={drugId} onValueChange={setDrugId}>
              <SelectTrigger><SelectValue placeholder="Select the stock item" /></SelectTrigger>
              <SelectContent>{(drugs as any[]).map((d) => <SelectItem key={d.id} value={d.id}>{d.drug_name} {d.strength || ""} (stock: {d.quantity_in_stock})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Quantity</Label><Input type="number" min={1} value={qty} onChange={(e) => setQty(+e.target.value || 1)} /></div>
          {drug && <p className="text-sm text-muted-foreground">Amount: ₦{(Number(drug.unit_price || 0) * qty).toLocaleString()}</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy || !drug} onClick={go}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Dispense</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
