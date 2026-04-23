import { PatientLayout } from "@/layouts/PatientLayout";
import { usePatientEmr } from "@/hooks/usePatientData";

export default function PatientMedicalRecords() {
  const { data: entries = [], isLoading } = usePatientEmr();
  return (
    <PatientLayout>
      <div className="mb-6"><h1 className="text-2xl font-heading font-bold">Medical Records</h1><p className="text-muted-foreground">Your health history</p></div>
      {isLoading ? <p className="text-muted-foreground p-8 text-center">Loading…</p> :
        entries.length === 0 ? <p className="text-muted-foreground p-8 text-center">No records yet</p> :
        <div className="space-y-3">{entries.map((e: any) => (
          <div key={e.id} className="bg-card border border-border rounded-xl p-5">
            <div className="flex justify-between mb-2">
              <h4 className="font-heading font-bold">{e.title}</h4>
              <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary uppercase">{e.entry_type}</span>
            </div>
            {e.content && <p className="text-sm text-muted-foreground">{e.content}</p>}
            <p className="text-xs text-muted-foreground mt-3">
              {e.doctors ? `Dr. ${e.doctors.first_name} ${e.doctors.last_name} • ` : ""}{e.hospitals?.name} • {new Date(e.created_at).toLocaleDateString()}
            </p>
          </div>
        ))}</div>}
    </PatientLayout>
  );
}
