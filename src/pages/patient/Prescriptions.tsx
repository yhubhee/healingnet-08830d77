import { PatientLayout } from "@/layouts/PatientLayout";
import { usePatientPrescriptions } from "@/hooks/usePatientData";
import { cn } from "@/lib/utils";

export default function PatientPrescriptions() {
  const { data: rx = [], isLoading } = usePatientPrescriptions();
  return (
    <PatientLayout>
      <div className="mb-6"><h1 className="text-2xl font-heading font-bold">Prescriptions</h1><p className="text-muted-foreground">Your medications</p></div>
      {isLoading ? <p className="text-muted-foreground p-8 text-center">Loading…</p> :
        rx.length === 0 ? <p className="text-muted-foreground p-8 text-center">No prescriptions yet</p> :
        <div className="space-y-3">{rx.map((r: any) => (
          <div key={r.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex justify-between mb-2">
              <div>
                <h4 className="font-heading font-bold">{r.drug_name}</h4>
                <p className="text-sm text-muted-foreground">{r.dosage} • {r.frequency} • {r.duration}</p>
              </div>
              <span className={cn("text-xs px-3 py-1 rounded-full", r.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{r.status}</span>
            </div>
            {r.instructions && <p className="text-sm text-muted-foreground mt-2">{r.instructions}</p>}
            <p className="text-xs text-muted-foreground mt-3">From {r.hospitals?.name} • {new Date(r.created_at).toLocaleDateString()}</p>
          </div>
        ))}</div>}
    </PatientLayout>
  );
}
