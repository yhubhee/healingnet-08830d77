import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Calendar, Clock, Loader2, Search } from "lucide-react";
import { useDoctor } from "@/hooks/useDoctor";
import { AppointmentDetailDrawer } from "@/components/doctor/AppointmentDetailDrawer";
import { RescheduleAppointmentDialog } from "@/components/dialogs/RescheduleAppointmentDialog";
import { Input } from "@/components/ui/input";

const statuses = ["all", "pending", "accepted", "completed", "cancelled"] as const;

export default function DoctorAppointments() {
  const [filter, setFilter] = useState<typeof statuses[number]>("all");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<any>(null);
  const { data: ctx } = useDoctor();
  const { data, isLoading, error } = useQuery({
    enabled: !!ctx?.doctor?.id,
    queryKey: ["doctor", "appointments", ctx?.doctor?.id],
    queryFn: async () => {
      if (!ctx?.doctor?.id) return [];
      try {
        // Fetch appointments without complex joins first
        const { data: appts, error: fetchError } = await supabase
          .from("patient_appointments")
          .select("id, patient_id, doctor_id, hospital_id, requested_date, requested_time, status, reason, is_telemedicine, meeting_link, daily_room_name")
          .eq("doctor_id", ctx.doctor.id)
          .order("requested_date", { ascending: false });

        if (fetchError) {
          console.error("Error fetching doctor appointments:", fetchError);
          return [];
        }

        if (!appts || appts.length === 0) return [];

        // Fetch patient data separately to avoid join issues
        const patientIds = [...new Set(appts.map((a: any) => a.patient_id).filter(Boolean))];
        let patients: any[] = [];
        if (patientIds.length > 0) {
          const { data: patientRows, error: patientError } = await supabase
            .from("patients")
            .select("id, first_name, last_name, gender, date_of_birth, user_id")
            .in("id", patientIds);
          if (patientError) throw patientError;
          patients = patientRows || [];
        }

        const patientMap = new Map(patients.map((p: any) => [p.id, p]));
        return appts.map((a: any) => ({
          ...a,
          patients: patientMap.get(a.patient_id),
        }));
      } catch (err) {
        console.error("Unexpected error fetching appointments:", err);
        return [];
      }
    },
  });
  const list = (data || []).filter((a: any) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (q && !`${a.patients?.first_name} ${a.patients?.last_name} ${a.reason || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <DoctorLayout>
      <div className="mb-6"><h1 className="text-2xl font-heading font-bold">Appointments</h1><p className="text-muted-foreground text-sm">Manage patient bookings</p></div>

      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex gap-1 bg-muted/30 p-1 rounded-lg flex-wrap">
          {statuses.map((s) => <button key={s} onClick={() => setFilter(s)} className={cn("px-3 py-1.5 rounded-md text-sm capitalize", filter === s ? "bg-card shadow" : "text-muted-foreground")}>{s}</button>)}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search patient or reason..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {error && <div className="bg-destructive/15 text-destructive p-3 rounded-lg text-sm mb-4">Error: {error.message}</div>}
      {isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        list.length === 0 ? <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm"><Calendar className="w-10 h-10 mx-auto mb-2" />No {filter === "all" ? "" : filter} appointments.</div> :
        <div className="space-y-3">
          {list.map((a: any) => (
            <div key={a.id} className="w-full bg-card border border-border rounded-xl p-5 flex items-start gap-4 flex-wrap hover:border-primary/40 transition-colors">
              <button onClick={() => setActive(a)} className="flex-1 min-w-[200px] text-left">
                <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2"><Clock className="w-5 h-5" /></div>
                <h3 className="font-heading font-bold">{a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : "Patient"}</h3>
                {a.reason && <p className="text-sm text-muted-foreground">{a.reason}</p>}
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(a.requested_date).toDateString()}</span>
                  {a.requested_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{a.requested_time}</span>}
                </div>
              </button>
              <div className="flex flex-col gap-2 shrink-0">
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                  a.status === "pending" ? "bg-warning/15 text-warning" :
                  a.status === "accepted" ? "bg-success/15 text-success" :
                  a.status === "cancelled" ? "bg-destructive/15 text-destructive" :
                  "bg-muted text-muted-foreground")}>{a.status}</span>
                {["pending", "accepted", "confirmed"].includes(a.status) && (
                  <RescheduleAppointmentDialog appointment={a} />
                )}
              </div>
            </div>
          ))}
        </div>}

      <AppointmentDetailDrawer appointment={active} onClose={() => setActive(null)} />
    </DoctorLayout>
  );
}
