import { useState } from "react";
import { FormDialog, handleSubmit } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePatients, useHospitalId } from "@/hooks/useHospitalData";

const ENTRY_TYPES = ["consultation_note","vitals","diagnosis","lab_order","procedure","prescription","allergy","immunization","discharge_summary"];

export function AddEmrEntryDialog() {
  const [f, setF] = useState<any>({ entry_type: "consultation_note" });
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: patients = [] } = usePatients();
  const { data: hospitalId } = useHospitalId();
  return (
    <FormDialog title="Add EMR Entry" triggerLabel="New Entry">
      {(close) => (
        <form onSubmit={async (e) => { e.preventDefault();
          await handleSubmit(supabase.from("emr_entries").insert({ ...f, hospital_id: hospitalId }), { toast, close, qc, invalidate: ["emr-entries"], successMsg: "EMR entry added" });
          setF({ entry_type: "consultation_note" });
        }} className="space-y-3">
          <div><Label>Patient</Label>
            <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Type</Label>
            <Select value={f.entry_type} onValueChange={(v) => setF({ ...f, entry_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ENTRY_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g," ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Title</Label><Input required value={f.title || ""} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
          <div><Label>Content / Notes</Label><Textarea rows={4} value={f.content || ""} onChange={(e) => setF({ ...f, content: e.target.value })} /></div>
          <Button type="submit" className="w-full">Save Entry</Button>
        </form>
      )}
    </FormDialog>
  );
}
