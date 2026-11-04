import { useState } from "react";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";

export function RatePharmacyDialog({ open, onOpenChange, requestId, pharmacyName, onRated }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  requestId: string;
  pharmacyName: string;
  onRated: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!rating) return;
    setBusy(true);
    const { error } = await supabase.rpc("rx_review_pharmacy", { p_request_id: requestId, p_rating: rating, p_comment: comment.trim() || undefined });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Thanks for your rating");
    onRated();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate {pharmacyName}</DialogTitle>
          <DialogDescription>Your rating helps other patients choose a pharmacy.</DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-1" role="radiogroup" aria-label="Stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setRating(n)} className="flex h-11 w-11 items-center justify-center">
              <Star className={cn("h-8 w-8", n <= rating ? "fill-warning text-warning" : "text-muted-foreground")} aria-hidden />
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rate-comment">Comment (optional)</Label>
          <Textarea id="rate-comment" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <Button className="h-11 w-full" disabled={!rating || busy} onClick={submit}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Submit rating</Button>
      </DialogContent>
    </Dialog>
  );
}
