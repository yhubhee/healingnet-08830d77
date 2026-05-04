import { useState } from "react";
import { FormDialog, handleSubmit } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePatients, useDoctors, useHospitalId } from "@/hooks/useHospitalData";

export function CreateConsultationDialog() {
  const [f, setF] = useState<any>({ urgency: "moderate", request_type: "virtual" });
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: patients = [] } = usePatients();
  const { data: doctors = [] } = useDoctors();
  const { data: hospitalId } = useHospitalId();
  return (
    <FormDialog title="Request Consultation" triggerLabel="New Request">
      {(close) => (
        <form onSubmit={async (e) => { e.preventDefault();
          await handleSubmit(supabase.from("consultation_requests").insert({ ...f, requesting_hospital_id: hospitalId }), { toast, close, qc, invalidate: ["consultation-requests"] });
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
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Specialty</Label><Input value={f.specialty_needed || ""} onChange={(e) => setF({ ...f, specialty_needed: e.target.value })} /></div>
            <div><Label>Urgency</Label>
              <Select value={f.urgency} onValueChange={(v) => setF({ ...f, urgency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="moderate">Moderate</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent>
              </Select></div>
            <div><Label>Type</Label>
              <Select value={f.request_type} onValueChange={(v) => setF({ ...f, request_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="virtual">Virtual</SelectItem><SelectItem value="in_person">In Person</SelectItem></SelectContent>
              </Select></div>
          </div>
          <div><Label>Reason</Label><Textarea required value={f.reason || ""} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
          <Button type="submit" className="w-full">Send Request</Button>
        </form>
      )}
    </FormDialog>
  );
}
