import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { friendlyError } from "@/lib/errors";

export type CheckResult = "genuine" | "not_found" | "suspected_fake";
const RESULT_LABEL: Record<CheckResult, string> = { genuine: "Genuine", not_found: "Not found", suspected_fake: "Looks fake" };
const FAKE_THANKS = "Thank you. HealingNet will review this. You can also report to NAFDAC directly.";

/** "Check your medicine" panel for one drug: guidance plus Genuine / Not found / Looks fake. */
export function MedicineCheck({ prescriptionId, drugName, last, onRecorded }: {
  prescriptionId: string;
  drugName: string;
  last?: CheckResult | null;
  onRecorded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [batch, setBatch] = useState("");
  const [nafdac, setNafdac] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState<CheckResult | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);

  async function record(result: CheckResult) {
    setBusy(result);
    const { error } = await supabase.rpc("record_medicine_check", {
      p_prescription_id: prescriptionId,
      p_result: result,
      p_batch_number: batch.trim() || undefined,
      p_nafdac_no: nafdac.trim() || undefined,
      p_details: details.trim() || undefined,
    });
    setBusy(null);
    if (error) return toast.error(friendlyError(error));
    const msg = result === "suspected_fake" ? FAKE_THANKS : `Saved: ${RESULT_LABEL[result]}. Thank you.`;
    setThanks(msg);
    toast.success(msg);
    onRecorded();
  }

  if (!open) {
    return (
      <button className="inline-flex min-h-9 items-center gap-1 text-sm text-primary hover:underline" onClick={() => setOpen(true)}>
        <ShieldCheck className="h-4 w-4" aria-hidden />Check your medicine{last ? ` · last: ${RESULT_LABEL[last]}` : ""}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-sm" data-testid="medicine-check">
      <p>
        Scratch the code on the pack and send it free by SMS to NAFDAC's MAS number on the pack, or search the drug on NAFDAC's Greenbook (
        <a href="https://greenbook.nafdac.gov.ng" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline-offset-4 hover:underline">greenbook.nafdac.gov.ng</a>).
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><Label htmlFor={`b-${prescriptionId}`}>Batch number (optional)</Label><Input id={`b-${prescriptionId}`} value={batch} onChange={(e) => setBatch(e.target.value)} maxLength={60} /></div>
        <div><Label htmlFor={`n-${prescriptionId}`}>NAFDAC number (optional)</Label><Input id={`n-${prescriptionId}`} value={nafdac} onChange={(e) => setNafdac(e.target.value)} maxLength={60} /></div>
      </div>
      <div><Label htmlFor={`d-${prescriptionId}`}>Details (optional)</Label><Textarea id={`d-${prescriptionId}`} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} rows={2} /></div>
      <div className="flex flex-wrap gap-2" aria-label={`Result for ${drugName}`}>
        {(Object.keys(RESULT_LABEL) as CheckResult[]).map((r) => (
          <Button key={r} size="sm" variant={r === "suspected_fake" ? "destructive" : "outline"} disabled={!!busy} onClick={() => record(r)}>
            {busy === r && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}{RESULT_LABEL[r]}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Close</Button>
      </div>
      {thanks && <p className="font-medium text-success" role="status">{thanks}</p>}
    </div>
  );
}

export { FAKE_THANKS };
