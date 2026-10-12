import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const WRONG_CODE = "That code is wrong or has expired. Ask the patient for a new one.";
const TOO_MANY = "Too many wrong codes were entered. Please try again in a little while.";

/**
 * "Patient already uses HealingNet? Enter their code."
 * Calls link_patient_by_code; on success the patient is linked to this hospital
 * and onLinked receives their patient id so the caller can carry on (e.g. check-in).
 * There is deliberately no way to search other hospitals' patients by name or phone.
 */
export function LinkPatientByCode({ hospitalId, onLinked }: { hospitalId: string | null | undefined; onLinked: (patientId: string) => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hospitalId || !code.trim()) return;
    setBusy(true);
    setMessage(null);
    const { data, error } = await supabase.rpc("link_patient_by_code", { p_hospital_id: hospitalId, p_code: code.trim() });
    setBusy(false);
    if (error) {
      setMessage(/too many wrong codes/i.test(error.message ?? "") ? TOO_MANY : "We couldn't check that code. Please try again.");
      return;
    }
    if (!data) {
      setMessage(WRONG_CODE);
      return;
    }
    setCode("");
    toast.success("Patient linked to your hospital");
    qc.invalidateQueries({ queryKey: ["patients"] });
    onLinked(data as string);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <Label>Patient already uses HealingNet? Enter their code</Label>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code from the patient's app"
          autoComplete="off"
          inputMode="text"
          className="tracking-widest font-mono"
        />
      </div>
      {message && <p className="text-sm text-destructive">{message}</p>}
      <Button type="submit" className="w-full" disabled={busy || !code.trim() || !hospitalId}>
        {busy ? "Checking…" : "Link patient"}
      </Button>
    </form>
  );
}
