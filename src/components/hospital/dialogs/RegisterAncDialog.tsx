import { useState } from "react";
import { FormDialog, handleSubmit } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePatients, useDoctors, useHospitalId } from "@/hooks/useHospitalData";

export function RegisterAncDialog() {
  const [f, setF] = useState<any>({ risk_level: "low", gravida: 1, para: 0 });
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: patients = [] } = usePatients();
  const { data: doctors = [] } = useDoctors();
  const { data: hospitalId } = useHospitalId();
  return (
    <FormDialog title="Register ANC Patient" triggerLabel="Register ANC" size="xl">
      {(close) => (
        <form onSubmit={async (e) => { e.preventDefault();
          await handleSubmit(supabase.from("maternity_records").insert({ ...f, hospital_id: hospitalId, status: "anc_registered" }), { toast, close, qc, invalidate: ["maternity-records"] });
        }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Patient</Label>
              <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Doctor</Label>
              <Select value={f.doctor_id} onValueChange={(v) => setF({ ...f, doctor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>LMP Date</Label><Input type="date" value={f.lmp_date || ""} onChange={(e) => setF({ ...f, lmp_date: e.target.value })} /></div>
            <div><Label>EDD</Label><Input type="date" value={f.edd || ""} onChange={(e) => setF({ ...f, edd: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Gravida</Label><Input type="number" value={f.gravida} onChange={(e) => setF({ ...f, gravida: +e.target.value })} /></div>
            <div><Label>Para</Label><Input type="number" value={f.para} onChange={(e) => setF({ ...f, para: +e.target.value })} /></div>
            <div><Label>Risk</Label>
              <Select value={f.risk_level} onValueChange={(v) => setF({ ...f, risk_level: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
              </Select></div>
          </div>
          <Button type="submit" className="w-full">Register</Button>
        </form>
      )}
    </FormDialog>
  );
}
