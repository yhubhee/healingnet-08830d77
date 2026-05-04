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
import { usePatients, useHospitalId } from "@/hooks/useHospitalData";

export function CreateReferralDialog() {
  const [f, setF] = useState<any>({ urgency: "routine", referral_type: "external" });
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: patients = [] } = usePatients();
  const { data: hospitalId } = useHospitalId();
  return (
    <FormDialog title="Create Referral" triggerLabel="New Referral">
      {(close) => (
        <form onSubmit={async (e) => { e.preventDefault();
          await handleSubmit(supabase.from("hospital_referrals").insert({ ...f, hospital_id: hospitalId }), { toast, close, qc, invalidate: ["hospital-referrals"] });
        }} className="space-y-3">
          <div><Label>Patient</Label>
            <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Type</Label>
              <Select value={f.referral_type} onValueChange={(v) => setF({ ...f, referral_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="external">External Hospital</SelectItem><SelectItem value="internal">Internal</SelectItem></SelectContent>
              </Select></div>
            <div><Label>Urgency</Label>
              <Select value={f.urgency} onValueChange={(v) => setF({ ...f, urgency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="routine">Routine</SelectItem><SelectItem value="urgent">Urgent</SelectItem><SelectItem value="emergency">Emergency</SelectItem></SelectContent>
              </Select></div>
          </div>
          <div><Label>Specialty</Label><Input value={f.specialty || ""} onChange={(e) => setF({ ...f, specialty: e.target.value })} /></div>
          <div><Label>Referred to (hospital name)</Label><Input value={f.referred_to_hospital || ""} onChange={(e) => setF({ ...f, referred_to_hospital: e.target.value })} /></div>
          <div><Label>Reason</Label><Textarea required value={f.reason || ""} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
          <Button type="submit" className="w-full">Create</Button>
        </form>
      )}
    </FormDialog>
  );
}
