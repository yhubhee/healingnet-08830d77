import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PatientPicker } from "./PatientPicker";
import { useDoctor, useDoctorPatients } from "@/hooks/useDoctor";
import { useCreateLabOrder } from "@/api/hooks/useLab";
import type { NewLabOrderTest } from "@/api/types";
import { toast } from "sonner";
import { Loader2, FlaskConical, X, Plus, Search, ChevronDown } from "lucide-react";
import { LAB_CATALOG, LAB_BUNDLES, LAB_CATEGORIES, findCatalogTest, type LabCategory } from "@/lib/lab/catalog";
import { cn } from "@/lib/utils";


export function OrderLabTestDialog({ trigger, patientId: lockedPatientId }: { trigger: React.ReactNode; patientId?: string }) {
  const [open, setOpen] = useState(false);
  const { data: ctx } = useDoctor();
  const { data: patients = [] } = useDoctorPatients(ctx?.doctor?.id);
  const [patientId, setPatientId] = useState<string | null>(lockedPatientId || null);
  const [selected, setSelected] = useState<string[]>([]);
  const [customs, setCustoms] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [openCats, setOpenCats] = useState<Record<string, boolean>>({ Hematology: true });
  const createOrder = useCreateLabOrder();

  useEffect(() => { if (lockedPatientId) setPatientId(lockedPatientId); }, [lockedPatientId]);
  const hospitalId = ctx?.hospitals?.[0]?.id;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return LAB_CATALOG;
    return LAB_CATALOG.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.parameters.some((p) => p.name.toLowerCase().includes(q)),
    );
  }, [search]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof LAB_CATALOG> = {};
    LAB_CATEGORIES.forEach((c) => (map[c] = []));
    filtered.forEach((t) => { (map[t.category] ||= []).push(t); });
    return map;
  }, [filtered]);

  function toggleTest(id: string) {
    setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  }
  function applyBundle(ids: string[]) {
    setSelected((s) => Array.from(new Set([...s, ...ids])));
  }
  function updateCustom(i: number, v: string) {
    setCustoms((c) => c.map((x, j) => j === i ? v : x));
  }

  async function submit() {
    if (!patientId) return toast.error("Choose a patient");
    const cleanCustoms = customs.map((c) => c.trim()).filter(Boolean);
    if (!selected.length && !cleanCustoms.length) return toast.error("Select at least one test");
    if (!hospitalId) return toast.error("You're not linked to any hospital yet");

    const tests: NewLabOrderTest[] = [];
    selected.forEach((id) => {
      const t = findCatalogTest(id);
      if (!t) return;
      tests.push({ name: t.name, categoryName: t.category, catalogTestId: t.id, isCustom: false });
    });
    cleanCustoms.forEach((name) => {
      tests.push({ name, categoryName: "Custom", catalogTestId: null, isCustom: true });
    });

    setSaving(true);
    try {
      await createOrder.mutateAsync({
        patientId,
        hospitalId,
        doctorId: ctx!.doctor.id,
        notes,
        tests,
      });
      toast.success(`Lab order created (${tests.length} test${tests.length > 1 ? "s" : ""})`);
      setOpen(false);
      setSelected([]); setCustoms([]); setNotes(""); setSearch("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create order");
    } finally {
      setSaving(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><FlaskConical className="w-4 h-4 text-warning" />Order Lab Tests</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {!lockedPatientId && (
            <div><Label>Patient</Label><PatientPicker patients={patients as any} value={patientId} onChange={setPatientId} /></div>
          )}

          {/* Quick-pick bundles */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Quick bundles</Label>
            <div className="flex gap-2 flex-wrap mt-1.5">
              {LAB_BUNDLES.map((b) => (
                <button key={b.id} type="button" onClick={() => applyBundle(b.testIds)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition">
                  + {b.name}
                </button>
              ))}
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tests…" className="pl-9" />
          </div>

          {/* Selected chips */}
          {(selected.length > 0 || customs.some(Boolean)) && (
            <div className="border border-border rounded-lg p-3 bg-muted/30">
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                Selected ({selected.length + customs.filter(Boolean).length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selected.map((id) => {
                  const t = findCatalogTest(id);
                  if (!t) return null;
                  return (
                    <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/15 text-primary text-xs font-medium">
                      {t.name}
                      <button type="button" onClick={() => toggleTest(id)}><X className="w-3 h-3" /></button>
                    </span>
                  );
                })}
                {customs.map((c, i) => c.trim() && (
                  <span key={`c-${i}`} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-warning/15 text-warning text-xs font-medium">
                    {c} <span className="opacity-60">(custom)</span>
                    <button type="button" onClick={() => setCustoms(customs.filter((_, j) => j !== i))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Category list */}
          <div className="space-y-1.5 border border-border rounded-lg divide-y divide-border">
            {LAB_CATEGORIES.map((cat) => {
              const items = grouped[cat] || [];
              if (!items.length) return null;
              const isOpen = openCats[cat] ?? !!search;
              return (
                <Collapsible key={cat} open={isOpen} onOpenChange={(o) => setOpenCats({ ...openCats, [cat]: o })}>
                  <CollapsibleTrigger className="flex items-center justify-between w-full px-3 py-2.5 hover:bg-muted/40 text-left">
                    <span className="text-sm font-semibold">{cat} <span className="text-muted-foreground font-normal">({items.length})</span></span>
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition", isOpen && "rotate-180")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 space-y-1">
                    {items.map((t) => {
                      const checked = selected.includes(t.id);
                      return (
                        <label key={t.id} className={cn("flex items-start gap-2.5 p-2 rounded-md cursor-pointer hover:bg-muted/40", checked && "bg-primary/5")}>
                          <Checkbox checked={checked} onCheckedChange={() => toggleTest(t.id)} className="mt-0.5" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{t.name}</div>
                            <div className="text-xs text-muted-foreground line-clamp-1">
                              {t.parameters.slice(0, 4).map((p) => p.name).join(", ")}
                              {t.parameters.length > 4 && ` +${t.parameters.length - 4} more`}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>

          {/* Custom tests */}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Other — specify test</Label>
            <div className="space-y-2 mt-1.5">
              {customs.map((c, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={c} onChange={(e) => updateCustom(i, e.target.value)} placeholder="e.g. HIV screening" />
                  <Button variant="ghost" size="icon" onClick={() => setCustoms(customs.filter((_, j) => j !== i))}><X className="w-4 h-4" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setCustoms([...customs, ""])}>
                <Plus className="w-4 h-4" />Add custom test
              </Button>
            </div>
          </div>

          <div><Label>Clinical notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for order, relevant history…" /></div>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Send order ({selected.length + customs.filter(Boolean).length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
