import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Video, FileText, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DoctorConsultations() {
  const { data, isLoading } = useQuery({
    queryKey: ["doctor", "consultations"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: doc } = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      if (!doc) return [];
      const { data } = await supabase.from("consultation_requests").select("*, patients(first_name,last_name)").eq("doctor_id", doc.id).order("created_at", { ascending: false });
      return data || [];
    },
  });

  return (
    <DoctorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Consultation Requests</h1>
        <p className="text-muted-foreground text-sm">External consults via the Care Zone marketplace</p>
      </div>

      {isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        (data || []).length === 0 ? <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm"><MessageSquare className="w-10 h-10 mx-auto mb-2" />No consultation requests yet.</div> :
        <div className="grid md:grid-cols-2 gap-4">
          {(data || []).map((c: any) => (
            <div key={c.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", c.request_type === "virtual" ? "bg-info/10 text-info" : "bg-warning/10 text-warning")}>
                  {c.request_type === "virtual" ? <Video className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-heading font-bold">{c.patients ? `${c.patients.first_name} ${c.patients.last_name}` : "Patient"}</h3>
                  <p className="text-xs text-muted-foreground">{c.specialty_needed || "—"}</p>
                </div>
                <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", c.urgency === "urgent" ? "bg-destructive/15 text-destructive" : c.urgency === "moderate" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground")}>{c.urgency}</span>
              </div>
              <p className="text-sm mt-3 italic text-muted-foreground">"{c.reason}"</p>
              {c.fee_agreed && <div className="mt-3 pt-3 border-t border-border"><div className="text-xs text-muted-foreground">Fee</div><div className="font-bold text-primary">₦{Number(c.fee_agreed).toLocaleString()}</div></div>}
            </div>
          ))}
        </div>}
    </DoctorLayout>
  );
}
