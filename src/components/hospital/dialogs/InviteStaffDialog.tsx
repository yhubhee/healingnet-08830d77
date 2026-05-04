import { useState } from "react";
import { FormDialog, handleSubmit } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useHospitalId } from "@/hooks/useHospitalData";

const ROLES = ["admin","receptionist","nurse","lab_tech","pharmacist","manager","medical_officer"];

export function InviteStaffDialog() {
  const [f, setF] = useState<any>({ role: "receptionist" });
  const { toast } = useToast(); const qc = useQueryClient();
  const { data: hospitalId } = useHospitalId();
  return (
    <FormDialog title="Invite Staff" triggerLabel="Invite Staff">
      {(close) => (
        <form onSubmit={async (e) => { e.preventDefault();
          // For invite: in absence of an email-invite system, we create the row with a placeholder user_id;
          // a true invite system would email a signup link.
          await handleSubmit(supabase.from("hospital_staff").insert({ ...f, hospital_id: hospitalId, user_id: "00000000-0000-0000-0000-000000000000" }), { toast, close, qc, invalidate: ["hospital-staff"], successMsg: "Staff invited (pending signup)" });
        }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First name</Label><Input required value={f.first_name || ""} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></div>
            <div><Label>Last name</Label><Input required value={f.last_name || ""} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" required value={f.email || ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
          <div><Label>Role</Label>
            <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r.replace(/_/g," ")}</SelectItem>)}</SelectContent>
            </Select></div>
          <Button type="submit" className="w-full">Send Invite</Button>
        </form>
      )}
    </FormDialog>
  );
}
