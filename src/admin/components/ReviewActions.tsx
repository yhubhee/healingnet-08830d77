// Approve / reject a pending hospital or doctor.
import { useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useReviewDoctor, useReviewHospital } from "../api";
import { actionError } from "../format";
import { ConfirmDialog, REJECT_REASONS, ReasonDialog } from "./dialogs";

export function ReviewActions({
  kind, id, name, onDone, onOptimistic, size = "sm",
}: {
  kind: "hospital" | "doctor"; id: string; name: string;
  /** Called after the server accepts the decision. */
  onDone?: () => void;
  /** Called with true as soon as the admin confirms (hide the item), and with false if the server refuses. */
  onOptimistic?: (removed: boolean) => void;
  size?: "sm" | "default";
}) {
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const hospital = useReviewHospital();
  const doctor = useReviewDoctor();
  const busy = hospital.isPending || doctor.isPending;

  const run = (approve: boolean, reason?: string) => {
    onOptimistic?.(true);
    setApproving(false);
    setRejecting(false);
    // mutateAsync, not mutate(cb): the card may unmount once hidden, and the toast / undo must still run.
    const p = kind === "hospital"
      ? hospital.mutateAsync({ id, approve, notes: reason })
      : doctor.mutateAsync({ id, approve, reason });
    p.then(
      () => {
        toast.success(approve ? `${name} approved` : `${name} rejected`, {
          description: approve ? "They have been notified." : `Reason: ${reason}`,
        });
        onDone?.();
      },
      (e: unknown) => {
        onOptimistic?.(false);
        toast.error(`Couldn't ${approve ? "approve" : "reject"} ${name}`, { description: actionError(e) });
      },
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button size={size} onClick={() => setApproving(true)} disabled={busy} className="bg-success text-success-foreground hover:bg-success/90">
        <Check className="mr-1.5 h-4 w-4" />Approve
      </Button>
      <Button size={size} variant="outline" onClick={() => setRejecting(true)} disabled={busy} className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
        <X className="mr-1.5 h-4 w-4" />Reject
      </Button>
      <ConfirmDialog
        open={approving} onOpenChange={setApproving} confirmLabel="Approve" busy={busy}
        title={`Approve ${name}?`}
        description={kind === "hospital"
          ? "The hospital becomes verified and visible to patients."
          : "The doctor becomes verified and can take consultations."}
        onConfirm={() => run(true)}
      />
      <ReasonDialog
        open={rejecting} onOpenChange={setRejecting} confirmLabel="Reject" destructive busy={busy}
        title={`Reject ${name}?`} description="They will see this reason, so keep it clear and specific."
        quickPicks={REJECT_REASONS} placeholder="Or write a reason…"
        onConfirm={(r) => run(false, r)}
      />
    </div>
  );
}
