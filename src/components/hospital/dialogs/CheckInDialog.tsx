import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePatients, useHospitalId, useHospitalDoctors } from "@/hooks/useHospitalData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function CheckInDialog() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("search");
  const [patientId, setPatientId] = useState("");
  const [assignedDoctor, setAssignedDoctor] = useState("");
  const [checkinType, setCheckinType] = useState("walk_in");
  const [urgency, setUrgency] = useState("routine");
  const [department, setDepartment] = useState("");
  const [notes, setNotes] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [newPatient, setNewPatient] = useState({ first_name: "", last_name: "", phone: "", date_of_birth: "", gender: "male" });
  const { data: patients = [] } = usePatients();
  const { data: doctors = [] } = useHospitalDoctors();
  const { data: hospitalId } = useHospitalId();
  const { toast } = useToast();
  const qc = useQueryClient();

  const filteredPatients = useMemo(() =>
    patients.filter((p: any) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.phone && p.phone.includes(searchQuery))
    ).slice(0, 30),
    [patients, searchQuery]
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hospitalId || !patientId || !assignedDoctor) return;
    // Get next queue number
    const { data: existing } = await supabase.from("patient_checkins").select("queue_number").eq("hospital_id", hospitalId).order("queue_number", { ascending: false }).limit(1);
    const nextNum = ((existing?.[0]?.queue_number as number) || 0) + 1;
    const { error } = await supabase.from("patient_checkins").insert({
      patient_id: patientId, hospital_id: hospitalId, checkin_type: checkinType, urgency, department, notes, queue_number: nextNum, status: "checked_in", assigned_doctor_id: assignedDoctor,
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Patient checked in", description: `Queue #${nextNum}` });
    resetForm();
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["patient-checkins"] });
  }

  async function submitNewPatient(e: React.FormEvent) {
    e.preventDefault();
    if (!newPatient.first_name || !newPatient.last_name) return;
    const { data: created, error: insertError } = await supabase.from("patients").insert({
      first_name: newPatient.first_name,
      last_name: newPatient.last_name,
      phone: newPatient.phone || null,
      date_of_birth: newPatient.date_of_birth || null,
      gender: newPatient.gender,
    }).select().single();
    if (insertError) return toast({ title: "Failed", description: insertError.message, variant: "destructive" });
    toast({ title: "Patient created" });
    setPatientId(created.id);
    setNewPatient({ first_name: "", last_name: "", phone: "", date_of_birth: "", gender: "male" });
    setTab("checkin");
    qc.invalidateQueries({ queryKey: ["patients"] });
  }

  function resetForm() {
    setPatientId("");
    setAssignedDoctor("");
    setCheckinType("walk_in");
    setUrgency("routine");
    setDepartment("");
    setNotes("");
    setSearchQuery("");
    setNewPatient({ first_name: "", last_name: "", phone: "", date_of_birth: "", gender: "male" });
    setTab("search");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Check In Patient</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Check In Patient</DialogTitle></DialogHeader>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="new">New Patient</TabsTrigger>
            <TabsTrigger value="checkin" disabled={!patientId}>Check-in</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-3">
            <div>
              <Label>Search Patient</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="By name or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {filteredPatients.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground text-center">
                  {searchQuery ? "No patients found" : "Start typing to search"}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredPatients.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setPatientId(p.id);
                        setTab("checkin");
                      }}
                      className="w-full text-left p-3 hover:bg-sidebar-accent transition-colors"
                    >
                      <div className="font-medium">{p.first_name} {p.last_name}</div>
                      <div className="text-xs text-muted-foreground">{p.phone || "—"} • {p.gender || "—"}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="new" className="space-y-3">
            <form onSubmit={submitNewPatient} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>First name</Label>
                  <Input required value={newPatient.first_name} onChange={(e) => setNewPatient({ ...newPatient, first_name: e.target.value })} />
                </div>
                <div>
                  <Label>Last name</Label>
                  <Input required value={newPatient.last_name} onChange={(e) => setNewPatient({ ...newPatient, last_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone</Label>
                  <Input value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })} />
                </div>
                <div>
                  <Label>Date of Birth</Label>
                  <Input type="date" value={newPatient.date_of_birth} onChange={(e) => setNewPatient({ ...newPatient, date_of_birth: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Gender</Label>
                <Select value={newPatient.gender} onValueChange={(v) => setNewPatient({ ...newPatient, gender: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full">Create & Continue</Button>
            </form>
          </TabsContent>

          <TabsContent value="checkin" className="space-y-3">
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>Selected Patient</Label>
                <div className="p-3 bg-sidebar-accent rounded-lg font-medium">
                  {patients.find((p: any) => p.id === patientId)?.first_name} {patients.find((p: any) => p.id === patientId)?.last_name}
                </div>
              </div>
              <div>
                <Label>Assigned Doctor</Label>
                <Select value={assignedDoctor} onValueChange={setAssignedDoctor}>
                  <SelectTrigger><SelectValue placeholder="Select a doctor" /></SelectTrigger>
                  <SelectContent>
                    {doctors.map((d: any) => (
                      <SelectItem key={d.id} value={d.doctor_id || d.id}>
                        Dr. {d.doctors?.first_name} {d.doctors?.last_name} — {d.doctors?.specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Check-in Type</Label>
                <Select value={checkinType} onValueChange={setCheckinType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walk_in">Walk-in</SelectItem>
                    <SelectItem value="pre_booked">Pre-booked Appointment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Urgency Level</Label>
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
                <div>
                  <Label>Department</Label>
                  <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={!patientId || !assignedDoctor}>Check In</Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
