import { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { Calendar, CheckCircle2, Clock, MapPin, Search, Stethoscope, Video, X, XCircle } from "lucide-react";
import { toast } from "sonner";
import { HospitalLayout } from "@/layouts/HospitalLayout";
import { QueryState } from "@/components/common/QueryState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RescheduleAppointmentDialog } from "@/components/dialogs/RescheduleAppointmentDialog";
import { DeclineAppointmentDialog } from "@/components/appointments/DeclineAppointmentDialog";
import { useHospitalAppointments, useHospitalDoctors } from "@/hooks/useHospitalData";
import { useAssignDoctor, useCancelAppointment, useRespondToAppointment, appointmentError } from "@/hooks/useAppointmentActions";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "requests", label: "Requests" },
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past and closed" },
] as const;
type TabKey = typeof tabs[number]["key"];

const statusLabel: Record<string, string> = {
  pending: "Pending",
  accepted: "Accepted",
  completed: "Completed",
  cancelled: "Cancelled",
  rejected: "Declined",
};
const statusColor: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  accepted: "bg-success/15 text-success",
  cancelled: "bg-destructive/15 text-destructive",
  rejected: "bg-destructive/15 text-destructive",
};

const todayIso = () => format(new Date(), "yyyy-MM-dd");
const slotKey = (a: any) => `${a.requested_date} ${a.requested_time || "99:99"}`;

function tabOf(a: any): TabKey {
  if (a.status === "pending") return "requests";
  if (a.status === "accepted" && a.requested_date >= todayIso()) return "upcoming";
  return "past";
}

function patientName(a: any) {
  const n = `${a.patients?.first_name || ""} ${a.patients?.last_name || ""}`.trim();
  return n || "Patient";
}

function doctorName(d: any) {
  return `Dr. ${d?.first_name || ""} ${d?.last_name || ""}`.trim();
}

export default function HospitalAppointments() {
  const [tab, setTab] = useState<TabKey>("requests");
  const [q, setQ] = useState("");
  const [date, setDate] = useState("");
  const { data = [], isLoading, isError, error, refetch } = useHospitalAppointments();
  const { data: hospitalDoctors = [] } = useHospitalDoctors();

  // Same source as the Doctors page, limited to doctors who can take appointments.
  const doctors = useMemo(
    () => hospitalDoctors
      .filter((hd: any) => hd.status === "active" && hd.is_active !== false && hd.doctors?.verification_status === "approved")
      .map((hd: any) => ({ id: hd.doctor_id as string, name: doctorName(hd.doctors), specialty: hd.doctors?.specialty as string | null })),
    [hospitalDoctors],
  );

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { requests: 0, upcoming: 0, past: 0 };
    data.forEach((a) => { c[tabOf(a)]++; });
    return c;
  }, [data]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = data.filter((a) =>
      tabOf(a) === tab
      && (!needle || patientName(a).toLowerCase().includes(needle))
      && (!date || a.requested_date === date));
    if (tab === "requests") return rows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
    if (tab === "upcoming") return rows.sort((a, b) => slotKey(a).localeCompare(slotKey(b)));
    return rows.sort((a, b) => slotKey(b).localeCompare(slotKey(a)));
  }, [data, tab, q, date]);

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Appointments</h1>
        <p className="text-muted-foreground">Accept, assign or decline the appointments patients request at your hospital</p>
      </div>

      <div className="flex gap-1 mb-4 bg-muted/30 p-1 rounded-lg w-full sm:w-fit overflow-x-auto" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cn("px-3 sm:px-4 py-1.5 rounded-md text-sm whitespace-nowrap flex items-center gap-1.5", tab === t.key ? "bg-card text-foreground shadow" : "text-muted-foreground")}>
            {t.label}
            {counts[t.key] > 0 && t.key !== "past" && (
              <span className={cn("text-xs font-bold px-1.5 rounded-full", t.key === "requests" ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground")}>{counts[t.key]}</span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search patient name" aria-label="Search patient name" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Input type="date" aria-label="Filter by date" className="sm:w-44" value={date} onChange={(e) => setDate(e.target.value)} />
          {date && <Button variant="ghost" size="icon" aria-label="Clear date" onClick={() => setDate("")}><X className="w-4 h-4" /></Button>}
        </div>
      </div>

      <QueryState isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {list.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
            <Calendar className="w-10 h-10 mx-auto mb-2" />
            {tab === "requests" ? "No appointment requests waiting." : tab === "upcoming" ? "No upcoming appointments." : "No past or closed appointments."}
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((a) => <AppointmentCard key={a.id} a={a} doctors={doctors} />)}
          </div>
        )}
      </QueryState>
    </HospitalLayout>
  );
}

