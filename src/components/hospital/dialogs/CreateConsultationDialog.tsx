import { useState, useMemo } from "react";
import { FormDialog, handleSubmit } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePatients, useDoctors, useHospitalId } from "@/hooks/useHospitalData";

export function CreateConsultationDialog() {
  const [f, setF] = useState<any>({ urgency: "moderate", request_type: "virtual" });
  const [doctorFee, setDoctorFee] = useState<number | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: patients = [] } = usePatients();
  const { data: doctors = [] } = useDoctors();
  const { data: hospitalId } = useHospitalId();

  // Fetch doctor fee when selected
  const handleDoctorChange = async (doctorId: string) => {
    setF({ ...f, doctor_id: doctorId });

    // Fetch fee from doctor_marketplace
    const { data: marketplace } = await supabase
      .from("doctor_marketplace")
      .select("external_virtual_fee")
      .eq("doctor_id", doctorId)
      .single();

    if (marketplace?.external_virtual_fee) {
      setDoctorFee(marketplace.external_virtual_fee);
      setF((prev: any) => ({ ...prev, fee_agreed: marketplace.external_virtual_fee }));
    } else {
      setDoctorFee(null);
    }
  };

  const feeDisplay = useMemo(() => {
    if (!doctorFee) return null;
    return `₦${doctorFee.toLocaleString()}`;
  }, [doctorFee]);

  return (
    <FormDialog title="Request Consultation" triggerLabel="New Request">
      {(close) => (
        <form onSubmit={async (e) => {
          e.preventDefault();
          await handleSubmit(
            supabase.from("consultation_requests").insert({
              ...f,
              requesting_hospital_id: hospitalId,
            }),
            {
              toast,
              close,
              qc,
              invalidate: ["consultation-requests"],
              onSuccess: () => {
                toast({
                  title: "Success",
                  description: "Consultation request created. Payment will be processed when doctor accepts.",
                });
              },
            }
          );
        }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Patient</Label>
              <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {patients.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Doctor</Label>
              <Select value={f.doctor_id || ""} onValueChange={handleDoctorChange}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {doctors.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      Dr. {d.first_name} {d.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Specialty</Label>
              <Input
                value={f.specialty_needed || ""}
                onChange={(e) => setF({ ...f, specialty_needed: e.target.value })}
              />
            </div>
            <div>
              <Label>Urgency</Label>
              <Select value={f.urgency} onValueChange={(v) => setF({ ...f, urgency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={f.request_type} onValueChange={(v) => setF({ ...f, request_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="virtual">Virtual</SelectItem>
                  <SelectItem value="in_person">In Person</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Reason</Label>
            <Textarea
              required
              value={f.reason || ""}
              onChange={(e) => setF({ ...f, reason: e.target.value })}
            />
          </div>

          {feeDisplay && (
            <div className="bg-info/10 border border-info/20 rounded-lg p-3 flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-info mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="font-medium">Consultation Fee: <span className="text-info font-bold">{feeDisplay}</span></p>
                <p className="text-muted-foreground text-xs mt-1">Patient will be charged when doctor accepts this request.</p>
              </div>
            </div>
          )}

          <Button type="submit" className="w-full">Send Request</Button>
        </form>
      )}
    </FormDialog>
  );
}
