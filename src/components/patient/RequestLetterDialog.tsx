import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LETTER_TYPES } from "@/components/doctor/IssueLetterDialog";
import { friendlyError } from "@/lib/errors";

export function RequestLetterDialog({ patientId, trigger }: { patientId: string; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [letterType, setLetterType] = useState<string>("fit_to_work");
  const [notes, setNotes] = useState("");
  const [doctorId, setDoctorId] = useState<string>("any");
  const [doctors, setDoctors] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !patientId) return;
    (async () => {
      // Doctors the patient has previously interacted with
      const [appts, emr] = await Promise.all([
        supabase.from("patient_appointments").select("doctor_id").eq("patient_id", patientId),
        supabase.from("emr_entries").select("doctor_id").eq("patient_id", patientId),
      ]);
      const ids = new Set<string>();
      (appts.data || []).forEach((r: any) => r.doctor_id && ids.add(r.doctor_id));
      (emr.data || []).forEach((r: any) => r.doctor_id && ids.add(r.doctor_id));
      if (ids.size === 0) { setDoctors([]); return; }
      const { data } = await supabase.from("doctors")
        .select("id, first_name, last_name, specialty")
        .in("id", Array.from(ids));
      setDoctors(data || []);
    })();
  }, [open, patientId]);

  async function submit() {
    if (!notes.trim()) return toast.error("Please describe what you need the letter for");
    setSaving(true);
    try {
      const def = LETTER_TYPES.find((l) => l.value === letterType)!;
      let hospitalId: string | null = null;
      if (doctorId !== "any") {
        // The hospital where the patient last saw this doctor (patients can't read hospital_doctors).
        const { data: appt } = await supabase.from("patient_appointments")
          .select("hospital_id").eq("patient_id", patientId).eq("doctor_id", doctorId)
          .order("requested_date", { ascending: false }).limit(1).maybeSingle();
        hospitalId = (appt as any)?.hospital_id ?? null;
      }
      const { error } = await supabase.from("patient_letters" as any).insert({
        patient_id: patientId,
        doctor_id: doctorId === "any" ? null : doctorId,
        hospital_id: hospitalId,
        letter_type: letterType,
        title: `Request: ${def.label}`,
        body: notes,
        status: "pending",
        issued_at: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
      toast.success("Request submitted — your doctor will review it");
      qc.invalidateQueries({ queryKey: ["patient-letters"] });
      setOpen(false);
      setNotes("");
    } catch (e: any) {
      toast.error(friendlyError(e, "Could not submit request"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Request a letter</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Letter type</Label>
            <Select value={letterType} onValueChange={setLetterType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LETTER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Preferred doctor (optional)</Label>
            <Select value={doctorId} onValueChange={setDoctorId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any available doctor</SelectItem>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}{d.specialty ? ` — ${d.specialty}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason / notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={6}
              placeholder="Why you need this letter, dates, employer / school name, any other details…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Submitting…" : "Submit request"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
