import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useHospitalInfo } from "@/hooks/useHospitalData";
import { AlertCircle, Bold, FileUp, FlaskConical, Italic, List, Loader2, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { LAB_PANELS, computeFlag, type FlagLevel } from "@/lib/lab/panels";

type Row = {
  id?: string;
  test_name: string;
  result_value?: string;
  unit?: string;
  reference_range?: string;
  range_low?: number;
  range_high?: number;
  category_name?: string;
  is_abnormal?: boolean;
  _new?: boolean;
};

const FLAG_STYLES: Record<FlagLevel, { label: string; className: string }> = {
  normal: { label: "Normal", className: "bg-success/15 text-success border border-success/30" },
  low: { label: "Low", className: "bg-warning/15 text-warning border border-warning/30" },
  high: { label: "High", className: "bg-warning/15 text-warning border border-warning/30" },
  unknown: { label: "—", className: "bg-muted text-muted-foreground border border-border" },
};

export function EnterLabResultDialog({ order, open, onClose }: { order: any; open: boolean; onClose: () => void }) {
  const { data: hospital } = useHospitalInfo();
  const [panelKey, setPanelKey] = useState<string>("ordered");
  const [rows, setRows] = useState<Row[]>(order?.lab_result_tests || []);
  const [interpretation, setInterpretation] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const interpretationRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  // reset when a new order opens
  useMemo(() => {
    setRows(order?.lab_result_tests || []);
    setPanelKey("ordered");
    setInterpretation("");
    setFiles([]);
  }, [order?.id]);

  function updateRow(i: number, field: keyof Row, value: any) {
    setRows((prev) => {
      const n = [...prev];
      (n[i] as any)[field] = value;
      if (field === "result_value") {
        const flag = computeFlag(value, n[i].range_low, n[i].range_high);
        n[i].is_abnormal = flag === "low" || flag === "high";
      }
      return n;
    });
  }

  function addRow() {
    setRows((prev) => [...prev, { test_name: "", result_value: "", unit: "", reference_range: "", _new: true }]);
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, j) => j !== i));
  }

  function selectPanel(key: string) {
    setPanelKey(key);
    if (key === "ordered") {
      setRows(order?.lab_result_tests || []);
      return;
    }
    const panel = LAB_PANELS.find((p) => p.key === key);
    if (!panel) return;
    const hasEntries = rows.some((r) => r.result_value);
    if (hasEntries && !window.confirm("Replace current results with this panel's parameters?")) {
      setPanelKey(panelKey);
      return;
    }
    setRows(
      panel.parameters.map((p) => ({
        test_name: p.test_name,
        unit: p.unit,
        reference_range: p.reference_range,
        range_low: p.range_low,
        range_high: p.range_high,
        category_name: p.category_name,
        result_value: "",
        _new: true,
      })),
    );
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setFiles(Array.from(e.target.files));
  }

  function wrapSelection(before: string, after = before) {
    const ta = interpretationRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const value = interpretation;
    const selected = value.slice(start, end) || "text";
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    setInterpretation(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + selected.length;
    });
  }

  function prefixLines() {
    const ta = interpretationRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const value = interpretation;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const target = value.slice(lineStart, end || start);
    const bulleted = target
      .split("\n")
      .map((l) => (l.startsWith("- ") ? l : `- ${l}`))
      .join("\n");
    setInterpretation(value.slice(0, lineStart) + bulleted + value.slice(end || start));
  }

  const patientName = `${order?.patients?.first_name || ""} ${order?.patients?.last_name || ""}`.trim() || "—";
  const doctorName = order?.doctors ? `Dr. ${order.doctors.first_name} ${order.doctors.last_name}` : "—";
  const labId = order ? `LAB-${order.id.slice(0, 4).toUpperCase()}` : "";
  const today = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

  const abnormalCount = rows.filter((r) => {
    const flag = computeFlag(r.result_value, r.range_low, r.range_high);
    return flag === "low" || flag === "high";
  }).length;

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
    lines.push(`RESULTS`);
    lines.push(`------------------------------------------------------------`);
    lines.push(`Parameter                Result       Unit      Range        Flag`);
    lines.push(`------------------------------------------------------------`);
    rows.forEach((r) => {
      const flag = computeFlag(r.result_value, r.range_low, r.range_high);
      const flagLabel = FLAG_STYLES[flag].label;
      lines.push(
        `${(r.test_name || "").padEnd(24)} ${(r.result_value || "").toString().padEnd(12)} ${(r.unit || "").padEnd(9)} ${(r.reference_range || "").padEnd(12)} ${flagLabel}`,
      );
    });
    lines.push(`------------------------------------------------------------`);
    if (interpretation.trim()) {
      lines.push("");
      lines.push(`CLINICAL INTERPRETATION`);
      lines.push(interpretation.trim());
    }
    lines.push("");
    lines.push(`This is an official laboratory report issued by ${hospital?.name || "HealingNet Hospital"}.`);
    return lines.join("\n");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!order) return;
    if (rows.length === 0) {
      toast({ title: "Add at least one parameter", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Update existing rows, insert new ones
      const existing = rows.filter((r) => r.id);
      const fresh = rows.filter((r) => !r.id);

      for (const r of existing) {
        await supabase
          .from("lab_result_tests")
          .update({
            test_name: r.test_name,
            result_value: r.result_value,
            unit: r.unit,
            reference_range: r.reference_range,
            is_abnormal: r.is_abnormal || false,
          })
          .eq("id", r.id!);
      }

      if (fresh.length) {
        await supabase.from("lab_result_tests").insert(
          fresh.map((r) => ({
            lab_result_id: order.id,
            test_name: r.test_name || "Untitled parameter",
            result_value: r.result_value || "",
            unit: r.unit || null,
            reference_range: r.reference_range || null,
            category_name: r.category_name || null,
            is_abnormal: r.is_abnormal || false,
          })),
        );
      }

      await supabase
        .from("lab_results")
        .update({ status: "completed", notes: interpretation || null })
        .eq("id", order.id);

      // Compile letter/report entry
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
        {/* Letterhead header */}
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

          {/* Panel selector */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Test panel</Label>
            <Select value={panelKey} onValueChange={selectPanel}>
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="Choose a test panel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ordered">Ordered tests (as requested)</SelectItem>
                {LAB_PANELS.map((p) => (
                  <SelectItem key={p.key} value={p.key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Selecting a panel loads its standard parameters and reference ranges.
            </p>
          </div>

          {/* Results table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Results</h3>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
                <Plus className="w-4 h-4" /> Add parameter
              </Button>
            </div>
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="p-3 font-semibold">Parameter</th>
                      <th className="p-3 font-semibold w-32">Result</th>
                      <th className="p-3 font-semibold w-28">Unit</th>
                      <th className="p-3 font-semibold w-32">Reference range</th>
                      <th className="p-3 font-semibold w-24">Flag</th>
                      <th className="p-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                          No parameters yet. Pick a test panel or click "Add parameter".
                        </td>
                      </tr>
                    )}
                    {rows.map((r, i) => {
                      const flag = computeFlag(r.result_value, r.range_low, r.range_high);
                      const style = FLAG_STYLES[flag];
                      return (
                        <tr key={i} className="border-t border-border/60">
                          <td className="p-2 align-top">
                            <Input
                              value={r.test_name || ""}
                              onChange={(e) => updateRow(i, "test_name", e.target.value)}
                              placeholder="Parameter"
                              className="h-9"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              value={r.result_value || ""}
                              onChange={(e) => updateRow(i, "result_value", e.target.value)}
                              placeholder="—"
                              className="h-9"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              value={r.unit || ""}
                              onChange={(e) => updateRow(i, "unit", e.target.value)}
                              placeholder="unit"
                              className="h-9"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <Input
                              value={r.reference_range || ""}
                              onChange={(e) => updateRow(i, "reference_range", e.target.value)}
                              placeholder="range"
                              className="h-9"
                            />
                          </td>
                          <td className="p-2 align-top">
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold",
                                style.className,
                              )}
                            >
                              {style.label}
                            </span>
                          </td>
                          <td className="p-2 align-top text-center">
                            <button
                              type="button"
                              onClick={() => removeRow(i)}
                              className="text-muted-foreground hover:text-destructive transition"
                              aria-label="Remove row"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Clinical interpretation */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Clinical interpretation</h3>
            <div className="flex items-center gap-1 border border-border rounded-t-md bg-muted/40 px-2 py-1.5">
              <FormatBtn onClick={() => wrapSelection("**")} title="Bold">
                <Bold className="w-3.5 h-3.5" />
              </FormatBtn>
              <FormatBtn onClick={() => wrapSelection("*")} title="Italic">
                <Italic className="w-3.5 h-3.5" />
              </FormatBtn>
              <FormatBtn onClick={prefixLines} title="Bullet list">
                <List className="w-3.5 h-3.5" />
              </FormatBtn>
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
                <input
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
              </label>
            </div>
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((f, i) => (
                  <div key={i} className="text-xs bg-muted/50 p-2 rounded flex items-center justify-between">
                    <span>{f.name}</span>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, j) => j !== i))}
                      className="text-destructive hover:text-destructive/80"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
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
