import { useState } from "react";
import { FormDialog } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePatients, usePharmacyInventory } from "@/hooks/useHospitalData";
import { friendlyError } from "@/lib/errors";
import { useCollectPayment } from "@/hooks/useCollectPayment";

export function DispenseDrugDialog() {
  const [f, setF] = useState<any>({ quantity_dispensed: 1 });
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: patients = [] } = usePatients();
  const { data: drugs = [] } = usePharmacyInventory();
  const { collect, isProcessing } = useCollectPayment();

  const drug = drugs.find((d: any) => d.id === f.drug_id);
  const patient = patients.find((p: any) => p.id === f.patient_id);
  const amount = drug ? Number(drug.unit_price || 0) * Number(f.quantity_dispensed || 0) : 0;

  // dispense_drug records the dispensing and reduces the stock in one step.
  const dispense = async (): Promise<string | null> => {
    if (!drug || !f.patient_id) return null;
    const { data, error } = await supabase.rpc("dispense_drug", {
      p_drug_id: drug.id,
      p_patient_id: f.patient_id,
      p_qty: Number(f.quantity_dispensed) || 1,
      p_dosage: f.dosage || undefined,
      p_notes: f.notes || undefined,
    });
    if (error) throw error;
    qc.invalidateQueries({ queryKey: ["pharmacy-dispensing"] });
    qc.invalidateQueries({ queryKey: ["pharmacy-inventory"] });
    return data as string;
  };

  return (
    <FormDialog title="Dispense Drug" triggerLabel="Dispense">
      {(close) => (
        <form onSubmit={async (e) => { e.preventDefault();
          try {
            await dispense();
            toast({ title: "Dispensed" });
            close();
          } catch (err) {
            toast({ title: "Couldn't dispense", description: friendlyError(err), variant: "destructive" });
          }
        }} className="space-y-3">
          <div><Label>Patient</Label>
            <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>Drug</Label>
            <Select value={f.drug_id} onValueChange={(v) => setF({ ...f, drug_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{drugs.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.drug_name} (stock: {d.quantity_in_stock})</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Quantity</Label><Input type="number" min={1} value={f.quantity_dispensed} onChange={(e) => setF({ ...f, quantity_dispensed: +e.target.value })} /></div>
            <div><Label>Dosage</Label><Input value={f.dosage || ""} onChange={(e) => setF({ ...f, dosage: e.target.value })} /></div>
          </div>

          {drug && (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Amount due</span>
              <span className="font-heading font-bold">₦{amount.toLocaleString()}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" variant="outline" className="flex-1">Dispense (pay later)</Button>
            <Button
              type="button"
              className="flex-1"
              disabled={!drug || !patient || amount <= 0 || isProcessing}
              onClick={async () => {
                try {
                  const dispensingId = await dispense();
                  if (!dispensingId) return;
                  close();
                  await collect({ purpose: "pharmacy", dispensingId });
                } catch (err) {
                  toast({ title: "Couldn't dispense", description: friendlyError(err), variant: "destructive" });
                }
              }}
            >
              Dispense & collect
            </Button>
          </div>
        </form>
      )}
    </FormDialog>
  );
}
