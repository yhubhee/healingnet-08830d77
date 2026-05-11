import { DoctorLayout } from "@/layouts/DoctorLayout";
import { mockDoctorPrescriptions } from "@/lib/mockData";
import { Plus, Pill } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DoctorPrescriptions() {
  return (
    <DoctorLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Prescriptions</h1>
          <p className="text-muted-foreground text-sm">All prescriptions you've issued</p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg inline-flex items-center gap-2 font-medium"><Plus className="w-4 h-4" />New prescription</button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className="text-left p-3">Drug</th><th className="text-left p-3">Patient</th><th className="text-left p-3">Frequency</th><th className="text-left p-3">Duration</th><th className="text-left p-3">Date</th><th className="text-left p-3">Status</th></tr></thead>
          <tbody>
            {mockDoctorPrescriptions.map((r) => (
              <tr key={r.id} className="border-t border-border hover:bg-muted/20">
                <td className="p-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-success/10 text-success flex items-center justify-center"><Pill className="w-4 h-4" /></div><span className="font-medium text-sm">{r.drug}</span></div></td>
                <td className="p-3 text-sm">{r.patient}</td>
                <td className="p-3 text-sm text-muted-foreground">{r.frequency}</td>
                <td className="p-3 text-sm text-muted-foreground">{r.duration}</td>
                <td className="p-3 text-sm text-muted-foreground">{r.date}</td>
                <td className="p-3"><span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", r.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DoctorLayout>
  );
}
