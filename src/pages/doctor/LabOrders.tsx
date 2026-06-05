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
      const { data } = await supabase.from("lab_results").select("*, patients(first_name,last_name)").eq("ordered_by", ctx!.doctor.id).order("created_at", { ascending: false });
      return data || [];
    },
  });
  const list = (data || []).filter((o: any) => tab === "pending" ? o.status !== "completed" : o.status === "completed");

  async function openDetail(o: any) {
    setDetail(o);
    const { data } = await supabase.from("lab_result_tests").select("*").eq("lab_result_id", o.id);
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
        <DialogContent>
          <DialogHeader><DialogTitle>Lab order #{detail?.id?.slice(0, 8)}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">{detail?.notes || "No clinical notes."}</div>
            {tests.length === 0 ? <div className="text-sm text-muted-foreground">No test items.</div> :
              <div className="space-y-2">{tests.map((t) => (
                <div key={t.id} className="border border-border rounded-lg p-3 text-sm flex justify-between items-center">
                  <div><div className="font-medium">{t.test_name}</div><div className="text-xs text-muted-foreground">{t.category_name}</div></div>
                  <div className="text-right">{t.result_value ? <span className={cn("font-medium", t.is_abnormal && "text-destructive")}>{t.result_value} {t.unit}</span> : <span className="text-xs text-muted-foreground">Pending</span>}</div>
                </div>))}</div>}
          </div>
        </DialogContent>
      </Dialog>
    </DoctorLayout>
  );
}
