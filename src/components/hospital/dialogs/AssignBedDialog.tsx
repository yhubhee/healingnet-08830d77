import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePatients } from "@/hooks/useHospitalData";

export function AssignBedDialog({ bed, open, onClose }: { bed: any; open: boolean; onClose: () => void }) {
  const [patientId, setPatientId] = useState("");
  const { data: patients = [] } = usePatients();
  const { toast } = useToast(); const qc = useQueryClient();

  async function submit() {
    const { error } = await supabase.from("hospital_beds").update({ patient_id: patientId, status: "occupied", assigned_at: new Date().toISOString() }).eq("id", bed.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Bed assigned" });
    qc.invalidateQueries({ queryKey: ["hospital-beds"] });
    onClose();
  }

  async function discharge() {
    await supabase.from("hospital_beds").update({ patient_id: null, status: "available", discharged_at: new Date().toISOString() }).eq("id", bed.id);
    qc.invalidateQueries({ queryKey: ["hospital-beds"] });
    toast({ title: "Discharged" });
    onClose();
  }

  if (!bed) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Bed {bed.bed_number}</DialogTitle></DialogHeader>
        {bed.status === "occupied" ? (
          <div className="space-y-3">
            <p>Currently occupied by {bed.patients?.first_name} {bed.patients?.last_name}</p>
            <Button variant="destructive" onClick={discharge}>Discharge</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div><Label>Patient</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
              </Select></div>
            <Button onClick={submit} disabled={!patientId} className="w-full">Assign</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
