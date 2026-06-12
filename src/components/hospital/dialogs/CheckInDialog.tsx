import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePatients, useHospitalId } from "@/hooks/useHospitalData";

export function CheckInDialog() {
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [checkinType, setCheckinType] = useState("walk_in");
  const [urgency, setUrgency] = useState("routine");
  const [department, setDepartment] = useState("");
  const [notes, setNotes] = useState("");
  const { data: patients = [] } = usePatients();
  const { data: hospitalId } = useHospitalId();
  const { toast } = useToast();
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hospitalId || !patientId) return;
    // Get next queue number
    const { data: existing } = await supabase.from("patient_checkins").select("queue_number").eq("hospital_id", hospitalId).order("queue_number", { ascending: false }).limit(1);
    const nextNum = ((existing?.[0]?.queue_number as number) || 0) + 1;
    const { error } = await supabase.from("patient_checkins").insert({
      patient_id: patientId, hospital_id: hospitalId, checkin_type: checkinType, urgency, department, notes, queue_number: nextNum, status: "checked_in",
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Patient checked in", description: `Queue #${nextNum}` });
    setOpen(false); setPatientId(""); setCheckinType("walk_in"); setUrgency("routine"); setNotes(""); setDepartment("");
    qc.invalidateQueries({ queryKey: ["patient-checkins"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Check In Patient</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Check In Patient</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Patient</Label>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent>{(patients || []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Check-in Type</Label>
            <Select value={checkinType} onValueChange={setCheckinType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="walk_in">Walk-in</SelectItem>
                <SelectItem value="pre_booked">Pre-booked Appointment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Urgency Level</Label>
              <Select value={urgency} onValueChange={setUrgency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="soon">Soon (24-48h)</SelectItem>
                  <SelectItem value="urgent">Urgent (today)</SelectItem>
                  <SelectItem value="emergency">Emergency (now)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Department</Label><Input value={department} onChange={(e) => setDepartment(e.target.value)} /></div>
          </div>
          <div><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          <Button type="submit" className="w-full" disabled={!patientId}>Check In</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
