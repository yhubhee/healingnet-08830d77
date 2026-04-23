import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useHospitalId, usePatients } from "@/hooks/useHospitalData";

export function AddBillDialog() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ billing_type: "consultation", payment_method: "cash" });
  const { data: hospitalId } = useHospitalId();
  const { data: patients = [] } = usePatients();
  const { toast } = useToast();
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hospitalId) return;
    const amount = parseFloat(f.amount) || 0;
    const tax = parseFloat(f.tax) || 0;
    const discount = parseFloat(f.discount) || 0;
    const total = amount + tax - discount;
    const { error } = await supabase.from("hospital_billing").insert({
      hospital_id: hospitalId, patient_id: f.patient_id, billing_type: f.billing_type, description: f.description,
      amount, tax, discount, total, payment_method: f.payment_method, payment_status: "pending",
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Bill created" });
    setOpen(false); setF({ billing_type: "consultation", payment_method: "cash" });
    qc.invalidateQueries({ queryKey: ["hospital-billing"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Create Bill</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Create Bill</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div><Label>Patient</Label>
            <Select value={f.patient_id} onValueChange={(v) => setF({ ...f, patient_id: v })}>
              <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent>{patients.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Type</Label>
              <Select value={f.billing_type} onValueChange={(v) => setF({ ...f, billing_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["consultation", "lab", "pharmacy", "surgery", "admission", "other"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Method</Label>
              <Select value={f.payment_method} onValueChange={(v) => setF({ ...f, payment_method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["cash", "card", "transfer", "insurance"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Description</Label><Textarea value={f.description || ""} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Amount</Label><Input type="number" step="0.01" required value={f.amount || ""} onChange={(e) => setF({ ...f, amount: e.target.value })} /></div>
            <div><Label>Tax</Label><Input type="number" step="0.01" value={f.tax || ""} onChange={(e) => setF({ ...f, tax: e.target.value })} /></div>
            <div><Label>Discount</Label><Input type="number" step="0.01" value={f.discount || ""} onChange={(e) => setF({ ...f, discount: e.target.value })} /></div>
          </div>
          <Button type="submit" className="w-full" disabled={!f.patient_id}>Create Bill</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
