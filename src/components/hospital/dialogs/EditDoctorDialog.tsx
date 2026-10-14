import { useState } from "react";
import { friendlyError } from "@/lib/errors";
import { FormDialog, handleSubmit } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  doctor: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditDoctorDialog({ doctor, open, onOpenChange }: Props) {
  const [f, setF] = useState<any>({
    employment_type: doctor.employment_type || "full_time",
    department: doctor.department || "",
    contract_start: doctor.contract_start || "",
    contract_end: doctor.contract_end || "",
    notes: doctor.notes || "",
  });
  const { toast } = useToast();
  const qc = useQueryClient();

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from("hospital_doctors")
        .update({
          employment_type: f.employment_type,
          department: f.department,
          contract_start: f.contract_start || null,
          contract_end: f.contract_end || null,
          notes: f.notes.trim() || null,
        })
        .eq("id", doctor.id);

      if (error) throw error;

      toast({ title: "Doctor updated successfully" });
      qc.invalidateQueries({ queryKey: ["hospital-doctors"] });

      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to update doctor", description: friendlyError(err), variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Doctor</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleEditSubmit} className="space-y-3">
          <div>
            <Label>Doctor</Label>
            <div className="text-sm font-medium p-2 bg-muted rounded">
              Dr. {doctor.doctors?.first_name} {doctor.doctors?.last_name}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label>Employment</Label>
              <Select value={f.employment_type} onValueChange={(v) => setF({ ...f, employment_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="visiting">Visiting Consultant</SelectItem>
                  <SelectItem value="locum">Locum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Input value={f.department} onChange={(e) => setF({ ...f, department: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="edit-contract-start">Contract start</Label>
              <Input id="edit-contract-start" type="date" value={f.contract_start} onChange={(e) => setF({ ...f, contract_start: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="edit-contract-end">Contract end</Label>
              <Input id="edit-contract-end" type="date" min={f.contract_start || undefined} value={f.contract_end} onChange={(e) => setF({ ...f, contract_end: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea id="edit-notes" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
          <div className="flex gap-2 pt-3">
            <Button variant="outline" type="button" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
