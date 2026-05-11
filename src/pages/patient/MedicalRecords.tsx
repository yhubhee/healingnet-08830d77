import { PatientLayout } from "@/layouts/PatientLayout";
import { mockMedicalRecords } from "@/lib/mockData";
import { Stethoscope, FileText, Activity, Pill, Syringe } from "lucide-react";

const iconFor: Record<string, any> = {
  consultation: Stethoscope,
  diagnosis: FileText,
  vitals: Activity,
  prescription: Pill,
  immunization: Syringe,
};
const colorFor: Record<string, string> = {
  consultation: "bg-info/10 text-info",
  diagnosis: "bg-warning/10 text-warning",
  vitals: "bg-success/10 text-success",
  prescription: "bg-primary/10 text-primary",
  immunization: "bg-destructive/10 text-destructive",
};

export default function PatientMedicalRecords() {
  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Medical Records</h1>
        <p className="text-muted-foreground text-sm">Your full clinical history, in one timeline</p>
      </div>

      <div className="relative pl-6 border-l-2 border-border space-y-5">
        {mockMedicalRecords.map((r) => {
          const Icon = iconFor[r.type] || FileText;
          return (
            <div key={r.id} className="relative">
              <div className={`absolute -left-[34px] w-10 h-10 rounded-xl flex items-center justify-center ${colorFor[r.type] || "bg-muted"}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-heading font-bold">{r.title}</h3>
                    <p className="text-xs text-muted-foreground capitalize">{r.type} • {r.date} • {r.doctor}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-3">{r.summary}</p>
              </div>
            </div>
          );
        })}
      </div>
    </PatientLayout>
  );
}
