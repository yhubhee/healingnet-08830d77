import { AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function SkipTriageModal({ open, onClose, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning" />
            Skip AI Triage?
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to skip the AI-powered symptom analysis?
          </DialogDescription>
        </DialogHeader>

        <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 space-y-2">
          <h4 className="font-medium text-sm">⚠️ What you're giving up:</h4>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li>• <strong>Smart Doctor Matching:</strong> AI helps find the right specialist based on your symptoms</li>
            <li>• <strong>Condition Analysis:</strong> Understanding what might be causing your symptoms</li>
            <li>• <strong>Urgency Assessment:</strong> Getting guidance on how soon you should seek care</li>
            <li>• <strong>Doctor Reference:</strong> Your doctor won't see the detailed symptom analysis</li>
          </ul>
        </div>

        <div className="bg-info/10 border border-info/20 rounded-lg p-4">
          <h4 className="font-medium text-sm mb-2">✓ If you skip:</h4>
          <p className="text-sm text-muted-foreground">
            You'll manually select a doctor and specialty. You can always come back to the triage later if you change your mind.
          </p>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose}>
            Keep the Triage
          </Button>
          <Button variant="destructive" onClick={onConfirm}>
            Skip Anyway
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
