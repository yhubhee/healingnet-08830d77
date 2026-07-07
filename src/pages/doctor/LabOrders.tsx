import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FlaskConical, Loader2, Plus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OrderLabTestDialog } from "@/components/doctor/OrderLabTestDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useDoctor } from "@/hooks/useDoctor";

export default function DoctorLabOrders() {
  const [tab, setTab] = useState<"pending" | "completed">("pending");
  const [detail, setDetail] = useState<any>(null);
  const [tests, setTests] = useState<any[]>([]);
  const qc = useQueryClient();
  const { data: ctx } = useDoctor();
  const { data, isLoading } = useQuery({
    enabled: !!ctx?.doctor?.id,
    queryKey: ["doctor", "labs", ctx?.doctor?.id],
    queryFn: async () => {
      const { data } = await supabase.from("lab_results").select("*, patients(first_name,last_name), lab_result_tests(*, lab_result_parameters(*))").eq("ordered_by", ctx!.doctor.id).order("created_at", { ascending: false });
      return data || [];
    },
  });
  const list = (data || []).filter((o: any) => tab === "pending" ? o.status !== "completed" : o.status === "completed");

  async function openDetail(o: any) {
    setDetail(o);
    const { data } = await supabase.from("lab_result_tests").select("*, lab_result_parameters(*)").eq("lab_result_id", o.id);
    setTests(data || []);
  }
  async function cancel(id: string) {
    const { error } = await supabase.from("lab_results").update({ status: "cancelled" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cancelled");
    qc.invalidateQueries({ queryKey: ["doctor", "labs"] });
  }

  return (
    <DoctorLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div><h1 className="text-2xl font-heading font-bold">Lab Orders</h1><p className="text-muted-foreground text-sm">Tests you've ordered for patients</p></div>
        <OrderLabTestDialog trigger={<Button><Plus className="w-4 h-4" />Order test</Button>} />
      </div>

      <div className="flex gap-1 mb-5 bg-muted/30 p-1 rounded-lg w-fit">
        {(["pending", "completed"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-1.5 rounded-md text-sm capitalize", tab === t ? "bg-card shadow" : "text-muted-foreground")}>{t}</button>)}
      </div>

      {isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        list.length === 0 ? <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm"><FlaskConical className="w-10 h-10 mx-auto mb-2" />No {tab} lab orders.</div> :
        <div className="space-y-3">
          {list.map((o: any) => (
            <div key={o.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 flex-wrap hover:border-primary/40">
              <button onClick={() => openDetail(o)} className="flex items-center gap-4 flex-1 min-w-[200px] text-left">
                <div className="w-11 h-11 rounded-xl bg-warning/10 text-warning flex items-center justify-center"><FlaskConical className="w-5 h-5" /></div>
                <div>
                  <div className="font-heading font-bold">Lab order #{o.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">{o.patients ? `${o.patients.first_name} ${o.patients.last_name}` : "Patient"} • Ordered {new Date(o.created_at).toLocaleDateString()}</div>
                </div>
              </button>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", o.status === "completed" ? "bg-success/15 text-success" : o.status === "cancelled" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning")}>{o.status}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openDetail(o)}>View details</DropdownMenuItem>
                  {o.status === "pending" && <DropdownMenuItem onClick={() => cancel(o.id)}>Cancel order</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Lab order #{detail?.id?.slice(0, 8)}
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", detail?.status === "completed" ? "bg-success/15 text-success" : detail?.status === "cancelled" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning")}>{detail?.status}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {detail?.notes && <div className="text-sm text-muted-foreground border-l-2 border-border pl-3">{detail.notes}</div>}
            {tests.length === 0 ? <div className="text-sm text-muted-foreground">No test items.</div> :
              <div className="space-y-3">{tests.map((t: any) => {
                const params: any[] = (t.lab_result_parameters || []).slice().sort((a: any, b: any) => (a.sort_order || 0) - (b.sort_order || 0));
                return (
                  <div key={t.id} className="border border-border rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-muted/40 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{t.test_name}</div>
                        {t.category_name && <div className="text-xs text-muted-foreground">{t.category_name}</div>}
                      </div>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", t.status === "completed" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{t.status || "pending"}</span>
                    </div>
                    {params.length > 0 ? (
                      <table className="w-full text-xs">
                        <thead><tr className="text-left text-muted-foreground bg-muted/20"><th className="p-2">Parameter</th><th className="p-2">Result</th><th className="p-2">Unit</th><th className="p-2">Range</th><th className="p-2">Flag</th></tr></thead>
                        <tbody>{params.map((p) => (
                          <tr key={p.id} className="border-t border-border/50">
                            <td className="p-2">{p.parameter_name}</td>
                            <td className={cn("p-2 font-medium", (p.flag === "low" || p.flag === "high" || p.flag === "abnormal") && "text-destructive")}>{p.result_value || "—"}</td>
                            <td className="p-2 text-muted-foreground">{p.unit_snapshot || "—"}</td>
                            <td className="p-2 text-muted-foreground">{p.ref_range_snapshot || "—"}</td>
                            <td className="p-2 capitalize">{p.flag}</td>
                          </tr>))}</tbody>
                      </table>
                    ) : (
                      <div className="p-3 text-xs text-muted-foreground">Awaiting results.</div>
                    )}
                  </div>
                );
              })}</div>}
          </div>
        </DialogContent>
      </Dialog>
    </DoctorLayout>
  );
}
