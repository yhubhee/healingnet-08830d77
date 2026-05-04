import { useState } from "react";
import { FormDialog, handleSubmit } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useDoctors, useHospitalId } from "@/hooks/useHospitalData";

export function AssignDoctorDialog() {
  const [f, setF] = useState<any>({ employment_type: "full_time" });
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: doctors = [] } = useDoctors();
  const { data: hospitalId } = useHospitalId();
  return (
    <FormDialog title="Assign Doctor" triggerLabel="Add Doctor">
      {(close) => (
        <form onSubmit={async (e) => { e.preventDefault();
          await handleSubmit(supabase.from("hospital_doctors").insert({ ...f, hospital_id: hospitalId }), { toast, close, qc, invalidate: ["hospital-doctors"] });
        }} className="space-y-3">
          <div><Label>Doctor</Label>
            <Select value={f.doctor_id} onValueChange={(v) => setF({ ...f, doctor_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name} — {d.specialty}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Employment</Label>
              <Select value={f.employment_type} onValueChange={(v) => setF({ ...f, employment_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="full_time">Full-time</SelectItem><SelectItem value="visiting">Visiting Consultant</SelectItem><SelectItem value="locum">Locum</SelectItem></SelectContent>
              </Select></div>
            <div><Label>Department</Label><Input value={f.department || ""} onChange={(e) => setF({ ...f, department: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Salary (₦)</Label><Input type="number" value={f.salary || ""} onChange={(e) => setF({ ...f, salary: +e.target.value })} /></div>
            <div><Label>Commission %</Label><Input type="number" value={f.commission_rate || ""} onChange={(e) => setF({ ...f, commission_rate: +e.target.value })} /></div>
          </div>
          <Button type="submit" className="w-full">Assign</Button>
        </form>
      )}
    </FormDialog>
  );
}
