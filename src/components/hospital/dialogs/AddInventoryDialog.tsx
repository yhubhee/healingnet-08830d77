import { useEffect, useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useHospitalId } from "@/hooks/useHospitalData";
import { friendlyError } from "@/lib/errors";

const fromItem = (item: any) => ({
  drug_name: item?.drug_name ?? "", generic_name: item?.generic_name ?? "", category: item?.category ?? "",
  strength: item?.strength ?? "", dosage_form: item?.dosage_form ?? "", quantity_in_stock: item ? String(item.quantity_in_stock ?? 0) : "",
  reorder_level: item?.reorder_level != null ? String(item.reorder_level) : "", unit_price: item?.unit_price != null ? String(item.unit_price) : "",
  supplier: item?.supplier ?? "", expiry_date: item?.expiry_date ?? "", nafdac_reg_no: item?.nafdac_reg_no ?? "",
});

/** Add a stock item, or edit one when `item` is given. Stock levels change only through dispensing or adjustment. */
export function AddInventoryDialog({ item, trigger }: { item?: any; trigger?: ReactNode } = {}) {
  const editing = !!item;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>(fromItem(item));
  const { data: hospitalId } = useHospitalId();
  const { toast } = useToast();
  const qc = useQueryClient();
  useEffect(() => { if (open) setF(fromItem(item)); }, [open, item?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hospitalId) return;
    const common = {
      drug_name: f.drug_name, generic_name: f.generic_name || null, category: f.category || null,
      strength: f.strength || null, dosage_form: f.dosage_form || "tablet",
      reorder_level: parseInt(f.reorder_level) || 50, unit_price: parseFloat(f.unit_price) || 0,
      supplier: f.supplier || null, expiry_date: f.expiry_date || null, nafdac_reg_no: f.nafdac_reg_no.trim() || null,
    };
    const { error } = editing
      ? await supabase.from("pharmacy_inventory").update(common).eq("id", item.id)
      : await supabase.from("pharmacy_inventory").insert({ ...common, hospital_id: hospitalId, quantity_in_stock: parseInt(f.quantity_in_stock) || 0 });
    if (error) return toast({ title: "Failed", description: friendlyError(error), variant: "destructive" });
    toast({ title: editing ? "Stock item updated" : "Drug added" });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["pharmacy-inventory"] });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? <Button><Plus className="w-4 h-4 mr-2" />Add Drug</Button>}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? `Edit ${item.drug_name}` : "Add Drug to Inventory"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label htmlFor="inv-name">Drug name</Label><Input id="inv-name" required value={f.drug_name} onChange={(e) => setF({ ...f, drug_name: e.target.value })} /></div>
            <div><Label htmlFor="inv-generic">Generic name</Label><Input id="inv-generic" value={f.generic_name} onChange={(e) => setF({ ...f, generic_name: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div><Label htmlFor="inv-strength">Strength</Label><Input id="inv-strength" value={f.strength} onChange={(e) => setF({ ...f, strength: e.target.value })} /></div>
            <div><Label htmlFor="inv-form">Form</Label><Input id="inv-form" value={f.dosage_form} onChange={(e) => setF({ ...f, dosage_form: e.target.value })} /></div>
            <div><Label htmlFor="inv-cat">Category</Label><Input id="inv-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="inv-qty">Quantity</Label>
              <Input id="inv-qty" type="number" disabled={editing} value={f.quantity_in_stock} onChange={(e) => setF({ ...f, quantity_in_stock: e.target.value })} />
              {editing && <p className="mt-1 text-xs text-muted-foreground">Changes through dispensing.</p>}
            </div>
            <div><Label htmlFor="inv-reorder">Reorder level</Label><Input id="inv-reorder" type="number" value={f.reorder_level} onChange={(e) => setF({ ...f, reorder_level: e.target.value })} /></div>
            <div><Label htmlFor="inv-price">Unit price</Label><Input id="inv-price" type="number" step="0.01" value={f.unit_price} onChange={(e) => setF({ ...f, unit_price: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label htmlFor="inv-supplier">Supplier</Label><Input id="inv-supplier" value={f.supplier} onChange={(e) => setF({ ...f, supplier: e.target.value })} /></div>
            <div><Label htmlFor="inv-expiry">Expiry date</Label><Input id="inv-expiry" type="date" value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} /></div>
          </div>
          <div><Label htmlFor="inv-nafdac">NAFDAC no.</Label><Input id="inv-nafdac" maxLength={60} placeholder="e.g. A4-1234" value={f.nafdac_reg_no} onChange={(e) => setF({ ...f, nafdac_reg_no: e.target.value })} /></div>
          <Button type="submit" className="w-full">{editing ? "Save changes" : "Add to Inventory"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