function AppointmentCard({ a, doctors }: { a: any; doctors: { id: string; name: string; specialty: string | null }[] }) {
  const [withoutAccepting, setWithoutAccepting] = useState(false);
  const assign = useAssignDoctor();
  const respond = useRespondToAppointment();
  const cancel = useCancelAppointment();
  const busy = assign.isPending || respond.isPending || cancel.isPending;
  const tab = tabOf(a);
  const isPending = a.status === "pending";

  async function onAssign(doctorId: string) {
    const accept = isPending ? !withoutAccepting : true;
    try {
      await assign.mutateAsync({ id: a.id, doctorId, accept });
      const name = doctors.find((d) => d.id === doctorId)?.name || "the doctor";
      toast.success(isPending && accept ? `Accepted and assigned to ${name}` : `Assigned to ${name}`);
    } catch (e) {
      toast.error(appointmentError(e));
    }
  }

  async function onAccept() {
    try {
      await respond.mutateAsync({ id: a.id, accept: true });
      toast.success("Appointment accepted");
    } catch (e) {
      toast.error(appointmentError(e));
    }
  }

  async function onCancel() {
    try {
      await cancel.mutateAsync(a.id);
      toast.success("Appointment cancelled");
    } catch (e) {
      toast.error(appointmentError(e));
    }
  }

  const when = a.requested_date ? format(new Date(`${a.requested_date}T00:00:00`), "EEE d MMM yyyy") : "No date";

  return (
    <div className="bg-card border border-border rounded-xl p-4 sm:p-5" data-testid="hospital-appointment-card" data-appointment-id={a.id}>
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-heading font-bold break-words">{patientName(a)}</h3>
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", a.is_telemedicine ? "bg-primary/15 text-primary" : "bg-muted text-foreground")}>
              {a.is_telemedicine ? <><Video className="inline w-3 h-3 mr-1" />Video</> : <><MapPin className="inline w-3 h-3 mr-1" />In person</>}
            </span>
            {tab === "past" && (
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusColor[a.status] || "bg-muted text-muted-foreground")}>{statusLabel[a.status] || a.status}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{when}</span>
            {a.requested_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{String(a.requested_time).slice(0, 5)}</span>}
            <span className="flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5" />{a.doctor_id ? doctorName(a.doctors) : "Any available doctor"}</span>
          </div>
          {a.reason && <p className="text-sm mt-2 break-words">{a.reason}</p>}
          {a.status === "rejected" && a.decline_reason && <p className="text-sm mt-2 text-destructive break-words">Declined: {a.decline_reason}</p>}
        </div>
        {a.created_at && (
          <span className="text-xs text-muted-foreground whitespace-nowrap">Booked {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</span>
        )}
      </div>

      {(isPending || tab === "upcoming") && (
        <div className="mt-4 pt-4 border-t border-border flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Select disabled={busy || doctors.length === 0} onValueChange={onAssign} value="">
              <SelectTrigger className="sm:w-64" aria-label={isPending ? "Assign doctor" : "Change doctor"}>
                <SelectValue placeholder={doctors.length === 0 ? "No verified doctors yet" : isPending ? "Assign doctor" : "Change doctor"} />
              </SelectTrigger>
              <SelectContent>
                {doctors.filter((d) => d.id !== a.doctor_id).map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}{d.specialty ? ` · ${d.specialty}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isPending && (
              <div className="flex items-center gap-2">
                <Checkbox id={`no-accept-${a.id}`} checked={withoutAccepting} onCheckedChange={(v) => setWithoutAccepting(v === true)} />
                <Label htmlFor={`no-accept-${a.id}`} className="text-xs text-muted-foreground font-normal">Assign without accepting</Label>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {isPending && a.doctor_id && (
              <Button size="sm" disabled={busy} onClick={onAccept} className="bg-success text-success-foreground hover:bg-success/90">
                <CheckCircle2 className="w-4 h-4" />Accept
              </Button>
            )}
            {isPending && (
              <DeclineAppointmentDialog appointmentId={a.id}
                trigger={<Button size="sm" variant="outline" disabled={busy}><XCircle className="w-4 h-4" />Decline</Button>} />
            )}
            <RescheduleAppointmentDialog appointment={a} />
            {tab === "upcoming" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" disabled={busy} className="text-destructive hover:text-destructive">Cancel</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel this appointment?</AlertDialogTitle>
                    <AlertDialogDescription>{patientName(a)} on {when}. The patient and doctor will be told.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Keep it</AlertDialogCancel>
                    <AlertDialogAction onClick={onCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, cancel</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
