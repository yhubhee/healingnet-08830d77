import { useState } from "react";
import { FormDialog, handleSubmit } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePatients, usePharmacyInventory, useHospitalId } from "@/hooks/useHospitalData";

export function DispenseDrugDialog() {
  const [f, setF] = useState<any>({ payment_status: "paid", quantity_dispensed: 1 });
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: patients = [] } = usePatients();
  const { data: drugs = [] } = usePharmacyInventory();
  const { data: hospitalId } = useHospitalId();
  return (
    <FormDialog title="Dispense Drug" triggerLabel="Dispense">
      {(close) => (
        <form onSubmit={async (e) => { e.preventDefault();
          const drug = drugs.find((d: any) => d.id === f.drug_id);
          if (!drug) return;
          await supabase.from("pharmacy_dispensing").insert({ ...f, drug_name: drug.drug_name, hospital_id: hospitalId });
          await supabase.from("pharmacy_inventory").update({ quantity_in_stock: Math.max(0, drug.quantity_in_stock - f.quantity_dispensed) }).eq("id", drug.id);
          toast({ title: "Dispensed" });
          qc.invalidateQueries({ queryKey: ["pharmacy-dispensing"] });
          qc.invalidateQueries({ queryKey: ["pharmacy-inventory"] });
          close();
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
          <Button type="submit" className="w-full">Dispense</Button>
        </form>
      )}
    </FormDialog>
  );
}
