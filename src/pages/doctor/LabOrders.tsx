import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useState } from "react";
import { FlaskConical, Loader2, Plus, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OrderLabTestDialog } from "@/components/doctor/OrderLabTestDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useDoctor } from "@/hooks/useDoctor";
import { useCancelLabOrder, useDoctorLabOrders } from "@/api/hooks/useLab";
import type { LabOrder } from "@/api/types";

export default function DoctorLabOrders() {
  const [tab, setTab] = useState<"pending" | "completed">("pending");
  const [detail, setDetail] = useState<LabOrder | null>(null);
  const { data: ctx } = useDoctor();
  const { data: orders = [], isLoading } = useDoctorLabOrders(ctx?.doctor?.id);
  const cancelOrder = useCancelLabOrder();

  const list = orders.filter((o) => (tab === "pending" ? o.status !== "completed" : o.status === "completed"));

  function cancel(id: string) {
    cancelOrder.mutate(id, {
      onSuccess: () => toast.success("Cancelled"),
      onError: (e) => toast.error(e.message),
    });
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
          {list.map((o) => (
            <div key={o.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 flex-wrap hover:border-primary/40">
              <button onClick={() => setDetail(o)} className="flex items-center gap-4 flex-1 min-w-[200px] text-left">
                <div className="w-11 h-11 rounded-xl bg-warning/10 text-warning flex items-center justify-center"><FlaskConical className="w-5 h-5" /></div>
                <div>
                  <div className="font-heading font-bold">Lab order #{o.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">{o.patientName || "Patient"} • Ordered {new Date(o.createdAt).toLocaleDateString()}</div>
                </div>
              </button>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", o.status === "completed" ? "bg-success/15 text-success" : o.status === "cancelled" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning")}>{o.status}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setDetail(o)}>View details</DropdownMenuItem>
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
            {!detail?.tests.length ? <div className="text-sm text-muted-foreground">No test items.</div> :
              <div className="space-y-3">{detail.tests.map((t) => (
                <div key={t.id} className="border border-border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-muted/40 flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{t.name}</div>
                      {t.categoryName && <div className="text-xs text-muted-foreground">{t.categoryName}</div>}
                    </div>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", t.status === "completed" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{t.status}</span>
                  </div>
                  {t.parameters.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead><tr className="text-left text-muted-foreground bg-muted/20"><th className="p-2">Parameter</th><th className="p-2">Result</th><th className="p-2">Unit</th><th className="p-2">Range</th><th className="p-2">Flag</th></tr></thead>
                      <tbody>{t.parameters.map((p) => (
                        <tr key={p.id} className="border-t border-border/50">
                          <td className="p-2">{p.name}</td>
                          <td className={cn("p-2 font-medium", p.isAbnormal && "text-destructive")}>{p.resultValue || "—"}</td>
                          <td className="p-2 text-muted-foreground">{p.unit || "—"}</td>
                          <td className="p-2 text-muted-foreground">{p.referenceRange || "—"}</td>
                          <td className="p-2 capitalize">{p.flag}</td>
                        </tr>))}</tbody>
                    </table>
                  ) : (
                    <div className="p-3 text-xs text-muted-foreground">Awaiting results.</div>
                  )}
                </div>
              ))}</div>}
          </div>
        </DialogContent>
      </Dialog>
    </DoctorLayout>
  );
}
