import { useState } from "react";
import { FormDialog, handleSubmit } from "./FormDialog";
import { Input } from "@/components/ui/input";
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
    salary: doctor.salary || "",
    commission_rate: doctor.commission_rate || "",
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
          salary: f.salary ? Number(f.salary) : null,
          commission_rate: f.commission_rate ? Number(f.commission_rate) : null,
        })
        .eq("id", doctor.id);

      if (error) throw error;

      toast({ title: "Doctor updated successfully" });
      qc.invalidateQueries({ queryKey: ["hospital-doctors"] });

      const details = [];
      if (f.employment_type !== doctor.employment_type)
        details.push(`Employment: ${doctor.employment_type} → ${f.employment_type}`);
      if (f.department !== doctor.department)
        details.push(`Department: ${doctor.department || "N/A"} → ${f.department || "N/A"}`);
      if (Number(f.salary) !== doctor.salary)
        details.push(`Salary: ₦${doctor.salary} → ₦${f.salary}`);
      if (Number(f.commission_rate) !== doctor.commission_rate)
        details.push(`Commission: ${doctor.commission_rate}% → ${f.commission_rate}%`);

      if (details.length > 0) {
        const { data: admin } = await supabase
          .from("hospital_staff")
          .select("email")
          .eq("hospital_id", doctor.hospital_id)
          .eq("role", "admin")
          .limit(1);

        if (admin && admin.length > 0) {
          fetch(new URL("/functions/v1/send-doctor-notification", import.meta.env.VITE_SUPABASE_URL).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              hospitalId: doctor.hospital_id,
              doctorName: `${doctor.doctors?.first_name} ${doctor.doctors?.last_name}`,
              action: "updated",
              details: details.join("; "),
              adminEmail: admin[0]?.email || "",
              doctorEmail: doctor.doctors?.email,
            }),
          }).catch(() => {});
        }
      }

      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Failed to update doctor", description: err.message, variant: "destructive" });
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
          <div className="grid grid-cols-2 gap-3">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Salary (₦)</Label>
              <Input type="number" value={f.salary} onChange={(e) => setF({ ...f, salary: e.target.value })} />
            </div>
            <div>
              <Label>Commission %</Label>
              <Input type="number" value={f.commission_rate} onChange={(e) => setF({ ...f, commission_rate: e.target.value })} />
            </div>
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
