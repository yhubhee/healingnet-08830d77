import { PatientLayout } from "@/layouts/PatientLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Stethoscope, FileText, Activity, Pill, Syringe, Loader2 } from "lucide-react";

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
  const { data, isLoading } = useQuery({
    queryKey: ["patient", "emr"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: p } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
      if (!p) return [];
      const { data } = await supabase.from("emr_entries").select("*, doctors(first_name,last_name)").eq("patient_id", p.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Medical Records</h1>
        <p className="text-muted-foreground text-sm">Your full clinical history, in one timeline</p>
      </div>

      {isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        (data || []).length === 0 ? <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm"><FileText className="w-10 h-10 mx-auto mb-2" />No medical records yet.</div> :
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
                  {r.content && <p className="text-sm text-muted-foreground mt-3">{r.content}</p>}
                </div>
              </div>
            );
          })}
        </div>}
    </PatientLayout>
  );
}
