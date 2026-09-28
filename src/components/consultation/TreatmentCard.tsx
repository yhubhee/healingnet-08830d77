import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Plus, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SectionCard } from "./SectionCard";
import { useTreatmentItems } from "@/hooks/useConsultation";

const sb = supabase as any;
const ROUTES = ["PO", "IV", "IM", "SC", "SL", "PR", "Topical", "Inhalation", "Eye/Ear drops"];
const FREQS = ["STAT", "OD", "BD", "TDS", "QDS", "Nocte", "Mane", "PRN", "6-hourly", "8-hourly", "12-hourly", "Weekly"];
const PER_DAY: Record<string, number> = { STAT: 1, OD: 1, BD: 2, TDS: 3, QDS: 4, Nocte: 1, Mane: 1, PRN: 1, "6-hourly": 4, "8-hourly": 3, "12-hourly": 2, Weekly: 1 / 7 };
const UNIT_DAYS: Record<string, number> = { days: 1, weeks: 7, months: 30 };

export function lineText(t: any) {
  return [t.route, t.drug_name, t.strength, t.dose, t.frequency, t.duration_value ? `x ${t.duration_value} ${t.duration_unit || "days"}` : null].filter(Boolean).join(" ");
}

export function TreatmentCard({ consultation, readOnly, allergies, userId }: { consultation: any; readOnly: boolean; allergies: string; userId?: string }) {
  const { data: items = [], isLoading, isError, refetch } = useTreatmentItems(consultation.id);
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  async function remove(id: string) {
    const { error } = await sb.from("consultation_treatment_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["consultation", consultation.id, "treatment"] });
  }

  return (
    <SectionCard title="Medication / Treatment" completion={items.length ? "done" : "empty"}
      actions={!readOnly && <Button size="sm" onClick={() => setOpen(true)}><Plus className="w-3.5 h-3.5" />Add Drugs</Button>}>
      {isLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
        : isError ? <div className="text-sm text-destructive">Couldn't load treatment. <button className="underline" onClick={() => refetch()}>Try again</button></div>
        : items.length === 0 ? <p className="text-sm text-muted-foreground">No drugs or treatment added yet.</p> : (
          <ol className="space-y-2">
            {items.map((t: any, i: number) => (
              <li key={t.id} className="flex items-start gap-2 text-sm rounded-lg border border-border p-2.5">
                <span className="font-semibold">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <div>{lineText(t)}{t.kind !== "drug" && <span className="ml-2 text-[11px] text-muted-foreground uppercase">{t.kind}</span>}</div>
                  <div className="text-xs text-muted-foreground">{[t.quantity ? `Qty ${t.quantity}` : null, t.instructions, t.give_in_clinic ? "Give in clinic" : null].filter(Boolean).join(" · ")}</div>
                </div>
                {!readOnly && <button aria-label="Remove line" onClick={() => remove(t.id)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>}
              </li>
            ))}
          </ol>
        )}
      {open && <AddDrugDialog consultation={consultation} allergies={allergies} userId={userId} nextLine={(items.at(-1)?.line_no ?? 0) + 1} onClose={() => setOpen(false)} />}
    </SectionCard>
  );
}

function AddDrugDialog({ consultation, allergies, userId, nextLine, onClose }: { consultation: any; allergies: string; userId?: string; nextLine: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"drug" | "procedure" | "other">("drug");
  const [f, setF] = useState<any>({ drug_name: "", strength: "", dose: "", route: "", frequency: "", duration_value: "", duration_unit: "days", quantity: "", instructions: "", give_in_clinic: false, inventory_item_id: null });
  const [qtyTouched, setQtyTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: any) => setF((p: any) => ({ ...p, [k]: v }));

  const search = useQuery({
    enabled: kind === "drug" && f.drug_name.trim().length >= 2 && !f.inventory_item_id,
    queryKey: ["inventory-search", consultation.hospital_id, f.drug_name.trim()],
    queryFn: async () => {
      const q = f.drug_name.trim();
      const { data } = await sb.from("pharmacy_inventory").select("id,drug_name,generic_name,strength,dosage_form,quantity_in_stock").eq("hospital_id", consultation.hospital_id).or(`drug_name.ilike.%${q}%,generic_name.ilike.%${q}%`).limit(6);
      return data || [];
    },
  });

  const suggestedQty = useMemo(() => {
    const perDay = PER_DAY[f.frequency]; const d = Number(f.duration_value);
    if (f.frequency === "STAT") return 1;
    if (!perDay || !d) return "";
    return Math.ceil(perDay * d * (UNIT_DAYS[f.duration_unit] || 1));
  }, [f.frequency, f.duration_value, f.duration_unit]);
  const qty = qtyTouched ? f.quantity : suggestedQty;

  const allergyHit = useMemo(() => {
    const name = f.drug_name.trim().toLowerCase();
    if (!name || !allergies) return false;
    return allergies.toLowerCase().split(/[,;\n]/).map((s) => s.trim()).filter((s) => s.length > 2).some((a) => name.includes(a) || a.includes(name));
  }, [f.drug_name, allergies]);

  async function save() {
    if (!f.drug_name.trim()) return toast.error(kind === "drug" ? "Enter a drug name" : "Describe the treatment");
    setSaving(true);
    const { error } = await sb.from("consultation_treatment_items").insert({
      consultation_id: consultation.id, hospital_id: consultation.hospital_id, line_no: nextLine, kind,
      inventory_item_id: f.inventory_item_id, drug_name: f.drug_name.trim(), strength: f.strength || null, dose: f.dose || null,
      route: f.route || null, frequency: f.frequency || null, duration_value: f.duration_value ? Number(f.duration_value) : null,
      duration_unit: f.duration_value ? f.duration_unit : null, quantity: qty === "" ? null : Number(qty),
      instructions: f.instructions || null, give_in_clinic: f.give_in_clinic, created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Line added");
    qc.invalidateQueries({ queryKey: ["consultation", consultation.id, "treatment"] });
    onClose();
  }

  const chips = (list: string[], k: string) => (
    <div className="flex flex-wrap gap-1.5">
      {list.map((v) => <button key={v} type="button" onClick={() => set(k, f[k] === v ? "" : v)} className={cn("text-xs px-2.5 py-1 rounded-full border", f[k] === v ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/40")}>{v}</button>)}
    </div>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add treatment line</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-1.5">
            {(["drug", "procedure", "other"] as const).map((k) => <Button key={k} type="button" size="sm" variant={kind === k ? "default" : "secondary"} onClick={() => setKind(k)} className="capitalize">{k === "procedure" ? "Procedure" : k}</Button>)}
          </div>
          <div className="relative">
            <Label className="text-xs">{kind === "drug" ? "Drug" : "Treatment (e.g. IV fluids, nebulisation, wound dressing)"}</Label>
            <Input value={f.drug_name} onChange={(e) => { set("drug_name", e.target.value); set("inventory_item_id", null); }} placeholder={kind === "drug" ? "Search pharmacy or type a name" : ""} />
            {!!search.data?.length && (
              <ul className="absolute z-10 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
                {search.data.map((d: any) => (
                  <li key={d.id}>
                    <button type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2" onClick={() => setF((p: any) => ({ ...p, drug_name: d.drug_name, strength: d.strength || p.strength, inventory_item_id: d.id }))}>
                      <span className="flex-1">{d.drug_name} {d.strength && <span className="text-muted-foreground">{d.strength}</span>}</span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", (d.quantity_in_stock ?? 0) > 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>{(d.quantity_in_stock ?? 0) > 0 ? `In stock (${d.quantity_in_stock})` : "Out of stock"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {allergyHit && <p className="mt-1 text-xs text-warning flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />This matches the patient's recorded allergies ({allergies}).</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Strength</Label><Input value={f.strength} onChange={(e) => set("strength", e.target.value)} placeholder="100 mg" /></div>
            <div><Label className="text-xs">Dose</Label><Input value={f.dose} onChange={(e) => set("dose", e.target.value)} placeholder="1 tab" /></div>
          </div>
          <div><Label className="text-xs">Route</Label>{chips(ROUTES, "route")}</div>
          <div><Label className="text-xs">Frequency</Label>{chips(FREQS, "frequency")}</div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Duration</Label><Input inputMode="numeric" value={f.duration_value} onChange={(e) => set("duration_value", e.target.value.replace(/\D/g, ""))} /></div>
            <div><Label className="text-xs">Unit</Label>
              <select className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm" value={f.duration_unit} onChange={(e) => set("duration_unit", e.target.value)}>
                <option value="days">days</option><option value="weeks">weeks</option><option value="months">months</option>
              </select>
            </div>
            <div><Label className="text-xs">Quantity</Label><Input inputMode="numeric" value={qty} onChange={(e) => { setQtyTouched(true); set("quantity", e.target.value.replace(/\D/g, "")); }} /></div>
          </div>
          <div><Label className="text-xs">Instructions</Label><Input value={f.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="After meals" /></div>
          <label className="flex items-center justify-between gap-3 text-sm"><span>Give in clinic (nurse to administer)</span><Switch checked={f.give_in_clinic} onCheckedChange={(v) => set("give_in_clinic", v)} /></label>
          <Button className="w-full" disabled={saving} onClick={save}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}Add line</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
