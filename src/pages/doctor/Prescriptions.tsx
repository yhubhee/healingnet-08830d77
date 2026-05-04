import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useDoctorId, useDoctorPrescriptions, useHospitalId, usePatients } from "@/hooks/useHospitalData";
import { useState } from "react";
import { FormDialog, handleSubmit } from "@/components/hospital/dialogs/FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function DoctorPrescriptions() {
  const { data: docId } = useDoctorId();
  const { data: rx = [] } = useDoctorPrescriptions(docId);
  const { data: patients = [] } = usePatients();
  const { data: hospitalId } = useHospitalId();
  const [f, setF] = useState<any>({});
  const { toast } = useToast(); const qc = useQueryClient();

  return (
    <DoctorLayout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-heading font-bold">Prescriptions</h1>
        <FormDialog title="Write Prescription" triggerLabel="New Prescription">
          {(close) => (
            <form onSubmit={async (e) => { e.preventDefault();
              await handleSubmit(supabase.from("prescriptions").insert({ ...f, doctor_id: docId, hospital_id: hospitalId }), { toast, close, qc, invalidate: ["doctor-prescriptions"] });
              setF({});
            }} className="space-y-3">
              <div><Label>Patient</Label>
                <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label>Drug</Label><Input required value={f.drug_name || ""} onChange={(e) => setF({ ...f, drug_name: e.target.value })} /></div>
              <div className="grid grid-cols-3 gap-2">
                <div><Label>Dosage</Label><Input value={f.dosage || ""} onChange={(e) => setF({ ...f, dosage: e.target.value })} /></div>
                <div><Label>Frequency</Label><Input value={f.frequency || ""} onChange={(e) => setF({ ...f, frequency: e.target.value })} /></div>
                <div><Label>Duration</Label><Input value={f.duration || ""} onChange={(e) => setF({ ...f, duration: e.target.value })} /></div>
              </div>
              <div><Label>Refills</Label><Input type="number" value={f.refills_allowed || 0} onChange={(e) => setF({ ...f, refills_allowed: +e.target.value })} /></div>
              <Button type="submit" className="w-full">Save</Button>
            </form>
          )}
        </FormDialog>
      </div>
      <div className="space-y-3">
        {rx.map((r: any) => (
          <div key={r.id} className="bg-card border border-border rounded-xl p-4">
            <h4 className="font-heading font-bold">{r.drug_name} — {r.dosage}</h4>
            <p className="text-sm text-muted-foreground">{r.patients?.first_name} {r.patients?.last_name} • {r.frequency} • {r.duration}</p>
          </div>
        ))}
      </div>
    </DoctorLayout>
  );
}
