import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useDoctor } from "@/hooks/useDoctor";

export const LETTER_TYPES = [
  { value: "fit_to_work", label: "Fit-to-Work / Fit-to-Travel Letter" },
  { value: "pregnancy_maternity", label: "Pregnancy & Maternity Letter" },
  { value: "sick_leave", label: "Sick Leave Letter" },
  { value: "excuse_of_duty", label: "Excuse of Duty Letter" },
  { value: "vaccination_record", label: "Vaccination Record" },
] as const;

export function IssueLetterDialog({ patientId, trigger, existingLetter, open: openProp, onOpenChange }: {
  patientId: string;
  trigger?: React.ReactNode;
  existingLetter?: any;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const { data: doctor } = useDoctor();
  const qc = useQueryClient();
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp ?? openInternal;
  const setOpen = onOpenChange ?? setOpenInternal;

  const [letterType, setLetterType] = useState<string>("fit_to_work");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [status, setStatus] = useState<"issued" | "pending">("issued");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && existingLetter) {
      setLetterType(existingLetter.letter_type || "fit_to_work");
      const def = LETTER_TYPES.find((l) => l.value === existingLetter.letter_type);
      const cleanedTitle = (existingLetter.title || "").replace(/^Request:\s*/i, "");
      setTitle(cleanedTitle || def?.label || "");
      setBody(existingLetter.body || "");
      setValidUntil(existingLetter.valid_until || "");
      setStatus("issued");
    } else if (open && !existingLetter) {
      setLetterType("fit_to_work"); setTitle(""); setBody(""); setValidUntil(""); setStatus("issued");
    }
  }, [open, existingLetter]);

  async function submit() {
    if (!body.trim()) return toast.error("Letter body is required");
    setSaving(true);
    try {
      const def = LETTER_TYPES.find((l) => l.value === letterType)!;
      const payload: any = {
        patient_id: patientId,
        doctor_id: doctor?.doctor?.id ?? null,
        hospital_id: doctor?.hospitals?.[0]?.id ?? null,
        letter_type: letterType,
        title: title.trim() || def.label,
        body,
        status,
        valid_until: validUntil || null,
        issued_at: new Date().toISOString().slice(0, 10),
      };
      let error;
      if (existingLetter?.id) {
        ({ error } = await supabase.from("patient_letters" as any).update(payload).eq("id", existingLetter.id));
      } else {
        ({ error } = await supabase.from("patient_letters" as any).insert(payload));
      }
      if (error) throw error;
      toast.success(existingLetter ? "Request fulfilled" : "Letter issued");
      qc.invalidateQueries({ queryKey: ["patient-letters"] });
      qc.invalidateQueries({ queryKey: ["pending-letters", patientId] });
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to issue letter");
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>{existingLetter ? "Fulfil letter request" : "Issue medical letter"}</DialogTitle></DialogHeader>
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
          <Label>Title (optional)</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to letter type" />
        </div>
        <div>
          <Label>Body {existingLetter && <span className="text-xs text-muted-foreground">(patient's request shown — edit before issuing)</span>}</Label>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8}
            placeholder="To whom it may concern, ..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Valid until</Label>
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="issued">Issued</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
        <Button onClick={submit} disabled={saving}>{saving ? "Saving…" : existingLetter ? "Fulfil & issue" : "Issue letter"}</Button>
      </DialogFooter>
    </DialogContent>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {content}
    </Dialog>
  );
}
