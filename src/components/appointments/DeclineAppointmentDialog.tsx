import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRespondToAppointment, appointmentError } from "@/hooks/useAppointmentActions";

export function DeclineAppointmentDialog({ appointmentId, trigger, onDone }: { appointmentId: string; trigger: ReactNode; onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const respond = useRespondToAppointment();

  async function submit() {
    if (!reason.trim()) return;
    try {
      await respond.mutateAsync({ id: appointmentId, accept: false, reason: reason.trim() });
      toast.success("Appointment declined");
      setOpen(false);
      setReason("");
      onDone?.();
    } catch (e) {
      toast.error(appointmentError(e));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Decline appointment</DialogTitle>
          <DialogDescription>The patient will see this reason.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="decline-reason">Reason</Label>
          <Textarea id="decline-reason" value={reason} maxLength={500} rows={3}
            placeholder="For example: the clinic is closed that day. Please book another date."
            onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Back</Button>
          <Button variant="destructive" disabled={!reason.trim() || respond.isPending} onClick={submit}>
            {respond.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Decline
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
