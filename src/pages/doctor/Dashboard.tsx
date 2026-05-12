import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Users, MessageSquare, TrendingUp, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function DoctorDashboard() {
  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<any>(null);
  const [today, setToday] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [patientCount, setPatientCount] = useState(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: d } = await supabase.from("doctors").select("*").eq("user_id", user.id).maybeSingle();
      setDoc(d);
      if (!d) { setLoading(false); return; }

      const todayStr = new Date().toISOString().slice(0, 10);
      const [appts, cons, ptIds] = await Promise.all([
        supabase.from("patient_appointments").select("*, patients(first_name,last_name,gender,date_of_birth)").eq("doctor_id", d.id).eq("requested_date", todayStr).order("requested_time"),
        supabase.from("consultation_requests").select("*, patients(first_name,last_name)").eq("doctor_id", d.id).eq("status", "pending").limit(5),
        supabase.from("patient_appointments").select("patient_id").eq("doctor_id", d.id),
      ]);
      setToday(appts.data || []);
      setPending(cons.data || []);
      setPatientCount(new Set((ptIds.data || []).map((r: any) => r.patient_id)).size);
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Today's Appointments", value: today.length, icon: Calendar, color: "bg-info/10 text-info" },
    { label: "Pending Consults", value: pending.length, icon: MessageSquare, color: "bg-warning/10 text-warning" },
    { label: "Active Patients", value: patientCount, icon: Users, color: "bg-success/10 text-success" },
    { label: "Rating", value: doc?.rating ? `${doc.rating} ★` : "—", icon: TrendingUp, color: "bg-primary/10 text-primary" },
  ];

  return (
    <DoctorLayout>
      <h1 className="text-2xl font-heading font-bold mb-1">Welcome{doc?.first_name ? `, Dr. ${doc.first_name}` : ""} 👋</h1>
      <p className="text-muted-foreground mb-6">{doc?.specialty || ""}</p>

      {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        <>
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
              {today.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No appointments today.</p> :
                <div className="space-y-2">
                  {today.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/20">
                      <div className="w-12 text-center text-sm font-bold">{a.requested_time?.slice(0, 5) || "—"}</div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : "Patient"}</div>
                        <div className="text-xs text-muted-foreground">{a.reason}</div>
                      </div>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", a.status === "accepted" ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>{a.status}</span>
                    </div>
                  ))}
                </div>}
            </div>

            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading font-bold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-warning" />Consult Requests</h3>
                <Link to="/doctor/consultations" className="text-sm text-primary">View all</Link>
              </div>
              {pending.length === 0 ? <p className="text-sm text-muted-foreground py-6 text-center">No pending requests.</p> :
                <div className="space-y-3">
                  {pending.slice(0, 3).map((c) => (
                    <div key={c.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                      <div className="font-medium text-sm">{c.patients ? `${c.patients.first_name} ${c.patients.last_name}` : "Patient"}</div>
                      <div className="text-xs text-muted-foreground italic mt-1">"{c.reason}"</div>
                    </div>
                  ))}
                </div>}
            </div>
          </div>
        </>}
    </DoctorLayout>
  );
}
