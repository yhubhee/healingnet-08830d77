import { useState } from "react";
import { FormDialog, handleSubmit } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useHospitalId, useHospitalWards } from "@/hooks/useHospitalData";

export function AddBedDialog() {
  const [f, setF] = useState<any>({ bed_type: "standard", daily_rate: 0 });
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: hospitalId } = useHospitalId();
  const { data: wards = [] } = useHospitalWards();
  return (
    <FormDialog title="Add Bed" triggerLabel="Add Bed">
      {(close) => (
        <form onSubmit={async (e) => { e.preventDefault();
          await handleSubmit(supabase.from("hospital_beds" as any).insert({ ...f, hospital_id: hospitalId, status: "available" }), { toast, close, qc, invalidate: ["hospital-beds"] });
        }} className="space-y-3">
          <div><Label>Ward</Label>
            <Select value={f.ward_id} onValueChange={(v) => setF({ ...f, ward_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{wards.map((w) => <SelectItem key={w.id} value={w.id}>{w.ward_name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Bed #</Label><Input required value={f.bed_number || ""} onChange={(e) => setF({ ...f, bed_number: e.target.value })} /></div>
            <div><Label>Type</Label><Input value={f.bed_type} onChange={(e) => setF({ ...f, bed_type: e.target.value })} /></div>
            <div><Label>Rate ₦</Label><Input type="number" value={f.daily_rate} onChange={(e) => setF({ ...f, daily_rate: +e.target.value })} /></div>
          </div>
          <Button type="submit" className="w-full">Add</Button>
        </form>
      )}
    </FormDialog>
  );
}
