import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useDoctorId, useDoctorConsultations } from "@/hooks/useHospitalData";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function DoctorConsultations() {
  const { data: docId } = useDoctorId();
  const { data: consults = [] } = useDoctorConsultations(docId);
  const qc = useQueryClient(); const { toast } = useToast();

  async function action(id: string, status: string) {
    const updates: any = { status };
    if (status === "accepted") updates.meeting_link = `https://meet.healingnet.app/${id.slice(0,8)}`;
    await supabase.from("consultation_requests").update(updates).eq("id", id);
    toast({ title: "Updated" });
    qc.invalidateQueries({ queryKey: ["doctor-consults"] });
  }

  return (
    <DoctorLayout>
      <h1 className="text-2xl font-heading font-bold mb-6">Consultation Requests</h1>
      <div className="space-y-3">
        {consults.map((c: any) => (
          <div key={c.id} className="bg-card border border-border rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <h4 className="font-heading font-bold">{c.patients?.first_name} {c.patients?.last_name}</h4>
              <span className="text-xs px-2 py-0.5 rounded bg-muted">{c.status}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-3">{c.specialty_needed} • {c.urgency} • {c.reason}</p>
            {c.meeting_link && <a className="text-primary text-sm" href={c.meeting_link} target="_blank" rel="noreferrer">Join meeting</a>}
            {c.status === "pending" && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" onClick={() => action(c.id, "accepted")}>Accept</Button>
                <Button size="sm" variant="outline" onClick={() => action(c.id, "declined")}>Decline</Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </DoctorLayout>
  );
}
