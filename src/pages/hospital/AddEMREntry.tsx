import { HospitalLayout } from "@/layouts/HospitalLayout";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useHospitalId } from "@/hooks/useHospitalData";
import { DynamicEMRForm } from "@/components/hospital/DynamicEMRForm";

const ENTRY_TYPES = ["consultation_note", "vitals", "diagnosis", "lab_order", "procedure", "prescription", "allergy", "immunization", "discharge_summary"];

export default function AddEMREntry() {
  const navigate = useNavigate();
  const [entryType, setEntryType] = useState("consultation_note");
  const [patientId, setPatientId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: hospitalId } = useHospitalId();

  const onSubmit = async (formData: any) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("emr_entries")
        .insert({
          patient_id: formData.patient_id,
          entry_type: entryType,
          title: formData.title || "",
          content: formData.content || "",
          hospital_id: hospitalId,
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
      navigate("/hospital/emr");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <HospitalLayout>
      <div className="max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" onClick={() => navigate("/hospital/emr")} className="mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to EMR
        </Button>

        <div className="bg-card border border-border rounded-xl p-8">
          <h1 className="text-2xl font-heading font-bold mb-2">Add EMR Entry</h1>
          <p className="text-muted-foreground mb-8">Create a new electronic medical record entry</p>

          <div className="space-y-6">
            <div>
              <Label>Entry Type</Label>
              <Select value={entryType} onValueChange={setEntryType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTRY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DynamicEMRForm
              entryType={entryType}
              patientId={patientId}
              onPatientChange={setPatientId}
              onSubmit={onSubmit}
              isLoading={isLoading}
            />
          </div>
        </div>
      </div>
    </HospitalLayout>
  );
}
