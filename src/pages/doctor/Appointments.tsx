import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useDoctorId, useDoctorAppointments } from "@/hooks/useHospitalData";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export default function DoctorAppointments() {
  const { data: docId } = useDoctorId();
  const { data: appts = [] } = useDoctorAppointments(docId);
  const qc = useQueryClient(); const { toast } = useToast();

  async function update(id: string, status: string) {
    await supabase.from("patient_appointments").update({ status }).eq("id", id);
    toast({ title: "Updated" });
    qc.invalidateQueries({ queryKey: ["doctor-appointments"] });
  }

  return (
    <DoctorLayout>
      <h1 className="text-2xl font-heading font-bold mb-6">Appointments</h1>
      <div className="space-y-3">
        {appts.length === 0 ? <p className="text-muted-foreground">No appointments yet</p> :
          appts.map((a: any) => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-4 flex justify-between items-center">
              <div>
                <h4 className="font-heading font-bold">{a.patients?.first_name} {a.patients?.last_name}</h4>
                <p className="text-sm text-muted-foreground">{a.requested_date} {a.requested_time} • {a.reason}</p>
                <span className="text-xs px-2 py-0.5 rounded bg-muted">{a.status}</span>
              </div>
              <div className="flex gap-2">
                {a.status === "pending" && <>
                  <Button size="sm" onClick={() => update(a.id, "approved")}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => update(a.id, "rejected")}>Decline</Button>
                </>}
                {a.status === "approved" && <Button size="sm" onClick={() => update(a.id, "completed")}>Complete</Button>}
              </div>
            </div>
          ))}
      </div>
    </DoctorLayout>
  );
}
