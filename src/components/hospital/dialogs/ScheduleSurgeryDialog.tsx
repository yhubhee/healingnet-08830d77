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

export function ScheduleSurgeryDialog() {
  const [f, setF] = useState<any>({ procedure_type: "elective", anaesthesia_type: "general" });
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: patients = [] } = usePatients();
  const { data: doctors = [] } = useDoctors();
  const { data: hospitalId } = useHospitalId();

  return (
    <FormDialog title="Schedule Surgery" triggerLabel="Schedule" size="xl">
      {(close) => (
        <form onSubmit={async (e) => { e.preventDefault();
          await handleSubmit(supabase.from("surgery_records").insert({ ...f, hospital_id: hospitalId, status: "scheduled" }), { toast, close, qc, invalidate: ["surgery-records"], successMsg: "Surgery scheduled" });
          setF({ procedure_type: "elective", anaesthesia_type: "general" });
        }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Patient</Label>
              <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><Label>Surgeon</Label>
              <Select value={f.surgeon_id} onValueChange={(v) => setF({ ...f, surgeon_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</SelectItem>)}</SelectContent>
              </Select></div>
          </div>
          <div><Label>Procedure</Label><Input required value={f.procedure_name || ""} onChange={(e) => setF({ ...f, procedure_name: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Date</Label><Input type="date" required value={f.scheduled_date || ""} onChange={(e) => setF({ ...f, scheduled_date: e.target.value })} /></div>
            <div><Label>Time</Label><Input type="time" required value={f.scheduled_time || ""} onChange={(e) => setF({ ...f, scheduled_time: e.target.value })} /></div>
            <div><Label>Theatre</Label><Input value={f.theatre_number || ""} onChange={(e) => setF({ ...f, theatre_number: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Type</Label>
              <Select value={f.procedure_type} onValueChange={(v) => setF({ ...f, procedure_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="elective">Elective</SelectItem><SelectItem value="emergency">Emergency</SelectItem></SelectContent>
              </Select></div>
            <div><Label>Anaesthesia</Label>
              <Select value={f.anaesthesia_type} onValueChange={(v) => setF({ ...f, anaesthesia_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="general">General</SelectItem><SelectItem value="local">Local</SelectItem><SelectItem value="spinal">Spinal</SelectItem></SelectContent>
              </Select></div>
          </div>
          <Button type="submit" className="w-full">Schedule</Button>
        </form>
      )}
    </FormDialog>
  );
}
