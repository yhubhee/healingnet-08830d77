import { useState } from "react";
import { FormDialog, handleSubmit } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { usePatients, useDoctors, useHospitalId } from "@/hooks/useHospitalData";
import { Plus, X } from "lucide-react";

export function OrderLabTestDialog() {
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [tests, setTests] = useState([{ test_name: "", category_name: "", sample_type: "blood" }]);
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: patients = [] } = usePatients();
  const { data: doctors = [] } = useDoctors();
  const { data: hospitalId } = useHospitalId();

  async function submit(e: React.FormEvent, close: () => void) {
    e.preventDefault();
    const { data: lab, error } = await supabase.from("lab_results").insert({ patient_id: patientId, hospital_id: hospitalId!, ordered_by: doctorId || null, status: "pending" }).select().single();
    if (error || !lab) return toast({ title: "Failed", description: error?.message, variant: "destructive" });
    const rows = tests.filter((t) => t.test_name).map((t) => ({ ...t, lab_result_id: lab.id }));
    if (rows.length) await supabase.from("lab_result_tests").insert(rows);
    toast({ title: "Lab order created" });
    close(); setTests([{ test_name: "", category_name: "", sample_type: "blood" }]); setPatientId(""); setDoctorId("");
    qc.invalidateQueries({ queryKey: ["lab-results"] });
  }

  return (
    <FormDialog title="Order Lab Tests" triggerLabel="Order Test" size="xl">
      {(close) => (
        <form onSubmit={(e) => submit(e, close)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Patient</Label>
              <Select value={patientId} onValueChange={setPatientId} required>
                <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
                <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Ordering Doctor</Label>
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>{doctors.map((d: any) => <SelectItem key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tests</Label>
            {tests.map((t, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Test name" value={t.test_name} onChange={(e) => { const n = [...tests]; n[i].test_name = e.target.value; setTests(n); }} />
                <Input placeholder="Category" value={t.category_name} onChange={(e) => { const n = [...tests]; n[i].category_name = e.target.value; setTests(n); }} />
                <Input placeholder="Sample" value={t.sample_type} onChange={(e) => { const n = [...tests]; n[i].sample_type = e.target.value; setTests(n); }} />
                <Button type="button" variant="ghost" size="icon" onClick={() => setTests(tests.filter((_, j) => j !== i))}><X className="w-4 h-4" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setTests([...tests, { test_name: "", category_name: "", sample_type: "blood" }])}><Plus className="w-3 h-3 mr-1" />Add test</Button>
          </div>
          <Button type="submit" className="w-full">Create Order</Button>
        </form>
      )}
    </FormDialog>
  );
}
