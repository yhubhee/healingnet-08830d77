import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { X, Plus, Printer, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { SectionCard } from "./SectionCard";
import { useInvestigations } from "@/hooks/useConsultation";
import { useState } from "react";
import { printRequestSlip } from "./requestSlip";
import { OrderPickerDialog, type PickerMode } from "./OrderPickerDialog";

const sb = supabase as any;

function labPill(status?: string) {
  const s = (status || "pending").toLowerCase();
  if (s === "completed" || s === "resulted") return { label: "Resulted", cls: "bg-success/15 text-success" };
  if (s === "processing" || s === "in_progress") return { label: "Processing", cls: "bg-info/15 text-info" };
  if (s === "collected" || s === "sample_collected") return { label: "Sample collected", cls: "bg-primary/15 text-primary" };
  if (s === "cancelled") return { label: "Cancelled", cls: "bg-muted text-muted-foreground" };
  return { label: "Requested", cls: "bg-warning/15 text-warning" };
}
function dxPill(r: any) {
  if (r.cancelled_at) return { label: "Cancelled", cls: "bg-muted text-muted-foreground" };
  if (r.reported_at) return { label: "Reported", cls: "bg-success/15 text-success" };
  if (r.performed_at) return { label: "Processing", cls: "bg-info/15 text-info" };
  return { label: "Requested", cls: "bg-warning/15 text-warning" };
}
const Pill = ({ p }: { p: { label: string; cls: string } }) => <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap", p.cls)}>{p.label}</span>;

export function InvestigationsCard({ consultation, readOnly }: { consultation: any; readOnly: boolean }) {
  const consultationId = consultation.id;
  const [picker, setPicker] = useState<PickerMode | null>(null);
  const { data, isLoading, isError, refetch } = useInvestigations(consultationId);
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["consultation", consultationId, "investigations"] });

  const tests = (data?.labs || []).flatMap((o: any) => (o.lab_result_tests || []).map((t: any) => ({ ...t, order: o })));
  const radiology = (data?.requests || []).filter((r: any) => r.kind === "imaging");
  const other = (data?.requests || []).filter((r: any) => !(r.kind === "imaging"));
  const total = tests.length + (data?.requests?.length || 0);

  async function cancelTest(t: any) {
    const { error } = await sb.from("lab_result_tests").delete().eq("id", t.id).eq("status", "pending");
    if (error) return toast.error(error.message);
    toast.success("Test removed"); refresh();
  }
  async function cancelRequest(r: any) {
    const { error } = await sb.from("diagnostic_requests").update({ cancelled_at: new Date().toISOString() }).eq("id", r.id).is("performed_at", null);
    if (error) return toast.error(error.message);
    toast.success("Request cancelled"); refresh();
  }

  return (
    <SectionCard title="Investigations" completion={total ? "done" : "empty"}>
      {isLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div>
        : isError ? <div className="text-sm text-destructive">Couldn't load investigations. <button className="underline" onClick={() => refetch()}>Try again</button></div>
        : total === 0 ? <p className="text-sm text-muted-foreground">Nothing ordered yet.</p> : (
          <div className="space-y-4">
            {tests.length > 0 && (
              <Group title="Lab">
                {tests.map((t: any) => {
                  const params = [...(t.lab_result_parameters || [])].sort((a: any, b: any) => a.sort_order - b.sort_order);
                  return (
                    <li key={t.id} className="rounded-lg border border-border p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium flex-1 min-w-0 truncate">{t.test_name}</span>
                        <Pill p={labPill(t.status)} />
                        {!readOnly && (t.status || "pending") === "pending" && <button aria-label="Remove test" onClick={() => cancelTest(t)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>}
                      </div>
                      {params.some((p: any) => p.result_value) ? (
                        <div className="mt-2 space-y-1">
                          {params.filter((p: any) => p.result_value).map((p: any) => {
                            const f = (p.flag || "").toLowerCase();
                            const crit = f.includes("critical");
                            return (
                              <div key={p.id} className="grid grid-cols-[1fr_auto] gap-2 text-xs">
                                <span className="text-muted-foreground truncate">{p.parameter_name}</span>
                                <span className={cn("font-medium text-right", crit ? "text-destructive" : f === "high" || f === "low" || f === "abnormal" ? "text-warning" : "")}>
                                  {p.result_value} {p.unit_snapshot} {f === "high" ? "H" : f === "low" ? "L" : crit ? "!!" : ""}
                                  {p.ref_range_snapshot && <span className="text-muted-foreground font-normal"> ({p.ref_range_snapshot})</span>}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      ) : t.result_value ? <p className={cn("text-xs mt-1", t.is_abnormal && "text-warning")}>{t.result_value} {t.unit} {t.reference_range && `(${t.reference_range})`}</p> : null}
                    </li>
                  );
                })}
              </Group>
            )}
            {[["Radiology", radiology], ["Other", other]].map(([title, list]: any) => list.length > 0 && (
              <Group key={title} title={title}>
                {list.map((r: any) => (
                  <li key={r.id} className="rounded-lg border border-border p-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium flex-1 min-w-0 truncate">{r.item_name}{r.views?.length ? ` (${r.views.join(", ")})` : ""}{r.laterality ? ` · ${r.laterality}` : ""}</span>
                      <Pill p={dxPill(r)} />
                      {!readOnly && !r.performed_at && !r.cancelled_at && <button aria-label="Cancel request" onClick={() => cancelRequest(r)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>}
                    </div>
                    {r.report_text && <p className="text-xs mt-1 whitespace-pre-wrap">{r.report_text}</p>}
                  </li>
                ))}
              </Group>
            ))}
          </div>
        )}
      {!readOnly && (
        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => setPicker("lab")}><Plus className="w-3.5 h-3.5" />Add Lab</Button>
          <Button size="sm" variant="outline" onClick={() => setPicker("radiology")}><Plus className="w-3.5 h-3.5" />Add Radiology</Button>
          <Button size="sm" variant="outline" onClick={() => setPicker("more")}><Plus className="w-3.5 h-3.5" />Add More</Button>
          <Button size="sm" variant="ghost" disabled={total === 0} onClick={async () => { if (!(await printRequestSlip(consultation, tests, data?.requests || []))) toast.error("Allow pop-ups to print the slip"); }}><Printer className="w-3.5 h-3.5" />Print request slip</Button>
        </div>
      )}
      <OrderPickerDialog mode={picker} onClose={() => setPicker(null)} consultation={consultation} />
    </SectionCard>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{title}</h3><ul className="space-y-2">{children}</ul></div>;
}
