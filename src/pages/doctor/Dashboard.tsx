import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Users, MessageSquare, TrendingUp, Loader2, Pill, FlaskConical, Mail, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useDoctor, useDoctorBadges } from "@/hooks/useDoctor";
import { NewPrescriptionDialog } from "@/components/doctor/NewPrescriptionDialog";
import { OrderLabTestDialog } from "@/components/doctor/OrderLabTestDialog";
import { AppointmentDetailDrawer } from "@/components/doctor/AppointmentDetailDrawer";
import { Button } from "@/components/ui/button";

export default function DoctorDashboard() {
  const { data: ctx, isLoading: ctxLoading } = useDoctor();
  const doc = ctx?.doctor;
  const { data: badges } = useDoctorBadges(doc?.id, ctx?.user?.id);
  const [active, setActive] = useState<any>(null);
  const qc = useQueryClient();

  useEffect(() => {
    if (!doc?.id) return;
    const channel = supabase
      .channel(`realtime-checkins-${doc.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "patient_checkins" }, () => {
        qc.invalidateQueries({ queryKey: ["doctor", "checkins", doc.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
        {cards.map((c) => (
          <div key={c.label} className="bg-card border border-border rounded-xl p-5">
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center mb-3", c.color)}><c.icon className="w-5 h-5" /></div>
            <div className="text-2xl font-heading font-bold">{c.value}</div>
            <div className="text-xs text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="bg-card border border-border rounded-xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" />Today's Schedule</h3>
            <Link to="/doctor/appointments" className="text-sm text-primary">View all</Link>
          </div>
          {!dash?.today?.length ? <p className="text-sm text-muted-foreground py-6 text-center">No appointments today.</p> :
            <div className="space-y-2">
              {dash.today.map((a: any) => (
                <button key={a.id} onClick={() => setActive(a)} className="w-full text-left flex items-center gap-3 p-3 rounded-lg hover:bg-muted/20">
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

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold flex items-center gap-2"><Clock className="w-4 h-4 text-success" />Queue</h3>
            <span className="text-xs bg-success/15 text-success px-2 py-1 rounded-full font-semibold">{checkins.length}</span>
          </div>
          {!checkins?.length ? <p className="text-sm text-muted-foreground py-6 text-center">No patients checked in.</p> :
            <div className="space-y-2">
              {checkins.slice(0, 5).map((c: any) => (
                <div key={c.id} className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-success/20 text-success flex items-center justify-center text-xs font-bold">#{c.queue_number}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{c.patients?.first_name} {c.patients?.last_name}</div>
                    <div className="text-xs text-muted-foreground">{c.urgency}</div>
                  </div>
                </div>
              ))}
            </div>}
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 mt-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-bold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-warning" />Consult Requests</h3>
          <Link to="/doctor/consultations" className="text-sm text-primary">View all</Link>
        </div>
        {!dash?.pending?.length ? <p className="text-sm text-muted-foreground py-6 text-center">No pending requests.</p> :
          <div className="space-y-3">
            {dash.pending.slice(0, 3).map((c: any) => (
              <Link to="/doctor/consultations" key={c.id} className="block border-b border-border last:border-0 pb-3 last:pb-0">
                <div className="font-medium text-sm">{c.patients ? `${c.patients.first_name} ${c.patients.last_name}` : "Patient"}</div>
                <div className="text-xs text-muted-foreground italic mt-1">"{c.reason}"</div>
              </Link>
            ))}
          </div>}

      <AppointmentDetailDrawer appointment={active} onClose={() => setActive(null)} />
    </DoctorLayout>
  );
}
