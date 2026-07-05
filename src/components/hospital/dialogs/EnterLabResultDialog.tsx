import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useHospitalInfo } from "@/hooks/useHospitalData";
import { AlertCircle, Bold, FileUp, FlaskConical, Italic, List, Loader2, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { computeFlag, type FlagLevel } from "@/lib/lab/panels";
import { findCatalogTest, resolveRange, type CatalogTest, type ParamKind } from "@/lib/lab/catalog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ParamResult = {
  name: string;
  result_value?: string;
  unit?: string;
  reference_range?: string;
  range_low?: number;
  range_high?: number;
  flag?: FlagLevel;
  kind?: ParamKind;
  options?: string[];
  expectedNormal?: string;
  dependsOn?: string;
  dependsOnValue?: string;
  forcedValue?: string;
};

type OrderedTest = {
  id: string;                // lab_result_tests.id
  test_name: string;
  catalog_test_id?: string | null;
  is_custom?: boolean;
  category_name?: string;
  parameters?: ParamResult[] | null;
};

const FLAG_STYLES: Record<FlagLevel, { label: string; className: string }> = {
  normal: { label: "Normal", className: "bg-success/15 text-success border border-success/30" },
  low: { label: "Low", className: "bg-warning/15 text-warning border border-warning/30" },
  high: { label: "High", className: "bg-warning/15 text-warning border border-warning/30" },
  abnormal: { label: "Positive", className: "bg-destructive/15 text-destructive border border-destructive/30" },
  unknown: { label: "—", className: "bg-muted text-muted-foreground border border-border" },
};

function paramsFromCatalog(t: CatalogTest, sex?: string | null): ParamResult[] {
  return t.parameters.map((p) => {
    const r = resolveRange(p, sex);
    return {
      name: p.name,
      unit: p.unit,
      reference_range: r.range,
      range_low: r.low,
      range_high: r.high,
      result_value: "",
      kind: p.kind,
      options: p.options,
      expectedNormal: p.expectedNormal,
      dependsOn: p.dependsOn,
      dependsOnValue: p.dependsOnValue,
      forcedValue: p.forcedValue,
    };
  });
}

function flagForParam(p: ParamResult, sex?: string | null): FlagLevel {
  return computeFlag(p.result_value, p.range_low, p.range_high, {
    kind: p.kind,
    reference_range: p.reference_range,
    expectedNormal: p.expectedNormal,
    sex,
  });
}

