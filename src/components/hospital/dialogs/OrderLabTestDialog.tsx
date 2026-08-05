import { useState } from "react";
import { FormDialog } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { usePatients, useDoctors, useHospitalId } from "@/hooks/useHospitalData";
import { useCreateLabOrder } from "@/api/hooks/useLab";
import { Plus, X } from "lucide-react";

const EMPTY_TEST = { test_name: "", category_name: "", sample_type: "blood" };

export function OrderLabTestDialog() {
  const [patientId, setPatientId] = useState("");
  const [doctorId, setDoctorId] = useState("");
  const [tests, setTests] = useState([{ ...EMPTY_TEST }]);
  const { toast } = useToast();
  const { data: patients = [] } = usePatients();
  const { data: doctors = [] } = useDoctors();
  const { data: hospitalId } = useHospitalId();
  const createOrder = useCreateLabOrder();

  async function submit(e: React.FormEvent, close: () => void) {
    e.preventDefault();
    const rows = tests.filter((t) => t.test_name.trim());
    if (!rows.length) return toast({ title: "Add at least one test", variant: "destructive" });
    if (!hospitalId) return toast({ title: "No hospital linked to your account", variant: "destructive" });

    try {
      await createOrder.mutateAsync({
        patientId,
        hospitalId,
        doctorId: doctorId || null,
        tests: rows.map((t) => ({
          name: t.test_name.trim(),
          categoryName: t.category_name || null,
          sampleType: t.sample_type || null,
          isCustom: true,
        })),
      });
      toast({ title: "Lab order created" });
      close();
      setTests([{ ...EMPTY_TEST }]); setPatientId(""); setDoctorId("");
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    }
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
            <Button type="button" variant="outline" size="sm" onClick={() => setTests([...tests, { ...EMPTY_TEST }])}><Plus className="w-3 h-3 mr-1" />Add test</Button>
          </div>
          <Button type="submit" className="w-full" disabled={createOrder.isPending}>Create Order</Button>
        </form>
      )}
    </FormDialog>
  );
}
