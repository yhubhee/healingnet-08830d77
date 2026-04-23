import { useState } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { usePatientAppointments, usePatientProfile, useHospitalsList } from "@/hooks/usePatientData";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

const tabs = ["Upcoming", "Pending", "Past"];

export default function PatientAppointments() {
  const { data: appts = [], isLoading } = usePatientAppointments();
  const { data: profile } = usePatientProfile();
  const { data: hospitals = [] } = useHospitalsList();
  const [tab, setTab] = useState("Upcoming");
  const [open, setOpen] = useState(false);
  const [hospitalId, setHospitalId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const filtered = appts.filter((a: any) => {
    if (tab === "Upcoming") return a.status === "accepted";
    if (tab === "Pending") return a.status === "pending";
    return ["completed", "cancelled", "rejected"].includes(a.status);
  });

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const { error } = await supabase.from("patient_appointments" as any).insert({
      patient_id: profile.id, hospital_id: hospitalId, requested_date: date, requested_time: time || null, reason,
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Appointment requested" });
    setOpen(false); setHospitalId(""); setDate(""); setTime(""); setReason("");
    qc.invalidateQueries({ queryKey: ["patient-appointments"] });
  }

  return (
    <PatientLayout>
      <div className="flex justify-between items-center mb-6">
        <div><h1 className="text-2xl font-heading font-bold">My Appointments</h1><p className="text-muted-foreground">Manage your bookings</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Book Appointment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Book an Appointment</DialogTitle></DialogHeader>
            <form onSubmit={book} className="space-y-4">
              <div><Label>Hospital</Label>
                <Select value={hospitalId} onValueChange={setHospitalId}>
                  <SelectTrigger><SelectValue placeholder="Select hospital" /></SelectTrigger>
                  <SelectContent>{hospitals.map((h: any) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
                <div><Label>Time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
              </div>
              <div><Label>Reason</Label><Textarea value={reason} onChange={(e) => setReason(e.target.value)} /></div>
              <Button type="submit" className="w-full">Request Appointment</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex gap-1 mb-6">
        {tabs.map((t) => <Button key={t} variant={tab === t ? "default" : "secondary"} size="sm" onClick={() => setTab(t)}>{t}</Button>)}
      </div>
      {isLoading ? <p className="text-muted-foreground p-8 text-center">Loading…</p> :
        filtered.length === 0 ? <p className="text-muted-foreground p-8 text-center">No appointments</p> :
        <div className="space-y-3">{filtered.map((a: any) => (
          <div key={a.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex justify-between mb-1">
              <h4 className="font-heading font-bold">{a.hospitals?.name || "—"}</h4>
              <span className={cn("text-xs font-semibold px-3 py-1 rounded-full",
                a.status === "accepted" ? "bg-success/15 text-success" : a.status === "pending" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground")}>{a.status}</span>
            </div>
            <p className="text-sm text-muted-foreground">{a.requested_date} {a.requested_time || ""}</p>
            {a.reason && <p className="text-sm mt-2">{a.reason}</p>}
          </div>
        ))}</div>}
    </PatientLayout>
  );
}
