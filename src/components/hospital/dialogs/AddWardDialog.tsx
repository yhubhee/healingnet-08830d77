import { useState } from "react";
import { FormDialog, handleSubmit } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useHospitalId } from "@/hooks/useHospitalData";

export function AddWardDialog() {
  const [f, setF] = useState<any>({ ward_type: "general", total_beds: 0 });
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: hospitalId } = useHospitalId();
  return (
    <FormDialog title="Add Ward" triggerLabel="Add Ward">
      {(close) => (
        <form onSubmit={async (e) => { e.preventDefault();
          await handleSubmit(supabase.from("hospital_wards" as any).insert({ ...f, hospital_id: hospitalId }), { toast, close, qc, invalidate: ["hospital-wards"] });
        }} className="space-y-3">
          <div><Label>Ward Name</Label><Input required value={f.ward_name || ""} onChange={(e) => setF({ ...f, ward_name: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Type</Label>
              <Select value={f.ward_type} onValueChange={(v) => setF({ ...f, ward_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="general">General</SelectItem><SelectItem value="icu">ICU</SelectItem><SelectItem value="maternity">Maternity</SelectItem><SelectItem value="pediatric">Pediatric</SelectItem><SelectItem value="private">Private</SelectItem></SelectContent>
              </Select></div>
            <div><Label>Floor</Label><Input value={f.floor || ""} onChange={(e) => setF({ ...f, floor: e.target.value })} /></div>
            <div><Label>Beds</Label><Input type="number" required value={f.total_beds} onChange={(e) => setF({ ...f, total_beds: +e.target.value })} /></div>
          </div>
          <Button type="submit" className="w-full">Add</Button>
        </form>
      )}
    </FormDialog>
  );
}
