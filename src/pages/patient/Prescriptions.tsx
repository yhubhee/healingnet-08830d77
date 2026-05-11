import { PatientLayout } from "@/layouts/PatientLayout";
import { useState } from "react";
import { mockPatientPrescriptions } from "@/lib/mockData";
import { Pill, RefreshCw, User, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PatientPrescriptions() {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const list = mockPatientPrescriptions.filter((r) => r.status === tab);
  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Prescriptions</h1>
        <p className="text-muted-foreground text-sm">All medications prescribed to you</p>
      </div>

      <div className="flex gap-1 mb-5 bg-muted/30 p-1 rounded-lg w-fit">
        {(["active", "completed"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-1.5 rounded-md text-sm capitalize", tab === t ? "bg-card text-foreground shadow" : "text-muted-foreground")}>{t}</button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {list.map((r) => (
          <div key={r.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-success/10 text-success flex items-center justify-center"><Pill className="w-5 h-5" /></div>
              <div className="flex-1">
                <h3 className="font-heading font-bold">{r.drug}</h3>
                <p className="text-sm text-muted-foreground">{r.dosage} • {r.frequency}</p>
              </div>
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", r.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{r.status}</span>
            </div>
            <p className="text-sm mt-3 text-muted-foreground italic">"{r.instructions}"</p>
            <div className="grid grid-cols-3 gap-2 mt-4 text-xs">
              <div><div className="text-muted-foreground">Duration</div><div className="font-medium">{r.duration}</div></div>
              <div><div className="text-muted-foreground">Refills left</div><div className="font-medium">{r.refillsLeft}</div></div>
              <div><div className="text-muted-foreground">Issued</div><div className="font-medium">{r.date}</div></div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3.5 h-3.5" />{r.prescribedBy}</div>
              {r.status === "active" && r.refillsLeft > 0 && (
                <button className="text-sm text-primary inline-flex items-center gap-1"><RefreshCw className="w-3.5 h-3.5" />Request refill</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </PatientLayout>
  );
}
