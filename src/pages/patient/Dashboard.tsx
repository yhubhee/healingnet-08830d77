import { PatientLayout } from "@/layouts/PatientLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Calendar, Pill, FlaskConical, FileText, ArrowRight, Stethoscope, Loader2 } from "lucide-react";

export default function PatientDashboard() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({ upcoming: 0, activeRx: 0, labs: 0, emr: 0 });
  const [next, setNext] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: p } = await supabase.from("patients").select("*").eq("user_id", user.id).maybeSingle();
      setProfile(p);
      if (!p) { setLoading(false); return; }

      const [appts, rx, labs, emr] = await Promise.all([
        supabase.from("patient_appointments").select("*, doctors(first_name,last_name,specialty), hospitals(name)").eq("patient_id", p.id).in("status", ["pending", "accepted", "confirmed"]).order("requested_date"),
        supabase.from("prescriptions").select("id").eq("patient_id", p.id).eq("status", "active"),
        supabase.from("lab_results").select("id").eq("patient_id", p.id),
        supabase.from("emr_entries").select("id").eq("patient_id", p.id),
      ]);
      setStats({ upcoming: appts.data?.length || 0, activeRx: rx.data?.length || 0, labs: labs.data?.length || 0, emr: emr.data?.length || 0 });
      setNext(appts.data?.[0] || null);
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Upcoming Appointments", value: stats.upcoming, icon: Calendar, color: "text-info", bg: "bg-info/10" },
    { label: "Active Prescriptions", value: stats.activeRx, icon: Pill, color: "text-success", bg: "bg-success/10" },
    { label: "Lab Results", value: stats.labs, icon: FlaskConical, color: "text-warning", bg: "bg-warning/10" },
    { label: "Medical Entries", value: stats.emr, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Welcome back{profile?.first_name ? `, ${profile.first_name}` : ""}</h1>
        <p className="text-muted-foreground">Here's a quick overview of your health journey</p>
      </div>

      <div className="bg-gradient-to-r from-primary/15 to-info/15 border border-primary/20 rounded-xl p-5 mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Stethoscope className="w-8 h-8 text-primary" />
          <div>
            <h3 className="font-heading font-bold">Not sure what's wrong?</h3>
            <p className="text-sm text-muted-foreground">Run our 4-step AI symptom triage and get matched to the right specialist.</p>
          </div>
        </div>
        <Link to="/patient/triage" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-1">Start triage <ArrowRight className="w-4 h-4" /></Link>
      </div>

      {loading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-5">
                <div className={`w-10 h-10 rounded-lg ${s.bg} ${s.color} flex items-center justify-center mb-3`}><s.icon className="w-5 h-5" /></div>
                <div className="text-2xl font-heading font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          {next && (
            <div className="bg-card border border-border rounded-xl p-5 mb-6">
              <p className="text-xs uppercase tracking-wider text-primary mb-1">Your next appointment</p>
              <h3 className="text-lg font-heading font-bold">{next.doctors ? `Dr. ${next.doctors.first_name} ${next.doctors.last_name}` : "Awaiting assignment"} {next.doctors?.specialty && `• ${next.doctors.specialty}`}</h3>
              <p className="text-sm text-muted-foreground mt-1">{next.hospitals?.name}</p>
              <p className="text-sm mt-2">{new Date(next.requested_date).toDateString()} {next.requested_time && `at ${next.requested_time}`}</p>
              <Link to="/patient/appointments" className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-3">View all <ArrowRight className="w-4 h-4" /></Link>
            </div>
          )}
        </>}
    </PatientLayout>
  );
}
