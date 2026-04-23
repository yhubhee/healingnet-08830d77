import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useHospitalId } from "@/hooks/useHospitalData";

export function AddInventoryDialog() {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});
  const { data: hospitalId } = useHospitalId();
  const { toast } = useToast();
  const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hospitalId) return;
    const { error } = await supabase.from("pharmacy_inventory").insert({
      hospital_id: hospitalId, drug_name: f.drug_name, generic_name: f.generic_name, category: f.category,
      strength: f.strength, dosage_form: f.dosage_form || "tablet", quantity_in_stock: parseInt(f.quantity_in_stock) || 0,
      reorder_level: parseInt(f.reorder_level) || 50, unit_price: parseFloat(f.unit_price) || 0,
      supplier: f.supplier, expiry_date: f.expiry_date || null,
    });
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Drug added" });
    setOpen(false); setF({});
    qc.invalidateQueries({ queryKey: ["pharmacy-inventory"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Add Drug</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Add Drug to Inventory</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Drug name</Label><Input required value={f.drug_name || ""} onChange={(e) => setF({ ...f, drug_name: e.target.value })} /></div>
            <div><Label>Generic name</Label><Input value={f.generic_name || ""} onChange={(e) => setF({ ...f, generic_name: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Strength</Label><Input value={f.strength || ""} onChange={(e) => setF({ ...f, strength: e.target.value })} /></div>
            <div><Label>Form</Label><Input value={f.dosage_form || ""} onChange={(e) => setF({ ...f, dosage_form: e.target.value })} /></div>
            <div><Label>Category</Label><Input value={f.category || ""} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Quantity</Label><Input type="number" value={f.quantity_in_stock || ""} onChange={(e) => setF({ ...f, quantity_in_stock: e.target.value })} /></div>
            <div><Label>Reorder level</Label><Input type="number" value={f.reorder_level || ""} onChange={(e) => setF({ ...f, reorder_level: e.target.value })} /></div>
            <div><Label>Unit price</Label><Input type="number" step="0.01" value={f.unit_price || ""} onChange={(e) => setF({ ...f, unit_price: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Supplier</Label><Input value={f.supplier || ""} onChange={(e) => setF({ ...f, supplier: e.target.value })} /></div>
            <div><Label>Expiry date</Label><Input type="date" value={f.expiry_date || ""} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} /></div>
          </div>
          <Button type="submit" className="w-full">Add to Inventory</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
