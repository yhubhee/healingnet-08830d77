import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useHospitalId } from "@/hooks/useHospitalData";
import { pick, ALLOWED } from "@/lib/allowed";
import { friendlyError } from "@/lib/errors";
import { LinkPatientByCode } from "@/components/hospital/LinkPatientByCode";

export function AddPatientDialog() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: hospitalId } = useHospitalId();
  const [useCode, setUseCode] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hospitalId) return toast({ title: "Not linked to a hospital", variant: "destructive" });
    // register_patient creates the patient and links them to this hospital.
    const patient = pick({ ...f, date_of_birth: f.date_of_birth || null }, ALLOWED.patientRegister);
    const { error } = await supabase.rpc("register_patient", { p_hospital_id: hospitalId, p_patient: patient as any });
    if (error) return toast({ title: "Failed", description: friendlyError(error), variant: "destructive" });
    toast({ title: "Patient added" });
    setOpen(false); setF({});
    qc.invalidateQueries({ queryKey: ["patients"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Add Patient</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Patient</DialogTitle></DialogHeader>
        {useCode ? (
          <div className="space-y-3">
            <LinkPatientByCode hospitalId={hospitalId} onLinked={() => { setOpen(false); setUseCode(false); }} />
            <button type="button" className="text-sm text-primary hover:underline" onClick={() => setUseCode(false)}>Register a new patient instead</button>
          </div>
        ) : (
        <form onSubmit={submit} className="space-y-3">
          <button type="button" className="text-sm text-primary hover:underline" onClick={() => setUseCode(true)}>Patient already uses HealingNet? Enter their code</button>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First name</Label><Input required value={f.first_name || ""} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></div>
            <div><Label>Last name</Label><Input required value={f.last_name || ""} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input type="email" value={f.email || ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={f.phone || ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>DOB</Label><Input type="date" value={f.date_of_birth || ""} onChange={(e) => setF({ ...f, date_of_birth: e.target.value })} /></div>
            <div><Label>Gender</Label><Input value={f.gender || ""} onChange={(e) => setF({ ...f, gender: e.target.value })} /></div>
            <div><Label>Blood</Label><Input value={f.blood_group || ""} onChange={(e) => setF({ ...f, blood_group: e.target.value })} /></div>
          </div>
          <div><Label>Address</Label><Input value={f.address || ""} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <Button type="submit" className="w-full">Add Patient</Button>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
