import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Users, MessageSquare, TrendingUp, Loader2, Pill, FlaskConical, Mail, Clock, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useDoctor, useDoctorBadges } from "@/hooks/useDoctor";
import { useCallInPatient } from "@/hooks/useHospitalData";
import { NewPrescriptionDialog } from "@/components/doctor/NewPrescriptionDialog";
import { OrderLabTestDialog } from "@/components/doctor/OrderLabTestDialog";
import { AppointmentDetailDrawer } from "@/components/doctor/AppointmentDetailDrawer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function DoctorDashboard() {
  const { data: ctx, isLoading: ctxLoading } = useDoctor();
  const doc = ctx?.doctor;
  const { data: badges } = useDoctorBadges(doc?.id, ctx?.user?.id);
  const [active, setActive] = useState<any>(null);
  const qc = useQueryClient();
  const { toast } = useToast();
  const callInMutation = useCallInPatient();

  useEffect(() => {
    if (!doc?.id) return;

    const channels = [
      supabase
        .channel(`realtime-checkins-${doc.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "patient_checkins" }, () => {
          qc.invalidateQueries({ queryKey: ["doctor", "checkins", doc.id] });
        })
        .subscribe(),
      supabase
        .channel(`realtime-appointments-${doc.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "patient_appointments" }, () => {
          qc.invalidateQueries({ queryKey: ["doctor", "dashboard", doc.id] });
        })
        .subscribe(),
      supabase
        .channel(`realtime-consultations-${doc.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "consultation_requests" }, () => {
          qc.invalidateQueries({ queryKey: ["doctor", "dashboard", doc.id] });
          qc.invalidateQueries({ queryKey: ["doctor", "badges", doc.id] });
        })
        .subscribe(),
      supabase
        .channel(`realtime-messages-${doc.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "patient_messages" }, () => {
          qc.invalidateQueries({ queryKey: ["doctor", "badges", doc.id] });
        })
        .subscribe(),
    ];

    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [doc?.id, qc]);

  const { data: dash, isLoading } = useQuery({
    enabled: !!doc?.id,
    queryKey: ["doctor", "dashboard", doc?.id],
    queryFn: async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const [appts, cons, ptIds] = await Promise.all([
        supabase.from("patient_appointments").select("*, patients(id,first_name,last_name,gender,date_of_birth,user_id)").eq("doctor_id", doc!.id).eq("requested_date", todayStr).order("requested_time"),
        supabase.from("consultation_requests").select("*, patients(first_name,last_name)").eq("doctor_id", doc!.id).eq("status", "pending").limit(5),
        supabase.from("patient_appointments").select("patient_id").eq("doctor_id", doc!.id),
      ]);
      return {
        today: appts.data || [],
        pending: cons.data || [],
        patientCount: new Set((ptIds.data || []).map((r: any) => r.patient_id)).size,
      };
    },
  });

  const { data: checkins = [] } = useQuery({
    enabled: !!doc?.id,
    queryKey: ["doctor", "checkins", doc?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("patient_checkins")
        .select("*, patients(first_name, last_name, gender, date_of_birth), doctors:assigned_doctor_id(first_name, last_name)")
        .eq("assigned_doctor_id", doc!.id)
        .in("status", ["checked_in", "called"])
        .order("queue_number", { ascending: true });
      return data || [];
    },
  });

  const cards = [
    { label: "Today's Appointments", value: dash?.today.length || 0, icon: Calendar, color: "bg-info/10 text-info" },
    { label: "Pending Consults", value: badges?.consultations || 0, icon: MessageSquare, color: "bg-warning/10 text-warning" },
    { label: "Checked In", value: checkins.length || 0, icon: Clock, color: "bg-success/10 text-success" },
    { label: "Unread Messages", value: badges?.messages || 0, icon: Mail, color: "bg-primary/10 text-primary" },
  ];

  if (ctxLoading || isLoading) return <DoctorLayout><div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div></DoctorLayout>;

  return (
    <DoctorLayout>
      <h1 className="text-2xl font-heading font-bold mb-1">Welcome{doc?.first_name ? `, Dr. ${doc.first_name}` : ""} 👋</h1>
      <p className="text-muted-foreground mb-6">{doc?.specialty || ""}</p>

      <div className="flex gap-2 mb-5 flex-wrap">
        <NewPrescriptionDialog trigger={<Button variant="outline" size="sm"><Pill className="w-4 h-4" />New Prescription</Button>} />
        <OrderLabTestDialog trigger={<Button variant="outline" size="sm"><FlaskConical className="w-4 h-4" />Order Lab Test</Button>} />
        <Link to="/doctor/messages"><Button variant="outline" size="sm"><MessageSquare className="w-4 h-4" />Messages</Button></Link>
        <Link to="/doctor/settings"><Button variant="outline" size="sm"><Calendar className="w-4 h-4" />My Schedule</Button></Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c, i) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-5 animate-fade-in transition-transform hover:scale-105 hover:shadow-lg" style={{ animationDelay: `${i * 100}ms` }}>
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3 transition-transform", c.color)}><c.icon className="w-5 h-5" /></div>
            <div className="text-2xl font-heading font-bold">{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="bg-card border border-border rounded-xl p-5 lg:col-span-2 animate-fade-in transition-all hover:shadow-lg" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" />Today's Schedule</h3>
            <Link to="/doctor/appointments" className="text-sm text-primary">View all</Link>
          </div>
          {!dash?.today?.length ? <p className="text-sm text-muted-foreground py-6 text-center">No appointments today.</p> :
            <div className="space-y-2">
              {dash.today.map((a: any, i) => (
                <button key={a.id} onClick={() => setActive(a)} className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-muted/20 transition-colors animate-fade-in" style={{ animationDelay: `${200 + i * 50}ms` }}>
                  <div className="w-12 text-center text-sm font-bold">{a.requested_time?.slice(0, 5) || "—"}</div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : "Patient"}</div>
                    <div className="text-xs text-muted-foreground">{a.reason}</div>
                  </div>
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", a.status === "accepted" ? "bg-success/15 text-success" : a.status === "pending" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground")}>{a.status}</span>
                </button>
              ))}
            </div>}
        </div>

        <div className="bg-card border border-border rounded-xl p-5 animate-fade-in transition-all hover:shadow-lg" style={{ animationDelay: "200ms" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-success" />Queue</h3>
            <span className="text-xs bg-success/15 text-success px-2 py-1 rounded-full font-semibold">{checkins.length}</span>
          </div>
          {!checkins?.length ? <p className="text-sm text-muted-foreground py-6 text-center">No patients checked in.</p> :
            <div className="space-y-2">
              {checkins.slice(0, 5).map((c: any, i) => (
                <div key={c.id} className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg justify-between transition-all hover:bg-muted/50 animate-fade-in" style={{ animationDelay: `${250 + i * 50}ms` }}>
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-8 h-8 rounded-full bg-success/20 text-success flex items-center justify-center text-xs font-bold">#{c.queue_number}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{c.patients?.first_name} {c.patients?.last_name}</div>
                      <div className="text-xs text-muted-foreground">{c.urgency}</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => {
                      callInMutation.mutate(c.id, {
                        onSuccess: () => toast({ title: "Success", description: `Called in ${c.patients?.first_name}` }),
                        onError: (err) => toast({ title: "Error", description: err.message, variant: "destructive" }),
                      });
                    }}
                    disabled={callInMutation.isPending}
                    className="gap-1"
                  >
                    <Phone className="w-3 h-3" />
                    <span className="hidden sm:inline">Call In</span>
                  </Button>
                </div>
              ))}
            </div>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mt-5 animate-fade-in transition-all hover:shadow-lg" style={{ animationDelay: "300ms" }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-warning" />Consult Requests</h3>
          <Link to="/doctor/consultations" className="text-sm text-primary">View all</Link>
        </div>
        {!dash?.pending?.length ? <p className="text-sm text-muted-foreground py-6 text-center">No pending requests.</p> :
          <div className="space-y-3">
            {dash.pending.slice(0, 3).map((c: any, i) => (
              <Link to="/doctor/consultations" key={c.id} className="block border-b border-border last:border-0 pb-3 last:pb-0 transition-colors hover:text-primary animate-fade-in" style={{ animationDelay: `${350 + i * 50}ms` }}>
                <div className="font-medium text-sm">{c.patients ? `${c.patients.first_name} ${c.patients.last_name}` : "Patient"}</div>
                <div className="text-xs text-muted-foreground italic mt-1">"{c.reason}"</div>
              </Link>
            ))}
          </div>}
      </div>

      <AppointmentDetailDrawer appointment={active} onClose={() => setActive(null)} />
    </DoctorLayout>
  );
}
