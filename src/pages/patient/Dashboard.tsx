import { PatientLayout } from "@/layouts/PatientLayout";
import { usePatientAppointments, usePatientPrescriptions, usePatientLabResults } from "@/hooks/usePatientData";
import { Calendar, Pill, FlaskConical, FileText } from "lucide-react";
import { Link } from "react-router-dom";

export default function PatientDashboard() {
  const { data: appts = [] } = usePatientAppointments();
  const { data: rx = [] } = usePatientPrescriptions();
  const { data: labs = [] } = usePatientLabResults();

  const upcoming = appts.filter((a: any) => ["pending", "accepted"].includes(a.status));
  const activeRx = rx.filter((r: any) => r.status === "active");

  const stats = [
    { label: "Upcoming Appointments", value: upcoming.length, icon: Calendar, color: "text-info", bg: "bg-info/10" },
    { label: "Active Prescriptions", value: activeRx.length, icon: Pill, color: "text-success", bg: "bg-success/10" },
    { label: "Lab Results", value: labs.length, icon: FlaskConical, color: "text-warning", bg: "bg-warning/10" },
    { label: "Medical Entries", value: 0, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Your Health at a Glance</h1>
        <p className="text-muted-foreground">Quick overview of your health journey</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-5">
            <div className={`w-10 h-10 rounded-lg ${s.bg} ${s.color} flex items-center justify-center mb-3`}><s.icon className="w-5 h-5" /></div>
            <div className="text-2xl font-heading font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold">Upcoming Appointments</h3>
            <Link to="/patient/appointments" className="text-sm text-primary">View all</Link>
          </div>
          {upcoming.length === 0 ? <p className="text-sm text-muted-foreground">No upcoming appointments</p> :
            upcoming.slice(0, 3).map((a: any) => (
              <div key={a.id} className="py-3 border-b border-border last:border-0">
                <div className="font-medium">{a.hospitals?.name}</div>
                <div className="text-sm text-muted-foreground">{a.requested_date} • {a.status}</div>
              </div>
            ))}
        </div>
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold">Active Prescriptions</h3>
            <Link to="/patient/prescriptions" className="text-sm text-primary">View all</Link>
          </div>
          {activeRx.length === 0 ? <p className="text-sm text-muted-foreground">No active prescriptions</p> :
            activeRx.slice(0, 3).map((r: any) => (
              <div key={r.id} className="py-3 border-b border-border last:border-0">
                <div className="font-medium">{r.drug_name}</div>
                <div className="text-sm text-muted-foreground">{r.dosage} • {r.frequency}</div>
              </div>
            ))}
        </div>
      </div>
    </PatientLayout>
  );
}
