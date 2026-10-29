import { StartConsultationButton, useConsultationStatus } from "@/components/consultation/StartConsultationButton";
import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Calendar, CheckCircle2, Clock, Hand, MapPin, Search, Building2, Video, XCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useDoctor, useOpenRequests } from "@/hooks/useDoctor";
import { useClaimAppointment, useRespondToAppointment, appointmentError } from "@/hooks/useAppointmentActions";
import { DeclineAppointmentDialog } from "@/components/appointments/DeclineAppointmentDialog";
import { Button } from "@/components/ui/button";
import { AppointmentDetailDrawer } from "@/components/doctor/AppointmentDetailDrawer";
import { RescheduleAppointmentDialog } from "@/components/dialogs/RescheduleAppointmentDialog";
import { Input } from "@/components/ui/input";
import { QueryState } from "@/components/common/QueryState";

const statuses = ["all", "pending", "accepted", "completed", "cancelled", "rejected"] as const;
const statusLabel: Record<string, string> = { rejected: "declined" };

export default function DoctorAppointments() {
  const [filter, setFilter] = useState<typeof statuses[number]>("all");
  const [q, setQ] = useState("");
  // The id, not a copy of the row, so the drawer shows the latest status after a refetch.
  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: ctx } = useDoctor();
  const { data, isLoading, isError, error, refetch } = useQuery({
    enabled: !!ctx?.doctor?.id,
    queryKey: ["doctor", "appointments", ctx?.doctor?.id],
    queryFn: async () => {
      if (!ctx?.doctor?.id) return [];
      try {
        // Fetch appointments without complex joins first
        const { data: appts, error: fetchError } = await supabase
          .from("patient_appointments")
          .select("id, patient_id, doctor_id, hospital_id, requested_date, requested_time, status, reason, notes, is_telemedicine, meeting_link, daily_room_name, consultation_notes, decline_reason")
          .eq("doctor_id", ctx.doctor.id)
          .order("requested_date", { ascending: false });

        if (fetchError) throw fetchError;

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
        throw err;
      }
    },
  });
  const list = (data || []).filter((a: any) => {
    if (filter !== "all" && a.status !== filter) return false;
    if (q && !`${a.patients?.first_name} ${a.patients?.last_name} ${a.reason || ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const active = (data || []).find((a: any) => a.id === activeId) ?? null;
  const { data: cs } = useConsultationStatus((data || []).map((a: any) => a.id));
  const respond = useRespondToAppointment();

  async function accept(id: string) {
    try {
      await respond.mutateAsync({ id, accept: true });
      toast.success("Appointment accepted");
    } catch (e) {
      toast.error(appointmentError(e));
    }
  }

  return (
    <DoctorLayout>
      <div className="mb-6"><h1 className="text-2xl font-heading font-bold">Appointments</h1><p className="text-muted-foreground text-sm">Manage patient bookings</p></div>

      <OpenRequests doctorId={ctx?.doctor?.id} />

      <h2 className="font-heading font-bold text-lg mb-3">My appointments</h2>
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex gap-1 bg-muted/30 p-1 rounded-lg flex-wrap">
          {statuses.map((s) => <button key={s} onClick={() => setFilter(s)} className={cn("px-3 py-1.5 rounded-md text-sm capitalize", filter === s ? "bg-card shadow" : "text-muted-foreground")}>{statusLabel[s] || s}</button>)}
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search patient or reason..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      <QueryState isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {list.length === 0 ? <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm"><Calendar className="w-10 h-10 mx-auto mb-2" />No {filter === "all" ? "" : statusLabel[filter] || filter} appointments.</div> :
        <div className="space-y-3">
          {list.map((a: any) => (
            <div key={a.id} data-testid="doctor-appointment-card" data-appointment-id={a.id} className="w-full bg-card border border-border rounded-xl p-5 flex items-start gap-4 flex-wrap hover:border-primary/40 transition-colors">
              <button onClick={() => setActiveId(a.id)} className="flex-1 min-w-[200px] text-left">
                <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-2"><Clock className="w-5 h-5" /></div>
                <h3 className="font-heading font-bold">{a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : "Patient"}</h3>
                {a.reason && <p className="text-sm text-muted-foreground">{a.reason}</p>}
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(a.requested_date).toDateString()}</span>
                  {a.requested_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{a.requested_time}</span>}
                  <span className="flex items-center gap-1">{a.is_telemedicine ? <><Video className="w-3.5 h-3.5" />Video</> : <><MapPin className="w-3.5 h-3.5" />In person</>}</span>
                </div>
                {a.status === "rejected" && a.decline_reason && <p className="text-xs text-destructive mt-1">Declined: {a.decline_reason}</p>}
              </button>
              <div className="flex flex-col gap-2 shrink-0">
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize",
                  a.status === "pending" ? "bg-warning/15 text-warning" :
                  a.status === "accepted" ? "bg-success/15 text-success" :
                  a.status === "cancelled" ? "bg-destructive/15 text-destructive" :
                  "bg-muted text-muted-foreground")}>{statusLabel[a.status] || a.status}</span>
                {a.status === "pending" && (
                  <>
                    <Button size="sm" disabled={respond.isPending} onClick={() => accept(a.id)} className="bg-success text-success-foreground hover:bg-success/90"><CheckCircle2 className="w-4 h-4" />Accept</Button>
                    <DeclineAppointmentDialog appointmentId={a.id} trigger={<Button size="sm" variant="outline"><XCircle className="w-4 h-4" />Decline</Button>} />
                  </>
                )}
                {["accepted", "confirmed", "completed"].includes(a.status) && <StartConsultationButton size="sm" appointment={a} status={cs?.[a.id]} />}
                {["pending", "accepted", "confirmed"].includes(a.status) && (
                  <RescheduleAppointmentDialog appointment={a} />
                )}
              </div>
            </div>
          ))}
        </div>}
      </QueryState>

      <AppointmentDetailDrawer appointment={active} onClose={() => setActiveId(null)} />
    </DoctorLayout>
  );
}

function OpenRequests({ doctorId }: { doctorId?: string }) {
  const { data = [], isLoading, isError, error, refetch } = useOpenRequests(doctorId);
  const claim = useClaimAppointment();

  async function take(id: string) {
    try {
      await claim.mutateAsync(id);
      toast.success("Added to your appointments");
    } catch (e) {
      // Usually another doctor took it first; the refetch removes the card.
      toast.error(appointmentError(e));
    }
  }

  return (
    <section className="mb-8" aria-labelledby="open-requests-heading">
      <div className="flex items-center gap-2 mb-1">
        <h2 id="open-requests-heading" className="font-heading font-bold text-lg">Open requests</h2>
        {data.length > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-warning/15 text-warning">{data.length}</span>}
      </div>
      <p className="text-sm text-muted-foreground mb-3">Patients who asked for any available doctor at your hospitals. The first doctor to take one gets it.</p>
      <QueryState isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {data.length === 0 ? (
          <div className="bg-card border border-dashed border-border rounded-xl p-6 text-center text-sm text-muted-foreground">No open requests right now.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.map((a: any) => (
              <div key={a.id} data-testid="open-request-card" data-appointment-id={a.id} className="bg-card border border-warning/30 rounded-xl p-4 flex flex-col gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{a.hospitals?.name || "Hospital"}</div>
                  <h3 className="font-heading font-bold break-words">{a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : "Patient"}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{format(new Date(`${a.requested_date}T00:00:00`), "EEE d MMM yyyy")}</span>
                    {a.requested_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{String(a.requested_time).slice(0, 5)}</span>}
                    <span className="flex items-center gap-1">{a.is_telemedicine ? <><Video className="w-3.5 h-3.5" />Video</> : <><MapPin className="w-3.5 h-3.5" />In person</>}</span>
                  </div>
                  {a.reason && <p className="text-sm mt-2 break-words">{a.reason}</p>}
                </div>
                <Button size="sm" className="self-start" disabled={claim.isPending} onClick={() => take(a.id)}><Hand className="w-4 h-4" />Take this appointment</Button>
              </div>
            ))}
          </div>
        )}
      </QueryState>
    </section>
  );
}
