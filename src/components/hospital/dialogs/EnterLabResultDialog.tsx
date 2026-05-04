import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function EnterLabResultDialog({ order, open, onClose }: { order: any; open: boolean; onClose: () => void }) {
  const [tests, setTests] = useState<any[]>(order?.lab_result_tests || []);
  const { toast } = useToast(); const qc = useQueryClient();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    for (const t of tests) {
      await supabase.from("lab_result_tests").update({ result_value: t.result_value, unit: t.unit, reference_range: t.reference_range, is_abnormal: t.is_abnormal }).eq("id", t.id);
    }
    await supabase.from("lab_results").update({ status: "completed" }).eq("id", order.id);
    toast({ title: "Results saved" });
    qc.invalidateQueries({ queryKey: ["lab-results"] });
    onClose();
  }

  if (!order) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Enter Lab Results — {order.patients?.first_name} {order.patients?.last_name}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 max-h-[60vh] overflow-y-auto">
          {tests.map((t, i) => (
            <div key={t.id} className="border border-border rounded-lg p-3 space-y-2">
              <p className="font-semibold text-sm">{t.test_name}</p>
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Result</Label><Input value={t.result_value || ""} onChange={(e) => { const n = [...tests]; n[i].result_value = e.target.value; setTests(n); }} /></div>
                <div><Label className="text-xs">Unit</Label><Input value={t.unit || ""} onChange={(e) => { const n = [...tests]; n[i].unit = e.target.value; setTests(n); }} /></div>
                <div><Label className="text-xs">Range</Label><Input value={t.reference_range || ""} onChange={(e) => { const n = [...tests]; n[i].reference_range = e.target.value; setTests(n); }} /></div>
              </div>
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={t.is_abnormal || false} onChange={(e) => { const n = [...tests]; n[i].is_abnormal = e.target.checked; setTests(n); }} />Abnormal</label>
            </div>
          ))}
          <Button type="submit" className="w-full">Save Results</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
