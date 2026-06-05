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
import { Loader2, FlaskConical, X, Plus } from "lucide-react";

export function OrderLabTestDialog({ trigger, patientId: lockedPatientId }: { trigger: React.ReactNode; patientId?: string }) {
  const [open, setOpen] = useState(false);
  const { data: ctx } = useDoctor();
  const { data: patients = [] } = useDoctorPatients(ctx?.doctor?.id);
  const [patientId, setPatientId] = useState<string | null>(lockedPatientId || null);
  const [tests, setTests] = useState<string[]>([""]);
  const [category, setCategory] = useState("Haematology");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();

  useEffect(() => { if (lockedPatientId) setPatientId(lockedPatientId); }, [lockedPatientId]);
  const hospitalId = ctx?.hospitals?.[0]?.id;

  async function submit() {
    if (!patientId) return toast.error("Choose a patient");
    const clean = tests.map((t) => t.trim()).filter(Boolean);
    if (!clean.length) return toast.error("Add at least one test");
    if (!hospitalId) return toast.error("You're not linked to any hospital yet");
    setSaving(true);
    const { data: lr, error } = await supabase.from("lab_results").insert({
      patient_id: patientId, hospital_id: hospitalId, ordered_by: ctx!.doctor.id, notes, status: "pending",
    }).select().single();
    if (error || !lr) { setSaving(false); return toast.error(error?.message || "Failed"); }
    const { error: tErr } = await supabase.from("lab_result_tests").insert(clean.map((t) => ({ lab_result_id: lr.id, test_name: t, category_name: category })));
    setSaving(false);
    if (tErr) return toast.error(tErr.message);
    toast.success("Lab order created");
    qc.invalidateQueries({ queryKey: ["doctor", "labs"] });
    qc.invalidateQueries({ queryKey: ["doctor", "patient-detail"] });
    setOpen(false);
    setTests([""]); setNotes("");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FlaskConical className="w-4 h-4 text-warning" />Order Lab Tests</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!lockedPatientId && (<div><Label>Patient</Label><PatientPicker patients={patients as any} value={patientId} onChange={setPatientId} /></div>)}
          <div><Label>Category</Label>
            <select className="w-full border border-input bg-background rounded-md h-10 px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
              {["Haematology", "Chemistry", "Microbiology", "Serology", "Urinalysis", "Imaging", "Histopathology", "Other"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <Label>Tests</Label>
            <div className="space-y-2">
              {tests.map((t, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={t} onChange={(e) => setTests(tests.map((x, j) => j === i ? e.target.value : x))} placeholder="e.g. FBC" />
                  {tests.length > 1 && <Button variant="ghost" size="icon" onClick={() => setTests(tests.filter((_, j) => j !== i))}><X className="w-4 h-4" /></Button>}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setTests([...tests, ""])}><Plus className="w-4 h-4" />Add test</Button>
            </div>
          </div>
          <div><Label>Clinical notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for order" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}Send order</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
