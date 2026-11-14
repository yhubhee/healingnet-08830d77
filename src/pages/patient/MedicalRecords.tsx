import { PatientLayout } from "@/layouts/PatientLayout";
import { useQuery } from "@tanstack/react-query";
import { useActivePatientId } from "@/hooks/usePatientData";
import { supabase } from "@/integrations/supabase/client";
import { Stethoscope, FileText, Activity, Pill, Syringe } from "lucide-react";
import { QueryState } from "@/components/common/QueryState";

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
  // The person chosen under "Who is this for?".
  const pid = useActivePatientId();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["patient", "emr", pid],
    enabled: !!pid,
    queryFn: async () => {
      if (!pid) return [];
      const p = { id: pid };
      const { data, error } = await supabase.from("emr_entries").select("*, doctors(first_name,last_name), vital_data").eq("patient_id", p.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Medical Records</h1>
        <p className="text-muted-foreground text-sm">Your full clinical history, in one timeline</p>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        isEmpty={(data || []).length === 0}
        emptyMessage="No medical records yet."
      >
        <div className="relative pl-6 border-l-2 border-border space-y-5">
          {(data || []).map((r: any) => {
            const Icon = iconFor[r.entry_type] || FileText;
            return (
              <div key={r.id} className="relative">
                <div className={`absolute -left-[34px] w-10 h-10 rounded-xl flex items-center justify-center ${colorFor[r.entry_type] || "bg-muted"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="bg-card border border-border rounded-xl p-5">
                  <h3 className="font-heading font-bold">{r.title}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{r.entry_type} • {new Date(r.created_at).toLocaleDateString()} {r.doctors && `• Dr. ${r.doctors.first_name} ${r.doctors.last_name}`}</p>
                  {r.entry_type === "vitals" && r.vital_data ? (
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {r.vital_data.systolic && r.vital_data.diastolic && (
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">BP</p>
                          <p className="font-semibold">{r.vital_data.systolic}/{r.vital_data.diastolic}</p>
                        </div>
                      )}
                      {r.vital_data.heart_rate && (
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">HR</p>
                          <p className="font-semibold">{r.vital_data.heart_rate} bpm</p>
                        </div>
                      )}
                      {r.vital_data.temperature && (
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">Temp</p>
                          <p className="font-semibold">{r.vital_data.temperature}°C</p>
                        </div>
                      )}
                      {r.vital_data.oxygen_saturation && (
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">O₂ Sat</p>
                          <p className="font-semibold">{r.vital_data.oxygen_saturation}%</p>
                        </div>
                      )}
                      {r.vital_data.respiratory_rate && (
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">RR</p>
                          <p className="font-semibold">{r.vital_data.respiratory_rate} /min</p>
                        </div>
                      )}
                      {r.vital_data.blood_glucose && (
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">Glucose</p>
                          <p className="font-semibold">{r.vital_data.blood_glucose} mg/dL</p>
                        </div>
                      )}
                      {r.vital_data.weight && (
                        <div className="text-sm">
                          <p className="text-xs text-muted-foreground">Weight</p>
                          <p className="font-semibold">{r.vital_data.weight} kg</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    r.content && <p className="text-sm text-muted-foreground mt-3">{r.content}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </QueryState>
    </PatientLayout>
  );
}
