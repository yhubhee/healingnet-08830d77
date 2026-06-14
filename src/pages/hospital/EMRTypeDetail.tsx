import { HospitalLayout } from "@/layouts/HospitalLayout";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Search, ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useEmrEntries } from "@/hooks/useHospitalData";
import { cn } from "@/lib/utils";

const TYPE_INFO: Record<string, { label: string; icon: string; color: string; description: string }> = {
  vitals: { label: "Vitals", icon: "💓", color: "bg-success/15 text-success", description: "Blood pressure, temperature, heart rate, and other vital signs" },
  consultation_note: { label: "Consultation Notes", icon: "📝", color: "bg-primary/15 text-primary", description: "Doctor consultation and examination notes" },
  diagnosis: { label: "Diagnoses", icon: "🔍", color: "bg-warning/15 text-warning", description: "Clinical diagnoses and assessment" },
  lab_order: { label: "Lab Orders", icon: "🧪", color: "bg-info/15 text-info", description: "Laboratory test orders and results" },
  procedure: { label: "Procedures", icon: "🏥", color: "bg-purple-500/15 text-purple-400", description: "Medical procedures and interventions" },
  prescription: { label: "Prescriptions", icon: "💊", color: "bg-blue-500/15 text-blue-400", description: "Medication prescriptions" },
  allergy: { label: "Allergies", icon: "⚠️", color: "bg-destructive/15 text-destructive", description: "Known allergies and adverse reactions" },
  immunization: { label: "Immunizations", icon: "💉", color: "bg-teal-500/15 text-teal-400", description: "Vaccination records" },
  discharge_summary: { label: "Discharge Summaries", icon: "📄", color: "bg-muted text-muted-foreground", description: "Patient discharge information" },
};

export default function EMRTypeDetail() {
  const { type = "vitals" } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: allEntries = [] } = useEmrEntries();
  const [search, setSearch] = useState("");

  useEffect(() => {
    const channel = supabase
      .channel("realtime-emr-type")
      .on("postgres_changes", { event: "*", schema: "public", table: "emr_entries" }, () => {
        qc.invalidateQueries({ queryKey: ["emr-entries"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const filtered = allEntries.filter((e: any) => {
    const matchType = e.entry_type === type;
    const matchSearch = `${e.patients?.first_name || ""} ${e.patients?.last_name || ""} ${e.title}`.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  const info = TYPE_INFO[type as keyof typeof TYPE_INFO] || { label: type, icon: "📋", color: "bg-muted text-muted-foreground", description: "" };

  return (
    <HospitalLayout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/hospital/emr")} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />Back to EMR
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl">{info.icon}</span>
              <h1 className="text-2xl font-heading font-bold">{info.label}</h1>
            </div>
            <p className="text-muted-foreground">{info.description}</p>
          </div>
          <Button asChild>
            <a href="/hospital/emr/add"><Plus className="w-4 h-4 mr-2" />New Entry</a>
          </Button>
        </div>
      </div>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by patient or title..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

        <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground bg-card border border-border rounded-xl">
            No {info.label.toLowerCase()} records found
          </div>
        ) : filtered.map((entry: any) => (
          <div key={entry.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary transition-colors">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-heading font-bold text-sm">{entry.title}</h3>
                <p className="text-xs text-muted-foreground">{entry.patients?.first_name} {entry.patients?.last_name} • {entry.doctors ? `Dr. ${entry.doctors.first_name} ${entry.doctors.last_name}` : "—"}</p>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleDateString()}</span>
            </div>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mb-3", info.color)}>
              {info.label}
            </span>

            {entry.entry_type === "vitals" && entry.vital_data && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3 p-3 bg-muted/20 rounded-lg">
                {entry.vital_data.systolic && (
                  <div>
                    <p className="text-xs text-muted-foreground">BP</p>
                    <p className="font-semibold">{entry.vital_data.systolic}/{entry.vital_data.diastolic}</p>
                  </div>
                )}
                {entry.vital_data.heart_rate && (
                  <div>
                    <p className="text-xs text-muted-foreground">HR</p>
                    <p className="font-semibold">{entry.vital_data.heart_rate} bpm</p>
                  </div>
                )}
                {entry.vital_data.temperature && (
                  <div>
                    <p className="text-xs text-muted-foreground">Temp</p>
                    <p className="font-semibold">{entry.vital_data.temperature}°C</p>
                  </div>
                )}
                {entry.vital_data.oxygen_saturation && (
                  <div>
                    <p className="text-xs text-muted-foreground">O₂ Sat</p>
                    <p className="font-semibold">{entry.vital_data.oxygen_saturation}%</p>
                  </div>
                )}
                {entry.vital_data.respiratory_rate && (
                  <div>
                    <p className="text-xs text-muted-foreground">RR</p>
                    <p className="font-semibold">{entry.vital_data.respiratory_rate} /min</p>
                  </div>
                )}
                {entry.vital_data.blood_glucose && (
                  <div>
                    <p className="text-xs text-muted-foreground">Glucose</p>
                    <p className="font-semibold">{entry.vital_data.blood_glucose} mg/dL</p>
                  </div>
                )}
                {entry.vital_data.weight && (
                  <div>
                    <p className="text-xs text-muted-foreground">Weight</p>
                    <p className="font-semibold">{entry.vital_data.weight} kg</p>
                  </div>
                )}
              </div>
            )}

            {entry.content && (
              <div className="text-sm text-muted-foreground prose prose-sm max-w-none">
                <div dangerouslySetInnerHTML={{ __html: entry.content }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </HospitalLayout>
  );
}
