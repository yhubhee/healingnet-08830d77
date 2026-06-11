import { PatientLayout } from "@/layouts/PatientLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Calendar, Clock, MapPin, User, Plus, Stethoscope, Loader2, Video } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = ["upcoming", "past", "cancelled"] as const;

export default function PatientAppointments() {
  const [tab, setTab] = useState<typeof tabs[number]>("upcoming");

  const { data, isLoading } = useQuery({
    queryKey: ["patient", "appointments"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: p } = await supabase.from("patients").select("id").eq("user_id", user.id).maybeSingle();
      if (!p) return [];
      const { data: appts } = await supabase
        .from("patient_appointments")
        .select("*, doctors(first_name,last_name,specialty), hospitals(name), is_telemedicine, meeting_link, daily_room_name")
        .eq("patient_id", p.id)
        .order("requested_date", { ascending: false });
      return appts || [];
    },
  });

  const filtered = (data || []).filter((a: any) => {
    if (tab === "upcoming") return ["pending", "accepted", "confirmed"].includes(a.status);
    if (tab === "past") return ["completed", "done"].includes(a.status);
    return a.status === "cancelled";
  });

  const statusBadge = (s: string) => ({
    pending: "bg-warning/15 text-warning",
    accepted: "bg-success/15 text-success",
    confirmed: "bg-success/15 text-success",
    completed: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/15 text-destructive",
  } as Record<string, string>)[s] || "bg-muted";

  return (
    <PatientLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Appointments</h1>
          <p className="text-muted-foreground text-sm">Manage your bookings and consultations</p>
        </div>
        <div className="flex gap-2">
          <Link to="/patient/triage" className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium"><Stethoscope className="w-4 h-4" />Start AI triage</Link>
        </div>
      </div>

      <div className="flex gap-1 mb-5 bg-muted/30 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-1.5 rounded-md text-sm capitalize", tab === t ? "bg-card text-foreground shadow" : "text-muted-foreground")}>{t}</button>
        ))}
      </div>

      {isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        <div className="space-y-3">
          {filtered.length === 0 && (
            <div className="bg-card border border-border rounded-xl p-12 text-center">
              <Calendar className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground text-sm mb-4">No {tab} appointments yet.</p>
              {tab === "upcoming" && <Link to="/patient/triage" className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm"><Plus className="w-4 h-4" />Book your first appointment</Link>}
            </div>
          )}
          {filtered.map((a: any) => {
            const doc = a.doctors ? `Dr. ${a.doctors.first_name} ${a.doctors.last_name}` : "Awaiting assignment";
            const isTelemedicine = a.is_telemedicine === true;
            return (
              <div key={a.id} className="bg-card border border-border rounded-xl p-5 flex flex-wrap items-start gap-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", isTelemedicine ? "bg-primary/10 text-primary" : "bg-primary/10 text-primary")}>
                  {isTelemedicine ? <Video className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-bold">{doc}</h3>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", statusBadge(a.status))}>{a.status}</span>
                    {isTelemedicine && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/15 text-primary">Online Consultation</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{a.doctors?.specialty || "—"}</p>
                  {a.reason && <p className="text-sm mt-1">{a.reason}</p>}
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      {isTelemedicine ? (
                        <>
                          <Video className="w-3.5 h-3.5" />Online
                        </>
                      ) : (
                        <>
                          <MapPin className="w-3.5 h-3.5" />{a.hospitals?.name || "—"}
                        </>
                      )}
                    </span>
                    <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(a.requested_date).toDateString()}</span>
                    {a.requested_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{a.requested_time}</span>}
                  </div>
                  {isTelemedicine && a.meeting_link && (
                    <div className="mt-3">
                      <a
                        href={a.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <Video className="w-3 h-3" />
                        Join Consultation
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>}
    </PatientLayout>
  );
}