export function EnterLabResultDialog({ order, open, onClose }: { order: any; open: boolean; onClose: () => void }) {
  const { data: hospital } = useHospitalInfo();
  const [tests, setTests] = useState<OrderedTest[]>([]);
  const [interpretation, setInterpretation] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const interpretationRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const patientSex = order?.patients?.gender;

  // Hydrate whenever a new order opens
  useEffect(() => {
    if (!order) { setTests([]); return; }
    const src: any[] = order.lab_result_tests || [];
    const hydrated: OrderedTest[] = src.map((row: any) => {
      const catalog = findCatalogTest(row.catalog_test_id);
      let parameters: ParamResult[] = [];
      if (Array.isArray(row.parameters) && row.parameters.length > 0) {
        parameters = row.parameters as ParamResult[];
      } else if (catalog) {
        parameters = paramsFromCatalog(catalog, patientSex);
      } else if (row.is_custom || !catalog) {
        parameters = [{
          name: row.test_name || "",
          result_value: row.result_value || "",
          unit: row.unit || "",
          reference_range: row.reference_range || "",
        }];
      }
      return {
        id: row.id,
        test_name: row.test_name,
        catalog_test_id: row.catalog_test_id,
        is_custom: row.is_custom || (!row.catalog_test_id && !catalog),
        category_name: row.category_name,
        parameters,
      };
    });
    setTests(hydrated);
    setInterpretation(order.notes || "");
    setFiles([]);
  }, [order?.id]);

  function updateParam(ti: number, pi: number, field: keyof ParamResult, value: any) {
    setTests((prev) => {
      const n = [...prev];
      const params = [...(n[ti].parameters || [])];
      (params[pi] as any)[field] = value;
      if (field === "result_value") {
        params[pi].flag = flagForParam(params[pi], patientSex);
      }
      // Cascade: if this param gates any dependent, sync/lock the dependent
      if (field === "result_value") {
        const changedName = params[pi].name;
        params.forEach((dep, di) => {
          if (dep.dependsOn && dep.dependsOn === changedName) {
            if (dep.dependsOnValue && value !== dep.dependsOnValue) {
              if (dep.forcedValue !== undefined) {
                dep.result_value = dep.forcedValue;
                dep.flag = flagForParam(dep, patientSex);
              }
            }
          }
        });
      }
      n[ti] = { ...n[ti], parameters: params };
      return n;
    });
  }

  function addCustomParamRow(ti: number) {
    setTests((prev) => {
      const n = [...prev];
      n[ti] = { ...n[ti], parameters: [...(n[ti].parameters || []), { name: "", result_value: "", unit: "", reference_range: "" }] };
      return n;
    });
  }
  function removeParamRow(ti: number, pi: number) {
    setTests((prev) => {
      const n = [...prev];
      n[ti] = { ...n[ti], parameters: (n[ti].parameters || []).filter((_, j) => j !== pi) };
      return n;
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setFiles(Array.from(e.target.files));
  }

  function wrapSelection(before: string, after = before) {
    const ta = interpretationRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const value = interpretation;
    const selected = value.slice(start, end) || "text";
    setInterpretation(value.slice(0, start) + before + selected + after + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + selected.length;
    });
  }
  function prefixLines() {
    const ta = interpretationRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const value = interpretation;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const target = value.slice(lineStart, end || start);
    const bulleted = target.split("\n").map((l) => (l.startsWith("- ") ? l : `- ${l}`)).join("\n");
    setInterpretation(value.slice(0, lineStart) + bulleted + value.slice(end || start));
  }

  const patientName = `${order?.patients?.first_name || ""} ${order?.patients?.last_name || ""}`.trim() || "—";
  const doctorName = order?.doctors ? `Dr. ${order.doctors.first_name} ${order.doctors.last_name}` : "—";
  const labId = order ? `LAB-${order.id.slice(0, 4).toUpperCase()}` : "";
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const abnormalCount = useMemo(() => {
    let n = 0;
    tests.forEach((t) => (t.parameters || []).forEach((p) => {
      const f = flagForParam(p, patientSex);
      if (f === "low" || f === "high" || f === "abnormal") n++;
    }));
    return n;
  }, [tests, patientSex]);

  function buildReportBody() {
    const lines: string[] = [];
    lines.push(`${hospital?.name || "HealingNet Hospital"}`);
    lines.push(`Laboratory Report`);
    lines.push("");
    lines.push(`Patient: ${patientName}`);
    lines.push(`Lab ID: ${labId}`);
    lines.push(`Ordering Doctor: ${doctorName}`);
    lines.push(`Report Date: ${today}`);
    lines.push("");

    tests.forEach((t) => {
      lines.push(`▪ ${t.test_name}${t.is_custom ? "  (custom)" : ""}`);
      lines.push(`------------------------------------------------------------`);
      lines.push(`Parameter                Result       Unit      Range        Flag`);
      lines.push(`------------------------------------------------------------`);
      (t.parameters || []).forEach((p) => {
        const flag = computeFlag(p.result_value, p.range_low, p.range_high);
        const flagLabel = FLAG_STYLES[flag].label;
        lines.push(
          `${(p.name || "").padEnd(24)} ${(p.result_value || "").toString().padEnd(12)} ${(p.unit || "").padEnd(9)} ${(p.reference_range || "").padEnd(12)} ${flagLabel}`,
        );
      });
      lines.push("");
    });

    if (interpretation.trim()) {
      lines.push(`CLINICAL INTERPRETATION`);
      lines.push(interpretation.trim());
      lines.push("");
    }
    lines.push(`This is an official laboratory report issued by ${hospital?.name || "HealingNet Hospital"}.`);
    return lines.join("\n");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    if (tests.length === 0) return toast({ title: "No tests on this order", variant: "destructive" });
    setSaving(true);
    try {
      // Persist parameters per ordered-test row
      for (const t of tests) {
        const params = (t.parameters || []).map((p) => ({
          ...p,
          flag: computeFlag(p.result_value, p.range_low, p.range_high),
        }));
        const anyAbnormal = params.some((p) => p.flag === "low" || p.flag === "high");
        // Also mirror the first parameter's result into legacy fields so table previews still work
        const first = params[0];
        await supabase.from("lab_result_tests").update({
          parameters: params as any,
          is_abnormal: anyAbnormal,
          result_value: first?.result_value || null,
          unit: first?.unit || null,
          reference_range: first?.reference_range || null,
        } as any).eq("id", t.id);
      }

      await supabase.from("lab_results")
        .update({ status: "completed", notes: interpretation || null })
        .eq("id", order.id);

      const body = buildReportBody();
      const { error: letterErr } = await supabase.from("patient_letters" as any).insert({
        patient_id: order.patient_id,
        hospital_id: order.hospital_id || hospital?.id || null,
        doctor_id: order.ordered_by || null,
        letter_type: "lab_report",
        title: `Laboratory Report — ${labId}`,
        body,
        status: "issued",
        issued_at: new Date().toISOString(),
      });
      if (letterErr) throw letterErr;

      toast({ title: "Report saved and issued to patient" });
      qc.invalidateQueries({ queryKey: ["lab-results"] });
      qc.invalidateQueries({ queryKey: ["patient-letters"] });
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
        {/* Letterhead */}
        <div className="bg-gradient-to-br from-primary/10 via-card to-card border-b border-border p-6">
          <DialogHeader className="mb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <DialogTitle className="text-xl font-heading font-bold">
                  {hospital?.name || "HealingNet Hospital"}
                </DialogTitle>
                <p className="text-xs uppercase tracking-widest text-primary font-semibold mt-1">
                  Laboratory Report
                </p>
              </div>
              <div className="w-11 h-11 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <FlaskConical className="w-6 h-6" />
              </div>
            </div>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 pt-4 border-t border-border/60">
            <InfoCell label="Patient" value={patientName} />
            <InfoCell label="Lab ID" value={labId} mono />
            <InfoCell label="Ordering Doctor" value={doctorName} />
            <InfoCell label="Report Date" value={today} />
          </div>
        </div>

        <form onSubmit={submit} className="p-6 space-y-6">
          {abnormalCount > 0 && (
            <Alert className="border-warning/40 bg-warning/10">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription>{abnormalCount} abnormal result(s) detected</AlertDescription>
            </Alert>
          )}

          {tests.length === 0 && (
            <div className="border border-border rounded-lg p-8 text-center text-sm text-muted-foreground">
              No tests were attached to this order.
            </div>
          )}

          {tests.map((t, ti) => (
            <div key={t.id} className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border">
                <div>
                  <h3 className="font-semibold text-sm">
                    {t.test_name}
                    {t.is_custom && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-warning/15 text-warning">custom</span>}
                  </h3>
                  {t.category_name && <p className="text-xs text-muted-foreground">{t.category_name}</p>}
                </div>
                {t.is_custom && (
                  <Button type="button" variant="outline" size="sm" onClick={() => addCustomParamRow(ti)}>
                    + Row
                  </Button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/20">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="p-3 font-semibold">Parameter</th>
                      <th className="p-3 font-semibold w-32">Result</th>
                      <th className="p-3 font-semibold w-28">Unit</th>
                      <th className="p-3 font-semibold w-36">Reference range</th>
                      <th className="p-3 font-semibold w-24">Flag</th>
                      {t.is_custom && <th className="p-3 w-10"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {(t.parameters || []).map((p, pi) => {
                      const flag = computeFlag(p.result_value, p.range_low, p.range_high);
                      const style = FLAG_STYLES[flag];
                      return (
                        <tr key={pi} className="border-t border-border/60">
                          <td className="p-2 align-top">
                            {t.is_custom ? (
                              <Input value={p.name || ""} onChange={(e) => updateParam(ti, pi, "name", e.target.value)} placeholder="Parameter" className="h-9" />
                            ) : (
                              <div className="px-1 py-1.5 text-sm font-medium">{p.name}</div>
                            )}
                          </td>
                          <td className="p-2 align-top">
                            <Input value={p.result_value || ""} onChange={(e) => updateParam(ti, pi, "result_value", e.target.value)} placeholder="—" className="h-9" />
                          </td>
                          <td className="p-2 align-top">
                            {t.is_custom ? (
                              <Input value={p.unit || ""} onChange={(e) => updateParam(ti, pi, "unit", e.target.value)} placeholder="unit" className="h-9" />
                            ) : (
                              <div className="px-1 py-1.5 text-sm text-muted-foreground">{p.unit || "—"}</div>
                            )}
                          </td>
                          <td className="p-2 align-top">
                            {t.is_custom ? (
                              <Input value={p.reference_range || ""} onChange={(e) => updateParam(ti, pi, "reference_range", e.target.value)} placeholder="range" className="h-9" />
                            ) : (
                              <div className="px-1 py-1.5 text-sm text-muted-foreground">{p.reference_range || "—"}</div>
                            )}
                          </td>
                          <td className="p-2 align-top">
                            <span className={cn("inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold", style.className)}>
                              {style.label}
                            </span>
                          </td>
                          {t.is_custom && (
                            <td className="p-2 align-top text-center">
                              <button type="button" onClick={() => removeParamRow(ti, pi)} className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Clinical interpretation */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Clinical interpretation</h3>
            <div className="flex items-center gap-1 border border-border rounded-t-md bg-muted/40 px-2 py-1.5">
              <FormatBtn onClick={() => wrapSelection("**")} title="Bold"><Bold className="w-3.5 h-3.5" /></FormatBtn>
              <FormatBtn onClick={() => wrapSelection("*")} title="Italic"><Italic className="w-3.5 h-3.5" /></FormatBtn>
              <FormatBtn onClick={prefixLines} title="Bullet list"><List className="w-3.5 h-3.5" /></FormatBtn>
            </div>
            <Textarea
              ref={interpretationRef}
              value={interpretation}
              onChange={(e) => setInterpretation(e.target.value)}
              placeholder="Enter clinical findings, implications, and recommendations…"
              className="min-h-[130px] resize-none rounded-t-none border-t-0"
            />
            <p className="text-xs text-muted-foreground">
              Supports lightweight markdown: **bold**, *italic*, and - bullet lists.
            </p>
          </div>

          {/* Attachments */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Attachments</h3>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:bg-muted/30 transition">
              <label className="cursor-pointer space-y-2 block">
                <FileUp className="w-8 h-8 mx-auto text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Click to upload files</p>
                  <p className="text-xs text-muted-foreground">Reports, images, or other documents</p>
                </div>
                <input type="file" multiple onChange={handleFileSelect} className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
              </label>
            </div>
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="text-xs bg-muted/50 p-2 rounded flex items-center justify-between">
                    <span>{f.name}</span>
                    <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="text-destructive hover:text-destructive/80">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save and generate report
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InfoCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{label}</p>
      <p className={cn("text-sm font-medium mt-0.5", mono && "font-mono")}>{value}</p>
    </div>
  );
}

function FormatBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:bg-background hover:text-foreground transition"
    >
      {children}
    </button>
  );
}
