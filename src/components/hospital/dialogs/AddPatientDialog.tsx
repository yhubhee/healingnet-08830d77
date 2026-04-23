import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function AddPatientDialog() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});
  const { toast } = useToast();
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("patients").insert({
      first_name: f.first_name, last_name: f.last_name, email: f.email, phone: f.phone,
      date_of_birth: f.date_of_birth || null, gender: f.gender, blood_group: f.blood_group, address: f.address,
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Patient added" });
    setOpen(false); setF({});
    qc.invalidateQueries({ queryKey: ["patients"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Add Patient</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Patient</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First name</Label><Input required value={f.first_name || ""} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></div>
            <div><Label>Last name</Label><Input required value={f.last_name || ""} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Email</Label><Input type="email" value={f.email || ""} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={f.phone || ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>DOB</Label><Input type="date" value={f.date_of_birth || ""} onChange={(e) => setF({ ...f, date_of_birth: e.target.value })} /></div>
            <div><Label>Gender</Label><Input value={f.gender || ""} onChange={(e) => setF({ ...f, gender: e.target.value })} /></div>
            <div><Label>Blood</Label><Input value={f.blood_group || ""} onChange={(e) => setF({ ...f, blood_group: e.target.value })} /></div>
          </div>
          <div><Label>Address</Label><Input value={f.address || ""} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
          <Button type="submit" className="w-full">Add Patient</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
