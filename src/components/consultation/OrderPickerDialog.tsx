import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { useInvestigationCatalog, matchItem, type PickerItem } from "@/hooks/useInvestigationCatalog";
import { AlertTriangle, Loader2, Search, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const sb = supabase as any;
export type PickerMode = "lab" | "radiology" | "more";
const RADIOLOGY_TABS = ["X-ray", "Ultrasound", "CT", "MRI", "Mammography", "Special/Contrast"];
const DEFAULT_XRAY_VIEWS = ["AP", "PA", "LAT", "Oblique", "Erect", "Supine"];
type Sel = { item: PickerItem; views: string[]; otherView: string; laterality: "" | "left" | "right" | "bilateral" };

const Chip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button type="button" onClick={onClick} className={cn("px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition",
    active ? "bg-primary text-primary-foreground border-primary" : "bg-muted/40 border-border hover:bg-muted")}>{children}</button>
);

export function OrderPickerDialog({ mode, onClose, consultation }: { mode: PickerMode | null; onClose: () => void; consultation: any }) {
  const isMobile = useIsMobile();
  const open = !!mode;
  const title = mode === "lab" ? "Add lab tests" : mode === "radiology" ? "Add radiology" : "Add other investigations";
  const body = mode ? <PickerBody key={mode} mode={mode} consultation={consultation} onDone={onClose} /> : null;
  if (isMobile) return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="h-[100dvh] p-0 flex flex-col"><SheetHeader className="px-4 pt-4"><SheetTitle>{title}</SheetTitle></SheetHeader>{body}</SheetContent>
    </Sheet>
  );
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl h-[90vh] p-0 flex flex-col gap-0"><DialogHeader className="px-5 pt-5"><DialogTitle>{title}</DialogTitle></DialogHeader>{body}</DialogContent>
    </Dialog>
  );
}

