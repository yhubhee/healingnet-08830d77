import { DoctorLayout } from "@/layouts/DoctorLayout";
import { mockDoctorTodayAppointments, mockDoctorConsultRequests, mockDoctorPatients } from "@/lib/mockData";
import { Calendar, Users, MessageSquare, Activity, TrendingUp, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function DoctorDashboard() {
  const cards = [
    { label: "Today's Appointments", value: mockDoctorTodayAppointments.length, icon: Calendar, color: "bg-info/10 text-info" },
    { label: "Pending Consults", value: mockDoctorConsultRequests.length, icon: MessageSquare, color: "bg-warning/10 text-warning" },
    { label: "Active Patients", value: mockDoctorPatients.length, icon: Users, color: "bg-success/10 text-success" },
    { label: "Avg. Rating", value: "4.8 ★", icon: TrendingUp, color: "bg-primary/10 text-primary" },
  ];
  return (
    <DoctorLayout>
      <h1 className="text-2xl font-heading font-bold mb-1">Welcome, Dr. Adaobi 👋</h1>
      <p className="text-muted-foreground mb-6">Cardiologist • Lagos University Teaching Hospital</p>

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
          <div className="space-y-2">
            {mockDoctorTodayAppointments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/20">
                <div className="w-12 text-center">
                  <div className="text-sm font-bold">{a.time}</div>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{a.patient} <span className="text-xs text-muted-foreground font-normal">• {a.age}{a.gender}</span></div>
                  <div className="text-xs text-muted-foreground">{a.reason}</div>
                </div>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium",
                  a.status === "in_progress" ? "bg-success/15 text-success" :
                  a.status === "waiting" ? "bg-warning/15 text-warning" :
                  "bg-muted text-muted-foreground")}>{a.status.replace("_", " ")}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-bold flex items-center gap-2"><MessageSquare className="w-4 h-4 text-warning" />Consult Requests</h3>
            <Link to="/doctor/consultations" className="text-sm text-primary">View all</Link>
          </div>
          <div className="space-y-3">
            {mockDoctorConsultRequests.slice(0, 3).map((c) => (
              <div key={c.id} className="border-b border-border last:border-0 pb-3 last:pb-0">
                <div className="font-medium text-sm">{c.patient}</div>
                <div className="text-xs text-muted-foreground">{c.hospital} • ₦{c.fee.toLocaleString()}</div>
                <div className="text-xs mt-1 text-muted-foreground italic">"{c.reason}"</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}
