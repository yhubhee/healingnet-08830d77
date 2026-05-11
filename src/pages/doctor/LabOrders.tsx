import { DoctorLayout } from "@/layouts/DoctorLayout";
import { mockDoctorLabOrders } from "@/lib/mockData";
import { useState } from "react";
import { FlaskConical, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DoctorLabOrders() {
  const [tab, setTab] = useState<"pending" | "completed">("pending");
  const list = mockDoctorLabOrders.filter((o) => tab === "pending" ? o.status !== "completed" : o.status === "completed");
  return (
    <DoctorLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Lab Orders</h1>
          <p className="text-muted-foreground text-sm">Tests you've ordered for patients</p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg inline-flex items-center gap-2 font-medium"><Plus className="w-4 h-4" />Order test</button>
      </div>

      <div className="flex gap-1 mb-5 bg-muted/30 p-1 rounded-lg w-fit">
        {(["pending", "completed"] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-1.5 rounded-md text-sm capitalize", tab === t ? "bg-card shadow" : "text-muted-foreground")}>{t}</button>)}
      </div>

      <div className="space-y-3">
        {list.map((o) => (
          <div key={o.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4 flex-wrap">
            <div className="w-11 h-11 rounded-xl bg-warning/10 text-warning flex items-center justify-center"><FlaskConical className="w-5 h-5" /></div>
            <div className="flex-1 min-w-[200px]">
              <div className="font-heading font-bold">{o.test}</div>
              <div className="text-xs text-muted-foreground">{o.patient} • Ordered {o.ordered}</div>
              {o.result && <div className="text-sm mt-1 text-success">Result: {o.result}</div>}
            </div>
            <div className="flex gap-2">
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                o.priority === "urgent" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground")}>{o.priority}</span>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                o.status === "completed" ? "bg-success/15 text-success" :
                o.status === "in_progress" ? "bg-info/15 text-info" : "bg-warning/15 text-warning")}>{o.status.replace("_", " ")}</span>
            </div>
          </div>
        ))}
      </div>
    </DoctorLayout>
  );
}