function PickerBody({ mode, consultation, onDone }: { mode: PickerMode; consultation: any; onDone: () => void }) {
  const { data: catalog = [], isLoading, isError, refetch } = useInvestigationCatalog();
  const qc = useQueryClient();
  const p = consultation.patients || {};
  const pool = useMemo(() => catalog.filter((i) => (mode === "lab" ? i.kind === "lab" : mode === "radiology" ? i.kind === "imaging" : i.kind === "other")), [catalog, mode]);
  const sections = useMemo(() => (mode === "radiology" ? RADIOLOGY_TABS : Array.from(new Set(pool.map((i) => i.section)))), [pool, mode]);
  const [section, setSection] = useState<string>(mode === "radiology" ? "X-ray" : "All");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Sel[]>([]);
  const [custom, setCustom] = useState("");
  const [priority, setPriority] = useState<"routine" | "urgent" | "stat">("routine");
  const [fasting, setFasting] = useState(false);
  const [clinical, setClinical] = useState("");
  const [billTo, setBillTo] = useState<"patient" | "hmo" | "company" | "hospital">(p.insurance_provider ? "hmo" : "patient");
  const [dest, setDest] = useState<"in_house" | "external">("in_house");
  const [facility, setFacility] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  // Prefill clinical info and load last-24h orders for duplicate warnings.
  useEffect(() => {
    (async () => {
      const { data: h } = await sb.from("consultation_history").select("chief_complaints").eq("consultation_id", consultation.id).maybeSingle();
      const core: any = qc.getQueryData(["consultation", consultation.id, "core"]) || consultation;
      const complaints = (h?.chief_complaints || []).map((c: any) => c.name).filter(Boolean).join(", ");
      setClinical([core.provisional_diagnosis && `Provisional dx: ${core.provisional_diagnosis}`, complaints && `Complaints: ${complaints}`].filter(Boolean).join(". "));
      const since = new Date(Date.now() - 864e5).toISOString();
      const [l, d] = await Promise.all([
        sb.from("lab_results").select("created_at, lab_result_tests(test_name)").eq("patient_id", consultation.patient_id).gte("created_at", since),
        sb.from("diagnostic_requests").select("item_name").eq("patient_id", consultation.patient_id).is("cancelled_at", null).gte("ordered_at", since),
      ]);
      setRecent([...(l.data || []).flatMap((o: any) => (o.lab_result_tests || []).map((t: any) => t.test_name)), ...(d.data || []).map((r: any) => r.item_name)].map((s: string) => s.toLowerCase()));
    })();
  }, [consultation, qc]);

  useEffect(() => { if (sel.some((s) => s.item.fasting)) setFasting(true); }, [sel]);

  const list = useMemo(() => pool.filter((i) => (q.trim() ? true : section === "All" || i.section === section) && matchItem(i, q)), [pool, section, q]);
  const isSel = (i: PickerItem) => sel.some((s) => s.item.key === i.key);
  const toggle = (i: PickerItem) => setSel((s) => (isSel(i) ? s.filter((x) => x.item.key !== i.key) : [...s, { item: i, views: [], otherView: "", laterality: "" }]));
  const patch = (key: string, v: Partial<Sel>) => setSel((s) => s.map((x) => (x.item.key === key ? { ...x, ...v } : x)));
  const addCustom = () => {
    const n = custom.trim(); if (!n) return;
    const kind = mode === "lab" ? "lab" : mode === "radiology" ? "imaging" : "other";
    setSel((s) => [...s, { item: { key: `custom:${Date.now()}`, kind, section: "Custom", name: n, aliases: [], fasting: false, views: [], laterality: false }, views: [], otherView: "", laterality: "" }]);
    setCustom("");
  };
  const dupes = sel.filter((s) => recent.includes(s.item.name.toLowerCase()));

  async function send() {
    if (!sel.length) return toast.error("Select at least one item.");
    if (dest === "external" && !facility.trim()) return toast.error("Enter the external facility name.");
    for (const s of sel) if (s.item.laterality && !s.laterality) return toast.error(`Choose Left / Right / Both for ${s.item.name}.`);
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const labs = dest === "in_house" ? sel.filter((s) => s.item.kind === "lab") : [];
      const rest = sel.filter((s) => !labs.includes(s));
      if (labs.length) {
        const { data: lr, error } = await sb.from("lab_results").insert({
          hospital_id: consultation.hospital_id, patient_id: consultation.patient_id, ordered_by: consultation.doctor_id,
          consultation_id: consultation.id, status: "pending", priority, fasting, clinical_info: clinical || null, bill_to: billTo, notes: clinical || null,
        }).select("id").single();
        if (error) throw error;
        const { error: tErr } = await sb.from("lab_result_tests").insert(labs.map((s) => ({
          lab_result_id: lr.id, test_name: s.item.name, category_name: s.item.section,
          catalog_test_id: s.item.labCatalogId || null, is_custom: !s.item.labCatalogId,
        })));
        if (tErr) throw tErr;
      }
      if (rest.length) {
        const { error } = await sb.from("diagnostic_requests").insert(rest.map((s) => ({
          hospital_id: consultation.hospital_id, consultation_id: consultation.id, patient_id: consultation.patient_id,
          ordered_by: consultation.doctor_id, catalog_item_id: s.item.catalogId || null, item_name: s.item.name,
          kind: s.item.kind, section: s.item.section, views: s.views, other_view: s.otherView.trim() || null,
          laterality: s.laterality || null, priority, fasting, clinical_info: clinical || null, bill_to: billTo,
          destination: dest, external_facility: dest === "external" ? facility.trim() : null,
        })));
        if (error) throw error;
      }
      void auth;
      toast.success(`${sel.length} item${sel.length > 1 ? "s" : ""} ordered`);
      qc.invalidateQueries({ queryKey: ["consultation", consultation.id, "investigations"] });
      qc.invalidateQueries({ queryKey: ["lab-results"] });
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Couldn't send the order");
    } finally { setBusy(false); }
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 md:px-5 pt-3 space-y-2">
        <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input autoFocus placeholder="Search by name or alias (e.g. FBC, CXR, ECG)" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {mode !== "radiology" && <Chip active={section === "All"} onClick={() => setSection("All")}>All</Chip>}
          {sections.map((s) => <Chip key={s} active={section === s} onClick={() => setSection(s)}>{s}</Chip>)}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-5 py-2 space-y-4">
        {isLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading catalog…</div>
          : isError ? <p className="text-sm text-destructive">Couldn't load the catalog. <button className="underline" onClick={() => refetch()}>Try again</button></p>
          : (
            <ul className="divide-y divide-border border border-border rounded-lg">
              {list.length === 0 && <li className="p-3 text-sm text-muted-foreground">No match. Use "Custom request" below.</li>}
              {list.map((i) => (
                <li key={i.key}>
                  <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/40">
                    <Checkbox checked={isSel(i)} onCheckedChange={() => toggle(i)} />
                    <span className="flex-1 min-w-0 text-sm">{i.name}{q && <span className="text-xs text-muted-foreground"> · {i.section}</span>}</span>
                    {i.fasting && <span className="text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning">Fasting</span>}
                    {i.laterality && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">L/R</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}

        <div>
          <Label className="text-xs">Custom request</Label>
          <div className="flex gap-2 mt-1"><Input value={custom} placeholder="Anything not listed" onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustom())} />
            <Button type="button" variant="outline" onClick={addCustom}><Plus className="w-4 h-4" />Add</Button></div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Priority</Label><div className="flex gap-1.5 mt-1">{(["routine", "urgent", "stat"] as const).map((v) => <Chip key={v} active={priority === v} onClick={() => setPriority(v)}>{v === "stat" ? "STAT" : v[0].toUpperCase() + v.slice(1)}</Chip>)}</div></div>
          <div><Label className="text-xs">Bill to</Label><div className="flex flex-wrap gap-1.5 mt-1">{(["patient", "hmo", "company", "hospital"] as const).map((v) => <Chip key={v} active={billTo === v} onClick={() => setBillTo(v)}>{v === "hmo" ? "HMO" : v[0].toUpperCase() + v.slice(1)}</Chip>)}</div></div>
          <div><Label className="text-xs">Send to</Label><div className="flex gap-1.5 mt-1"><Chip active={dest === "in_house"} onClick={() => setDest("in_house")}>In-house</Chip><Chip active={dest === "external"} onClick={() => setDest("external")}>External facility</Chip></div>
            {dest === "external" && <Input className="mt-2" placeholder="Facility name" value={facility} onChange={(e) => setFacility(e.target.value)} />}</div>
          <label className="flex items-center gap-2 text-sm self-end"><Checkbox checked={fasting} onCheckedChange={(v) => setFasting(!!v)} />Fasting required</label>
        </div>
        <div><Label className="text-xs">Clinical info</Label><Textarea rows={2} value={clinical} onChange={(e) => setClinical(e.target.value)} /></div>
      </div>

      <div className="border-t border-border px-4 md:px-5 py-3 space-y-2 bg-background">
        {dupes.length > 0 && <p className="text-xs text-warning flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />Already ordered in the last 24 hours: {dupes.map((d) => d.item.name).join(", ")}</p>}
        {sel.length > 0 && (
          <ul className="max-h-48 overflow-y-auto space-y-1.5">
            {sel.map((s) => {
              const isXray = s.item.kind === "imaging" && s.item.section === "X-ray";
              const views = s.item.views.length ? s.item.views : DEFAULT_XRAY_VIEWS;
              return (
                <li key={s.item.key} className="rounded-md bg-muted/40 px-2.5 py-1.5">
                  <div className="flex items-center gap-2"><span className="text-sm flex-1 min-w-0 truncate">{s.item.name}</span>
                    <button aria-label={`Remove ${s.item.name}`} onClick={() => setSel((x) => x.filter((y) => y.item.key !== s.item.key))} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button></div>
                  {(isXray || s.item.laterality) && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      {isXray && views.map((v) => <Chip key={v} active={s.views.includes(v)} onClick={() => patch(s.item.key, { views: s.views.includes(v) ? s.views.filter((x) => x !== v) : [...s.views, v] })}>{v}</Chip>)}
                      {isXray && <Input className="h-7 w-36 text-xs" placeholder="Other view" value={s.otherView} onChange={(e) => patch(s.item.key, { otherView: e.target.value })} />}
                      {s.item.laterality && (["left", "right", "bilateral"] as const).map((v) => <Chip key={v} active={s.laterality === v} onClick={() => patch(s.item.key, { laterality: v })}>{v === "bilateral" ? "Both" : v[0].toUpperCase() + v.slice(1)}</Chip>)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{sel.length} selected</span>
          <Button className="ml-auto" disabled={busy || !sel.length} onClick={send}>{busy && <Loader2 className="w-4 h-4 animate-spin" />}Send order</Button>
        </div>
      </div>
    </div>
  );
}
