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

export function FileClaimDialog() {
  const [f, setF] = useState<any>({ status: "draft", claim_date: new Date().toISOString().slice(0,10) });
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: patients = [] } = usePatients();
  const { data: hospitalId } = useHospitalId();
  return (
    <FormDialog title="File Insurance Claim" triggerLabel="File Claim">
      {(close) => (
        <form onSubmit={async (e) => { e.preventDefault();
          await handleSubmit(supabase.from("insurance_claims").insert({ ...f, hospital_id: hospitalId }), { toast, close, qc, invalidate: ["insurance-claims"] });
        }} className="space-y-3">
          <div><Label>Patient</Label>
            <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
            </Select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Insurance Provider</Label><Input required value={f.insurance_provider || ""} onChange={(e) => setF({ ...f, insurance_provider: e.target.value })} /></div>
            <div><Label>Policy #</Label><Input value={f.policy_number || ""} onChange={(e) => setF({ ...f, policy_number: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Claim Amount (₦)</Label><Input type="number" required value={f.claim_amount || ""} onChange={(e) => setF({ ...f, claim_amount: +e.target.value })} /></div>
            <div><Label>Claim Date</Label><Input type="date" required value={f.claim_date} onChange={(e) => setF({ ...f, claim_date: e.target.value })} /></div>
          </div>
          <div><Label>Service Description</Label><Textarea value={f.service_description || ""} onChange={(e) => setF({ ...f, service_description: e.target.value })} /></div>
          <Button type="submit" className="w-full">File</Button>
        </form>
      )}
    </FormDialog>
  );
}
