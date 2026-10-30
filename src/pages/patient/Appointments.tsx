import { PatientLayout } from "@/layouts/PatientLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Calendar, Clock, MapPin, User, Plus, Stethoscope, Video, CalendarPlus, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { RescheduleAppointmentDialog } from "@/components/dialogs/RescheduleAppointmentDialog";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/common/QueryState";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useCancelAppointment, appointmentError } from "@/hooks/useAppointmentActions";

const tabs = ["upcoming", "past", "cancelled"] as const;
const tabLabels: Record<typeof tabs[number], string> = { upcoming: "Upcoming", past: "Past", cancelled: "Cancelled and declined" };

// The status in plain words, as the patient should read it.
function statusText(a: any): string {
  const doctor = a.doctors ? `Dr. ${a.doctors.first_name} ${a.doctors.last_name}` : null;
  switch (a.status) {
    case "pending": return "Waiting for the hospital to confirm";
    case "accepted":
    case "confirmed": return doctor ? `Confirmed with ${doctor}` : "Confirmed";
    case "rejected": return a.decline_reason ? `Declined: ${a.decline_reason}` : "Declined";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    default: return a.status;
  }
}

export default function PatientAppointments() {
  const [tab, setTab] = useState<typeof tabs[number]>("upcoming");
  const cancel = useCancelAppointment();

  async function onCancel(id: string) {
    try {
      await cancel.mutateAsync(id);
      toast.success("Appointment cancelled");
    } catch (e) {
      toast.error(appointmentError(e));
    }
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["patient", "appointments"],
    queryFn: async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const { data: p } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
        if (!p) return [];

        // Fetch appointments without complex joins
        const { data: appts, error: fetchError } = await supabase
          .from("patient_appointments")
          .select("id, patient_id, doctor_id, hospital_id, requested_date, requested_time, status, reason, is_telemedicine, meeting_link, daily_room_name, decline_reason")
          .eq("patient_id", p.id)
          .order("requested_date", { ascending: false });

        if (fetchError) throw fetchError;

        if (!appts || appts.length === 0) return [];

        // Fetch doctor and hospital data separately
        const doctorIds = [...new Set(appts.map((a: any) => a.doctor_id).filter(Boolean))];
        const hospitalIds = [...new Set(appts.map((a: any) => a.hospital_id).filter(Boolean))];

        const [doctorsRes, hospitalsRes] = await Promise.all([
          doctorIds.length > 0
            ? supabase.from("doctors").select("id, first_name, last_name, specialty").in("id", doctorIds)
            : Promise.resolve({ data: [] }),
          hospitalIds.length > 0
            ? supabase.from("hospitals").select("id, name").in("id", hospitalIds)
            : Promise.resolve({ data: [] }),
        ]);

        const doctorMap = new Map((doctorsRes.data || []).map((d: any) => [d.id, d]));
        const hospitalMap = new Map((hospitalsRes.data || []).map((h: any) => [h.id, h]));

        return appts.map((a: any) => ({
          ...a,
          doctors: a.doctor_id ? doctorMap.get(a.doctor_id) : null,
          hospitals: a.hospital_id ? hospitalMap.get(a.hospital_id) : null,
        }));
      } catch (err) {
        throw err;
      }
    },
  });

  const filtered = (data || []).filter((a: any) => {
    if (tab === "upcoming") return ["pending", "accepted", "confirmed"].includes(a.status);
    if (tab === "past") return ["completed", "done"].includes(a.status);
    return ["cancelled", "rejected"].includes(a.status);
  });

  const statusBadge = (s: string) => ({
    pending: "bg-warning/15 text-warning",
    accepted: "bg-success/15 text-success",
    confirmed: "bg-success/15 text-success",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/15 text-destructive",
    rejected: "bg-destructive/15 text-destructive",
  } as Record<string, string>)[s] || "bg-muted";

  return (
    <PatientLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Appointments</h1>
          <p className="text-muted-foreground text-sm">Manage your bookings and consultations</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/patient/book" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium"><CalendarPlus className="w-4 h-4" />Book appointment</Link>
          <Link to="/patient/triage" className="inline-flex items-center gap-2 border border-border px-4 py-2 rounded-lg font-medium"><Stethoscope className="w-4 h-4" />Start triage</Link>
        </div>
      </div>

      <div className="flex gap-1 mb-5 bg-muted/30 p-1 rounded-lg w-full sm:w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-3 sm:px-4 py-1.5 rounded-md text-sm whitespace-nowrap", tab === t ? "bg-card text-foreground shadow" : "text-muted-foreground")}>{tabLabels[t]}</button>
        ))}
      </div>

      <QueryState isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm mb-4">No {tabLabels[tab].toLowerCase()} appointments yet.</p>
              {tab === "upcoming" && <Link to="/patient/triage" className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm"><Plus className="w-4 h-4" />Book your first appointment</Link>}
            </div>
          )}
          {filtered.map((a: any) => {
            const doc = a.doctors ? `Dr. ${a.doctors.first_name} ${a.doctors.last_name}` : "Doctor to be assigned";
            const isTelemedicine = a.is_telemedicine === true;
            return (
              <div key={a.id} data-testid="patient-appointment-card" data-appointment-id={a.id} className="bg-card border border-border rounded-xl p-5 flex flex-wrap items-start gap-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", isTelemedicine ? "bg-primary/10 text-primary" : "bg-primary/10 text-primary")}>
                  {isTelemedicine ? <Video className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0 basis-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-bold">{doc}</h3>
                    <span data-testid="appointment-status" className={cn("px-2 py-0.5 rounded-full text-xs font-medium break-words", statusBadge(a.status))}>{statusText(a)}</span>
                    {isTelemedicine && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary">Online Consultation</span>
                    )}
                  </div>
                  {a.doctors?.specialty && <p className="text-sm text-muted-foreground">{a.doctors.specialty}</p>}
                  {a.reason && <p className="text-sm mt-1">{a.reason}</p>}
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {isTelemedicine ? (
                        <>
                          <Video className="w-3.5 h-3.5" />Online
                        </>
                      ) : (
                        <>
                          <MapPin className="w-3.5 h-3.5" />{a.hospitals?.name || "—"}
                        </>
                      )}
                    </span>
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(a.requested_date).toDateString()}</span>
                    {a.requested_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{a.requested_time}</span>}
                  </div>
                  {isTelemedicine && ["accepted", "confirmed"].includes(a.status) && (
                    <div className="mt-3 flex gap-2">
                      <Link
                        to={`/consult/${a.id}?mode=appointment`}
                        className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Video className="w-3 h-3" />
                        Join Consultation
                      </Link>
                    </div>
                  )}
                  {a.status === "rejected" && (
                    <div className="mt-3">
                      <Link to="/patient/book" className="inline-flex items-center gap-1 text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg"><RotateCcw className="w-3 h-3" />Book again</Link>
                    </div>
                  )}
                  {["pending", "accepted", "confirmed"].includes(a.status) && (
                    <div className="mt-3 flex gap-2">
                      <RescheduleAppointmentDialog
                        appointment={a}
                        trigger={<Button variant="outline" size="sm">Reschedule</Button>}
                      />
                      {/* The database lets a patient cancel a pending or accepted booking. */}
                      {["pending", "accepted"].includes(a.status) && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" disabled={cancel.isPending} className="text-destructive hover:text-destructive">Cancel</Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {doc} on {new Date(a.requested_date).toDateString()}{a.requested_time ? ` at ${String(a.requested_time).slice(0, 5)}` : ""}. The hospital will be told.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep it</AlertDialogCancel>
                              <AlertDialogAction onClick={() => onCancel(a.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, cancel</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
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
