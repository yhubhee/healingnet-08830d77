import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useDoctorId, useDoctorAppointments, useDoctorConsultations, useDoctorEmrEntries, useDoctorProfile } from "@/hooks/useHospitalData";
import { Calendar, Users, MessageSquare, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DoctorDashboard() {
  const { data: docId } = useDoctorId();
  const { data: profile } = useDoctorProfile(docId);
  const { data: appts = [] } = useDoctorAppointments(docId);
  const { data: consults = [] } = useDoctorConsultations(docId);
  const { data: emr = [] } = useDoctorEmrEntries(docId);
  const today = new Date().toISOString().slice(0, 10);
  const todayAppts = appts.filter((a: any) => a.requested_date === today);
  const pendingConsults = consults.filter((c: any) => c.status === "pending");
  const cards = [
    { label: "Today's Appointments", value: todayAppts.length, icon: Calendar, gradient: "gradient-primary" },
    { label: "Pending Consults", value: pendingConsults.length, icon: MessageSquare, gradient: "gradient-warning" },
    { label: "Recent Notes", value: emr.length, icon: FileText, gradient: "gradient-info" },
    { label: "Total Appointments", value: appts.length, icon: Users, gradient: "gradient-success" },
  ];
  return (
    <DoctorLayout>
      <h1 className="text-2xl font-heading font-bold mb-1">Welcome, Dr. {profile?.last_name || ""}</h1>
      <p className="text-muted-foreground mb-6">{profile?.specialty || "Specialist"}</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((c) => (
          <div key={c.label} className={cn("relative rounded-xl p-5 overflow-hidden", c.gradient)}>
            <c.icon className="absolute top-3 right-3 w-8 h-8 opacity-20" />
            <p className="text-sm opacity-80">{c.label}</p>
            <h3 className="text-2xl font-heading font-bold">{c.value}</h3>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-heading font-bold mb-3">Today's Appointments</h3>
          {todayAppts.length === 0 ? <p className="text-sm text-muted-foreground">None scheduled</p> :
            todayAppts.map((a: any) => (
              <div key={a.id} className="py-2 border-b border-border last:border-0">
                <div className="font-semibold text-sm">{a.patients?.first_name} {a.patients?.last_name}</div>
                <div className="text-xs text-muted-foreground">{a.requested_time} • {a.reason}</div>
              </div>
            ))}
        </div>
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-heading font-bold mb-3">Recent Clinical Notes</h3>
          {emr.slice(0, 5).map((e: any) => (
            <div key={e.id} className="py-2 border-b border-border last:border-0">
              <div className="font-semibold text-sm">{e.title}</div>
              <div className="text-xs text-muted-foreground">{e.patients?.first_name} {e.patients?.last_name} • {new Date(e.created_at).toLocaleDateString()}</div>
            </div>
          ))}
        </div>
      </div>
    </DoctorLayout>
  );
}
