import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, FileUp, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function EnterLabResultDialog({ order, open, onClose }: { order: any; open: boolean; onClose: () => void }) {
  const [tests, setTests] = useState<any[]>(order?.lab_result_tests || []);
  const [interpretation, setInterpretation] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  function updateTest(i: number, field: string, value: any) {
    const n = [...tests];
    n[i][field] = value;
    setTests(n);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      for (const t of tests) {
        await supabase.from("lab_result_tests").update({
          result_value: t.result_value,
          unit: t.unit,
          reference_range: t.reference_range,
          is_abnormal: t.is_abnormal,
        }).eq("id", t.id);
      }

      const updateData: any = { status: "completed" };
      if (interpretation) {
        updateData.notes = interpretation;
      }
      await supabase.from("lab_results").update(updateData).eq("id", order.id);

      toast({ title: "Results saved successfully" });
      qc.invalidateQueries({ queryKey: ["lab-results"] });
      setTests(order?.lab_result_tests || []);
      setInterpretation("");
      setFiles([]);
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const abnormalTests = tests.filter((t) => t.is_abnormal);

  if (!order) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Lab Results — {order.patients?.first_name} {order.patients?.last_name}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-6">
          {abnormalTests.length > 0 && (
            <Alert className="border-warning bg-warning/10">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription>{abnormalTests.length} abnormal result(s) detected</AlertDescription>
            </Alert>
          )}

          {/* Test Results Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Test Results</h3>
            <div className="space-y-2 bg-muted/30 rounded-lg p-4">
              {tests.map((t, i) => (
                <div key={t.id} className="bg-background border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="font-semibold">{t.test_name}</p>
                      {t.category_name && <p className="text-xs text-muted-foreground">{t.category_name}</p>}
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={t.is_abnormal || false}
                        onChange={(e) => updateTest(i, "is_abnormal", e.target.checked)}
                        className="w-4 h-4"
                      />
                      <span className="text-xs font-medium">Abnormal</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs mb-1.5">Result Value *</Label>
                      <Input
                        required
                        value={t.result_value || ""}
                        onChange={(e) => updateTest(i, "result_value", e.target.value)}
                        placeholder="e.g., 7.2"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5">Unit</Label>
                      <Input
                        value={t.unit || ""}
                        onChange={(e) => updateTest(i, "unit", e.target.value)}
                        placeholder="e.g., mmol/L"
                      />
                    </div>
                    <div>
                      <Label className="text-xs mb-1.5">Reference Range</Label>
                      <Input
                        value={t.reference_range || ""}
                        onChange={(e) => updateTest(i, "reference_range", e.target.value)}
                        placeholder="e.g., 4.0-6.0"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Clinical Interpretation */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Clinical Interpretation</h3>
            <Textarea
              value={interpretation}
              onChange={(e) => setInterpretation(e.target.value)}
              placeholder="Enter clinical findings, implications, and recommendations..."
              className="min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Provide detailed interpretation of results and any clinical significance
            </p>
          </div>

          {/* File Attachments */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Attachments</h3>
            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:bg-muted/30 transition">
              <label className="cursor-pointer space-y-2">
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
          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Save Results
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
