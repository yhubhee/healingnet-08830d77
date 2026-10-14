// Confirm and reason dialogs for admin actions.
import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ConfirmDialog({
  open, onOpenChange, title, description, confirmLabel, destructive, busy, onConfirm,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: ReactNode;
  confirmLabel: string; destructive?: boolean; busy?: boolean; onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} disabled={busy} onClick={onConfirm}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const REJECT_REASONS = ["Licence number could not be verified", "Documents unreadable", "Incomplete details"];

/** A dialog that requires a written reason (rejecting, suspending, refunds). */
export function ReasonDialog({
  open, onOpenChange, title, description, label = "Reason", placeholder, quickPicks, confirmLabel,
  destructive, busy, onConfirm, children,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: ReactNode; label?: string;
  placeholder?: string; quickPicks?: string[]; confirmLabel: string; destructive?: boolean; busy?: boolean;
  onConfirm: (reason: string) => void; children?: ReactNode;
}) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  useEffect(() => { if (open) { setReason(""); setTouched(false); } }, [open]);
  const empty = reason.trim() === "";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <form
          className="space-y-4"
          onSubmit={(e) => { e.preventDefault(); setTouched(true); if (!empty) onConfirm(reason.trim()); }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            {description && <AlertDialogDescription asChild><div>{description}</div></AlertDialogDescription>}
          </AlertDialogHeader>
          {children}
          {quickPicks && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Common reasons">
              {quickPicks.map((q) => (
                <Button key={q} type="button" size="sm" variant={reason === q ? "default" : "outline"} className="h-auto whitespace-normal py-1 text-left text-xs" onClick={() => setReason(q)}>
                  {q}
                </Button>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="admin-reason">{label} <span className="text-destructive">*</span></Label>
            <Textarea
              id="admin-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder}
              rows={3} aria-invalid={touched && empty} aria-describedby={touched && empty ? "admin-reason-err" : undefined}
            />
            {touched && empty && <p id="admin-reason-err" className="text-xs text-destructive">This is required.</p>}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={busy}>Cancel</AlertDialogCancel>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{confirmLabel}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
