import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Calendar, Clock, Loader2 } from "lucide-react";

const statuses = ["all", "pending", "accepted", "completed", "cancelled"] as const;

export default function DoctorAppointments() {
  const [filter, setFilter] = useState<typeof statuses[number]>("all");
  const { data, isLoading } = useQuery({
    queryKey: ["doctor", "appointments"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data: doc } = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      if (!doc) return [];
      const { data } = await supabase.from("patient_appointments").select("*, patients(first_name,last_name,gender,date_of_birth)").eq("doctor_id", doc.id).order("requested_date", { ascending: false });
      return data || [];
    },
  });
  const list = (data || []).filter((a: any) => filter === "all" || a.status === filter);

  return (
    <DoctorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Appointments</h1>
        <p className="text-muted-foreground text-sm">Your bookings from patients</p>
      </div>

      <div className="flex gap-1 mb-5 bg-muted/30 p-1 rounded-lg w-fit flex-wrap">
        {statuses.map((s) => <button key={s} onClick={() => setFilter(s)} className={cn("px-3 py-1.5 rounded-md text-sm capitalize", filter === s ? "bg-card shadow" : "text-muted-foreground")}>{s}</button>)}
      </div>

      {isLoading ? <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div> :
        list.length === 0 ? <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm"><Calendar className="w-10 h-10 mx-auto mb-2" />No {filter === "all" ? "" : filter} appointments.</div> :
        <div className="space-y-3">
          {list.map((a: any) => (
            <div key={a.id} className="bg-card border border-border rounded-xl p-5 flex items-start gap-4 flex-wrap">
              <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Clock className="w-5 h-5" /></div>
              <div className="flex-1 min-w-[200px]">
                <h3 className="font-heading font-bold">{a.patients ? `${a.patients.first_name} ${a.patients.last_name}` : "Patient"}</h3>
                {a.reason && <p className="text-sm text-muted-foreground">{a.reason}</p>}
                <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(a.requested_date).toDateString()}</span>
                  {a.requested_time && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{a.requested_time}</span>}
                </div>
              </div>
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", a.status === "pending" ? "bg-warning/15 text-warning" : a.status === "accepted" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{a.status}</span>
            </div>
          ))}
        </div>}
    </DoctorLayout>
  );
}
