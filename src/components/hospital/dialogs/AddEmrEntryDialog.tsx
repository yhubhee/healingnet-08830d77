import { useState } from "react";
import { FormDialog, handleSubmit } from "./FormDialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useHospitalId } from "@/hooks/useHospitalData";
import { DynamicEMRForm } from "../DynamicEMRForm";

const ENTRY_TYPES = ["consultation_note","vitals","diagnosis","lab_order","procedure","prescription","allergy","immunization","discharge_summary"];

export function AddEmrEntryDialog() {
  const [entryType, setEntryType] = useState("consultation_note");
  const [patientId, setPatientId] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: hospitalId } = useHospitalId();

  const onSubmit = async (formData: any) => {
    try {
      const { data, error } = await supabase
        .from("emr_entries")
        .insert({
          patient_id: formData.patient_id,
          entry_type: entryType,
          title: formData.title || "",
          content: formData.content || "",
          hospital_id: hospitalId,
          // Store vital measurements as JSON for vitals type
          ...(entryType === "vitals" && {
            vital_data: {
              systolic: formData.systolic,
              diastolic: formData.diastolic,
              heart_rate: formData.heart_rate,
              temperature: formData.temperature,
              oxygen_saturation: formData.oxygen_saturation,
              respiratory_rate: formData.respiratory_rate,
              blood_glucose: formData.blood_glucose,
              weight: formData.weight,
            }
          })
        })
        .select()
        .single();

      if (error) throw error;
      toast({ title: "Success", description: "EMR entry added" });
      qc.invalidateQueries({ queryKey: ["emr-entries"] });
      setPatientId("");
      setEntryType("consultation_note");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <FormDialog title="Add EMR Entry" triggerLabel="New Entry">
      {(close) => (
        <div className="space-y-4">
          <div>
            <Label>Entry Type</Label>
            <Select value={entryType} onValueChange={setEntryType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ENTRY_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g," ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <DynamicEMRForm
            entryType={entryType}
            patientId={patientId}
            onPatientChange={setPatientId}
            onSubmit={(data) => {
              onSubmit(data);
              close();
            }}
          />
        </div>
      )}
    </FormDialog>
  );
}
