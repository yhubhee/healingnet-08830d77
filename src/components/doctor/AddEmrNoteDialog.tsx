import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useDoctor } from "@/hooks/useDoctor";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, FileText } from "lucide-react";

const ENTRY_TYPES = ["consultation_note", "diagnosis", "treatment_plan", "discharge_summary", "vitals", "examination", "progress_note", "referral_note", "procedure_note", "follow_up", "allergy", "vaccination", "other"];

export function AddEmrNoteDialog({ trigger, patientId }: { trigger: React.ReactNode; patientId: string }) {
  const [open, setOpen] = useState(false);
  const { data: ctx } = useDoctor();
  const [form, setForm] = useState({ entry_type: "consultation_note", title: "", content: "" });
  const [saving, setSaving] = useState(false);
  const qc = useQueryClient();
  const hospitalId = ctx?.hospitals?.[0]?.id;

  async function submit() {
    if (!form.title) return toast.error("Title required");
    if (!hospitalId) return toast.error("You're not linked to any hospital");
    setSaving(true);
    const { error } = await supabase.from("emr_entries").insert({
      patient_id: patientId, doctor_id: ctx!.doctor.id, hospital_id: hospitalId,
      entry_type: form.entry_type, title: form.title, content: form.content,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Note added");
    qc.invalidateQueries({ queryKey: ["doctor", "patient-detail"] });
    setOpen(false);
    setForm({ entry_type: "consultation_note", title: "", content: "" });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-4 h-4 text-primary" />Add EMR Note</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Type</Label>
            <select className="w-full border border-input bg-background rounded-md h-10 px-3 text-sm" value={form.entry_type} onChange={(e) => setForm({ ...form, entry_type: e.target.value })}>
              {ENTRY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
            </select>
          </div>
          <div><Label>Title *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Content</Label><Textarea rows={5} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}Save</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
