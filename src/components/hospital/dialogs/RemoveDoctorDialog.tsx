import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { friendlyError } from "@/lib/errors";

interface Props {
  doctor: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemoveDoctorDialog({ doctor, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();

  async function handleRemove() {
    try {
      const { error } = await supabase
        .from("hospital_doctors")
        .delete()
        .eq("id", doctor.id);

      if (error) throw error;

      toast({ title: "Doctor removed successfully" });
      qc.invalidateQueries({ queryKey: ["hospital-doctors"] });

      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to remove doctor", description: friendlyError(err), variant: "destructive" });
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Doctor</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove Dr. {doctor.doctors?.first_name} {doctor.doctors?.last_name} from this hospital? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-2 justify-end">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Remove
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
