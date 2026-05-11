import { PatientLayout } from "@/layouts/PatientLayout";
import { useState } from "react";
import { mockPatientAppointments } from "@/lib/mockData";
import { Calendar, Clock, MapPin, Video, User, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = ["upcoming", "past", "cancelled"] as const;

export default function PatientAppointments() {
  const [tab, setTab] = useState<typeof tabs[number]>("upcoming");
  const filtered = mockPatientAppointments.filter((a) => {
    if (tab === "upcoming") return ["pending", "accepted"].includes(a.status);
    if (tab === "past") return a.status === "completed";
    return a.status === "cancelled";
  });

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      pending: "bg-warning/15 text-warning",
      accepted: "bg-success/15 text-success",
      completed: "bg-muted text-muted-foreground",
      cancelled: "bg-destructive/15 text-destructive",
    };
    return map[s] || "bg-muted";
  };

  return (
    <PatientLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Appointments</h1>
          <p className="text-muted-foreground text-sm">Manage your bookings and consultations</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90"><Plus className="w-4 h-4" />Book new</button>
      </div>

      <div className="flex gap-1 mb-5 bg-muted/30 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-1.5 rounded-md text-sm capitalize", tab === t ? "bg-card text-foreground shadow" : "text-muted-foreground")}>{t}</button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && <p className="text-muted-foreground text-sm py-12 text-center">No {tab} appointments.</p>}
        {filtered.map((a) => (
          <div key={a.id} className="bg-card border border-border rounded-xl p-5 flex flex-wrap items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {a.type === "Telemedicine" ? <Video className="w-5 h-5" /> : <User className="w-5 h-5" />}
            </div>
            <div className="flex-1 min-w-[220px]">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-heading font-bold">{a.doctor}</h3>
                <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", statusBadge(a.status))}>{a.status}</span>
              </div>
              <p className="text-sm text-muted-foreground">{a.specialty}</p>
              <p className="text-sm mt-1">{a.reason}</p>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{a.hospital}</span>
                <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(a.date).toDateString()}</span>
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{a.time}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {tab === "upcoming" && a.type === "Telemedicine" && <button className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg">Join</button>}
              {tab === "upcoming" && <button className="px-3 py-1.5 text-sm border border-border rounded-lg">Reschedule</button>}
              {tab === "past" && <button className="px-3 py-1.5 text-sm border border-border rounded-lg">View notes</button>}
            </div>
          </div>
        ))}
      </div>
    </PatientLayout>
  );
}
