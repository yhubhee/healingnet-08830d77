import { useState } from "react";
import { FormDialog } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { isSeatLimitError, SEAT_QUERY_KEY } from "@/hooks/useSeatUsage";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { friendlyError } from "@/lib/errors";
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
          // invite_staff records a pending invite; the person joins the hospital the next time
          // they sign in with this email (accept_my_staff_invites).
          if (!hospitalId) return;
          const { error } = await supabase.rpc("invite_staff", {
            _hospital_id: hospitalId,
            _email: f.email,
            _role: f.role,
            _first_name: f.first_name,
            _last_name: f.last_name,
          });
          if (error) return toast({ title: isSeatLimitError(error) ? "Team limit reached" : "Couldn't send the invite", description: friendlyError(error, "Please check the email address and try again."), variant: "destructive" });
          toast({ title: "Invite saved", description: "They'll join your hospital when they sign in with this email." });
          close(); setF({ role: "receptionist" });
          qc.invalidateQueries({ queryKey: ["hospital-staff"] });
          qc.invalidateQueries({ queryKey: ["staff-invites"] });
          qc.invalidateQueries({ queryKey: [SEAT_QUERY_KEY] });
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
