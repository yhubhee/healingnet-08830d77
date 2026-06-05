import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { PatientPicker } from "./PatientPicker";
import { supabase } from "@/integrations/supabase/client";
import { useDoctor, useDoctorPatients } from "@/hooks/useDoctor";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pill } from "lucide-react";

export function NewPrescriptionDialog({ trigger, patientId: lockedPatientId }: { trigger: React.ReactNode; patientId?: string }) {
  const [open, setOpen] = useState(false);
  const { data: ctx } = useDoctor();
  const { data: patients = [] } = useDoctorPatients(ctx?.doctor?.id);
  const [patientId, setPatientId] = useState<string | null>(lockedPatientId || null);
  const [form, setForm] = useState({ drug_name: "", dosage: "", frequency: "", duration: "", instructions: "", refills_allowed: 0 });
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => { if (lockedPatientId) setPatientId(lockedPatientId); }, [lockedPatientId]);

  const hospitalId = ctx?.hospitals?.[0]?.id;

  async function submit() {
    if (!patientId) return toast.error("Choose a patient");
    if (!form.drug_name) return toast.error("Drug name required");
    if (!hospitalId) return toast.error("You're not linked to any hospital yet");
    setSaving(true);
    const { error } = await supabase.from("prescriptions").insert({
      patient_id: patientId, doctor_id: ctx!.doctor.id, hospital_id: hospitalId,
      drug_name: form.drug_name, dosage: form.dosage, frequency: form.frequency,
      duration: form.duration, instructions: form.instructions, refills_allowed: Number(form.refills_allowed) || 0,
      status: "active",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Prescription issued");
    qc.invalidateQueries({ queryKey: ["doctor", "prescriptions"] });
    qc.invalidateQueries({ queryKey: ["doctor", "patient-detail"] });
    setOpen(false);
    setForm({ drug_name: "", dosage: "", frequency: "", duration: "", instructions: "", refills_allowed: 0 });
    if (!lockedPatientId) setPatientId(null);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Pill className="w-4 h-4 text-primary" />New Prescription</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!lockedPatientId && (<div><Label>Patient</Label><PatientPicker patients={patients as any} value={patientId} onChange={setPatientId} /></div>)}
          <div><Label>Drug name *</Label><Input value={form.drug_name} onChange={(e) => setForm({ ...form, drug_name: e.target.value })} placeholder="e.g. Amoxicillin 500mg" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Dosage</Label><Input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="500mg" /></div>
            <div><Label>Frequency</Label><Input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="TID" /></div>
            <div><Label>Duration</Label><Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="7 days" /></div>
            <div><Label>Refills allowed</Label><Input type="number" value={form.refills_allowed} onChange={(e) => setForm({ ...form, refills_allowed: Number(e.target.value) })} /></div>
          </div>
          <div><Label>Instructions</Label><Textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Take after meals" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}Issue prescription</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
