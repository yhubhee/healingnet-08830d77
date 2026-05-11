import { PatientLayout } from "@/layouts/PatientLayout";
import { Link } from "react-router-dom";
import { Calendar, Pill, FlaskConical, FileText, Activity, ArrowRight, Heart, AlertCircle } from "lucide-react";
import { mockPatientAppointments, mockPatientPrescriptions, mockPatientLabResults, mockPatientProfile } from "@/lib/mockData";

export default function PatientDashboard() {
  const upcoming = mockPatientAppointments.filter((a) => ["pending", "accepted"].includes(a.status));
  const activeRx = mockPatientPrescriptions.filter((r) => r.status === "active");
  const recentLab = mockPatientLabResults[0];
  const next = upcoming[0];

  const stats = [
    { label: "Upcoming Appointments", value: upcoming.length, icon: Calendar, color: "text-info", bg: "bg-info/10" },
    { label: "Active Prescriptions", value: activeRx.length, icon: Pill, color: "text-success", bg: "bg-success/10" },
    { label: "Lab Results", value: mockPatientLabResults.length, icon: FlaskConical, color: "text-warning", bg: "bg-warning/10" },
    { label: "Medical Entries", value: 6, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Welcome back, {mockPatientProfile.firstName}</h1>
        <p className="text-muted-foreground">Here's a quick overview of your health journey</p>
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

      {next && (
        <div className="bg-gradient-to-r from-primary/15 to-info/15 border border-primary/20 rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-primary mb-1">Your next appointment</p>
              <h3 className="text-lg font-heading font-bold">{next.doctor} • {next.specialty}</h3>
              <p className="text-sm text-muted-foreground mt-1">{next.hospital}</p>
              <p className="text-sm mt-2">{new Date(next.date).toDateString()} at {next.time} • {next.type}</p>
            </div>
            <Link to="/patient/appointments" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">View all <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold flex items-center gap-2"><Pill className="w-4 h-4 text-success" />Active Prescriptions</h3>
            <Link to="/patient/prescriptions" className="text-sm text-primary">View all</Link>
          </div>
          <div className="space-y-3">
            {activeRx.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-start justify-between py-2 border-b border-border last:border-0">
                <div>
                  <div className="font-medium">{r.drug}</div>
                  <div className="text-xs text-muted-foreground">{r.frequency} • by {r.prescribedBy}</div>
                </div>
                <div className="text-xs text-muted-foreground">{r.refillsLeft} refills</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="font-heading font-bold mb-3 flex items-center gap-2"><Activity className="w-4 h-4 text-warning" />Recent Lab</h3>
          <div className="font-medium">{recentLab.name}</div>
          <div className="text-xs text-muted-foreground mb-3">{recentLab.date} • {recentLab.hospital}</div>
          {recentLab.abnormal ? (
            <div className="flex items-start gap-2 p-3 bg-destructive/10 text-destructive rounded-lg text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Some values outside normal range — review with your doctor.</span>
            </div>
          ) : (
            <div className="p-3 bg-success/10 text-success rounded-lg text-xs">All values within normal range</div>
          )}
          <Link to="/patient/lab-results" className="text-sm text-primary mt-3 inline-block">Open full results →</Link>
        </div>
      </div>

      <div className="mt-6 bg-card border border-border rounded-xl p-6">
        <h3 className="font-heading font-bold mb-3 flex items-center gap-2"><Heart className="w-4 h-4 text-destructive" />Health Tips for You</h3>
        <ul className="grid md:grid-cols-2 gap-3 text-sm text-muted-foreground">
          <li className="p-3 rounded-lg bg-muted/30">🧂 Reduce salt to under 5g/day to help control your blood pressure.</li>
          <li className="p-3 rounded-lg bg-muted/30">🚶🏾 Aim for 30 minutes of brisk walking, 5 days a week.</li>
          <li className="p-3 rounded-lg bg-muted/30">💧 Drink at least 2 litres of water daily — especially in the harmattan.</li>
          <li className="p-3 rounded-lg bg-muted/30">🛌 Sleep 7–8 hours nightly to support cardiovascular health.</li>
        </ul>
      </div>
    </PatientLayout>
  );
}
