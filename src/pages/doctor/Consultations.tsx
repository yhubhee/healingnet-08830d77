import { DoctorLayout } from "@/layouts/DoctorLayout";
import { mockDoctorConsultRequests } from "@/lib/mockData";
import { Video, FileText, Building2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DoctorConsultations() {
  return (
    <DoctorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Consultation Requests</h1>
        <p className="text-muted-foreground text-sm">External consults from other hospitals via the Care Zone marketplace</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {mockDoctorConsultRequests.map((c) => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-start gap-3">
              <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center",
                c.type === "virtual" ? "bg-info/10 text-info" : "bg-warning/10 text-warning")}>
                {c.type === "virtual" ? <Video className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
              </div>
              <div className="flex-1">
                <h3 className="font-heading font-bold">{c.patient}</h3>
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" />{c.hospital}</p>
              </div>
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium",
                c.urgency === "urgent" ? "bg-destructive/15 text-destructive" :
                c.urgency === "moderate" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground")}>{c.urgency}</span>
            </div>
            <p className="text-sm mt-3 italic text-muted-foreground">"{c.reason}"</p>
            <div className="flex justify-between items-center mt-4 pt-3 border-t border-border">
              <div><div className="text-xs text-muted-foreground">Proposed fee</div><div className="font-bold text-primary">₦{c.fee.toLocaleString()}</div></div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 text-sm border border-border rounded-lg flex items-center gap-1"><X className="w-3.5 h-3.5" />Decline</button>
                <button className="px-3 py-1.5 text-sm bg-success text-success-foreground rounded-lg flex items-center gap-1"><Check className="w-3.5 h-3.5" />Accept</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </DoctorLayout>
  );
}
