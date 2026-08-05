import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useHospitalInfo } from "@/hooks/useHospitalData";
import { AlertCircle, Bold, FileUp, FlaskConical, Italic, List, Loader2, Printer, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { computeFlag, type FlagLevel } from "@/lib/lab/panels";
import { findCatalogTest, resolveRange, type CatalogTest, type ParamKind } from "@/lib/lab/catalog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useIssueLabReport, useSaveTestResults } from "@/api/hooks/useLab";
import { updateOrderNotes } from "@/api/lab";
import type { LabOrder, SaveParameterInput } from "@/api/types";


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

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
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
      const savedParams: any[] = Array.isArray(row.lab_result_parameters) ? row.lab_result_parameters : [];
      let parameters: ParamResult[] = [];

      if (savedParams.length > 0) {
        // Prefer the new normalized table
        const bySortAsc = [...savedParams].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        parameters = bySortAsc.map((p) => {
          // Bring in kind/options/dependsOn metadata from catalog when available
          const catP = catalog?.parameters.find((cp) => cp.name === p.parameter_name);
          const r = catP ? resolveRange(catP, patientSex) : undefined;
          return {
            name: p.parameter_name,
            result_value: p.result_value || "",
            unit: p.unit_snapshot || catP?.unit || "",
            reference_range: p.ref_range_snapshot || r?.range || "",
            range_low: r?.low,
            range_high: r?.high,
            flag: p.flag as FlagLevel,
            kind: catP?.kind,
            options: catP?.options,
            expectedNormal: catP?.expectedNormal,
            dependsOn: catP?.dependsOn,
            dependsOnValue: catP?.dependsOnValue,
            forcedValue: catP?.forcedValue,
          };
        });
      } else if (Array.isArray(row.parameters) && row.parameters.length > 0) {
        parameters = row.parameters as ParamResult[];
      } else if (catalog) {
        parameters = paramsFromCatalog(catalog, patientSex);
      } else {
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
        const flag = flagForParam(p, patientSex);
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

  async function saveResultsCore(): Promise<boolean> {
    if (!order) return false;
    if (tests.length === 0) {
      toast({ title: "No tests on this order", variant: "destructive" });
      return false;
    }

    // Persist per-parameter rows for every test in the order
    for (const t of tests) {
      const params: SaveParameterInput[] = (t.parameters || []).map((p) => ({
        name: p.name || t.test_name,
        resultValue: p.result_value?.toString() || null,
        unit: p.unit || null,
        referenceRange: p.reference_range || null,
        flag: (flagForParam(p, patientSex) || "unknown") as FlagLevel,
      }));

      await saveResults.mutateAsync({ orderTestId: t.id, parameters: params });
    }

    await updateOrderNotes(order.id, interpretation || null);

    // The DB trigger will flip lab_results.status to 'completed' automatically.
    return true;
  }


  async function handleSaveOnly() {
    if (saving) return;
    setSaving(true);
    try {
      const ok = await saveResultsCore();
      if (ok) {
        toast({ title: "Results saved" });
        onClose();
      }
    } catch (err: any) {
      toast({ title: "Could not save results", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAndReport() {
    if (saving) return;
    setSaving(true);
    try {
      const ok = await saveResultsCore();
      if (!ok) return;

      // Report generation is best-effort — never block a successful save.
      try {
        const body = buildReportBody();
        const { error: letterErr } = await supabase.from("patient_letters" as any).insert({
          patient_id: order.patient_id,
          hospital_id: order.hospital_id || hospital?.id || null,
          doctor_id: order.ordered_by || null,
          letter_type: "lab_report",
          title: `Laboratory Report — ${labId}`,
          body,
          status: "issued",
          issued_at: new Date().toISOString().slice(0, 10),
        });
        if (letterErr) throw letterErr;
        qc.invalidateQueries({ queryKey: ["patient-letters"] });
        toast({ title: "Report saved and issued to patient" });
      } catch (reportErr: any) {
        toast({
          title: "Results saved",
          description: `Report generation failed: ${reportErr.message}. You can re-issue the report later.`,
        });
      }

      onClose();
    } catch (err: any) {
      toast({ title: "Could not save results", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) {
      toast({ title: "Popup blocked", description: "Allow popups to print the report.", variant: "destructive" });
      return;
    }
    const rows = tests.map((t) => {
      const paramRows = (t.parameters || []).map((p) => {
        const f = flagForParam(p, patientSex);
        const style = f === "low" || f === "high" || f === "abnormal"
          ? "color:#b91c1c;font-weight:600;"
          : f === "normal" ? "color:#166534;" : "color:#6b7280;";
        return `<tr>
          <td>${escapeHtml(p.name || "")}</td>
          <td style="${style}">${escapeHtml(p.result_value || "—")}</td>
          <td>${escapeHtml(p.unit || "")}</td>
          <td>${escapeHtml(p.reference_range || "")}</td>
          <td style="${style}">${FLAG_STYLES[f].label}</td>
        </tr>`;
      }).join("");
      return `<section style="margin-top:20px;">
        <h3 style="margin:0 0 4px 0;font-size:14px;">${escapeHtml(t.test_name)}${t.category_name ? ` — <span style="font-weight:400;color:#6b7280">${escapeHtml(t.category_name)}</span>` : ""}</h3>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f3f4f6;text-align:left;">
            <th style="padding:6px 8px;border:1px solid #e5e7eb;">Parameter</th>
            <th style="padding:6px 8px;border:1px solid #e5e7eb;">Result</th>
            <th style="padding:6px 8px;border:1px solid #e5e7eb;">Unit</th>
            <th style="padding:6px 8px;border:1px solid #e5e7eb;">Reference range</th>
            <th style="padding:6px 8px;border:1px solid #e5e7eb;">Flag</th>
          </tr></thead>
          <tbody>${paramRows.replace(/<td>/g, '<td style="padding:6px 8px;border:1px solid #e5e7eb;">').replace(/<td style="([^"]*)">/g, '<td style="padding:6px 8px;border:1px solid #e5e7eb;$1">')}</tbody>
        </table>
      </section>`;
    }).join("");

    win.document.write(`<!doctype html><html><head><title>${escapeHtml(labId)} — Laboratory Report</title>
      <style>
        body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color:#111827; padding:32px; }
        .letterhead { border-bottom:2px solid #0f766e; padding-bottom:12px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:flex-end; }
        .letterhead h1 { margin:0; font-size:20px; }
        .letterhead p { margin:2px 0 0 0; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:2px; }
        .info { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; font-size:12px; margin-bottom:12px; }
        .info label { color:#6b7280; text-transform:uppercase; letter-spacing:1px; font-size:10px; display:block; }
        .interp { margin-top:24px; padding:12px; border:1px solid #e5e7eb; background:#f9fafb; font-size:12px; white-space:pre-wrap; }
        .foot { margin-top:32px; font-size:11px; color:#6b7280; text-align:center; border-top:1px solid #e5e7eb; padding-top:12px; }
      </style></head><body>
      <div class="letterhead">
        <div><h1>${escapeHtml(hospital?.name || "HealingNet Hospital")}</h1><p>Laboratory Report</p></div>
        <div style="text-align:right;font-size:11px;color:#6b7280;">${escapeHtml(labId)}<br/>${escapeHtml(today)}</div>
      </div>
      <div class="info">
        <div><label>Patient</label>${escapeHtml(patientName)}</div>
        <div><label>Ordering Doctor</label>${escapeHtml(doctorName)}</div>
        <div><label>Lab ID</label>${escapeHtml(labId)}</div>
        <div><label>Report Date</label>${escapeHtml(today)}</div>
      </div>
      ${rows}
      ${interpretation.trim() ? `<div class="interp"><strong>Clinical interpretation</strong><br/>${escapeHtml(interpretation.trim())}</div>` : ""}
      <div class="foot">Official laboratory report issued by ${escapeHtml(hospital?.name || "HealingNet Hospital")}.</div>
      <script>window.onload = () => { window.print(); };</script>
      </body></html>`);
    win.document.close();
  }

  if (!order) return null;
  const isCompleted = order.status === "completed";

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

        <div className="p-6 space-y-6">
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
                      const flag = flagForParam(p, patientSex);
                      const style = FLAG_STYLES[flag];
                      // Determine dependsOn gating (find sibling param by name)
                      const gate = p.dependsOn
                        ? (t.parameters || []).find((x) => x.name === p.dependsOn)
                        : undefined;
                      const gateSatisfied = !p.dependsOn || (gate?.result_value === p.dependsOnValue);
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
                            {p.kind === "qualitative" && p.options ? (
                              <Select
                                value={p.result_value || ""}
                                onValueChange={(v) => updateParam(ti, pi, "result_value", v)}
                              >
                                <SelectTrigger className="h-9"><SelectValue placeholder="Select…" /></SelectTrigger>
                                <SelectContent>
                                  {p.options.map((opt) => (
                                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input
                                value={p.result_value || ""}
                                onChange={(e) => updateParam(ti, pi, "result_value", e.target.value)}
                                placeholder={gateSatisfied ? "—" : "N/A"}
                                className="h-9"
                                disabled={!gateSatisfied}
                                type={p.kind === "numeric" ? "number" : "text"}
                              />
                            )}
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

          <div className="flex gap-2 justify-end pt-4 border-t border-border flex-wrap">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            {isCompleted && (
              <Button type="button" variant="outline" onClick={handlePrint} disabled={saving}>
                <Printer className="w-4 h-4 mr-2" />Print / Export PDF
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={handleSaveOnly} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save results
            </Button>
            <Button type="button" onClick={handleSaveAndReport} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save and generate report
            </Button>
          </div>
        </div>
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
