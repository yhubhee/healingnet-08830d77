import { DoctorLayout } from "@/layouts/DoctorLayout";
import { mockDoctorTodayAppointments } from "@/lib/mockData";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Calendar, Clock, Video, Check, X } from "lucide-react";

const statuses = ["all", "scheduled", "waiting", "in_progress", "completed"] as const;

export default function DoctorAppointments() {
  const [filter, setFilter] = useState<typeof statuses[number]>("all");
  const list = filter === "all" ? mockDoctorTodayAppointments : mockDoctorTodayAppointments.filter((a) => a.status === filter);
  return (
    <DoctorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Appointments</h1>
        <p className="text-muted-foreground text-sm">Manage your daily schedule</p>
      </div>

      <div className="flex gap-1 mb-5 bg-muted/30 p-1 rounded-lg w-fit flex-wrap">
        {statuses.map((s) => <button key={s} onClick={() => setFilter(s)} className={cn("px-3 py-1.5 rounded-md text-sm capitalize", filter === s ? "bg-card shadow" : "text-muted-foreground")}>{s.replace("_", " ")}</button>)}
      </div>

      <div className="space-y-3">
        {list.map((a) => (
          <div key={a.id} className="bg-card border border-border rounded-xl p-5 flex items-start gap-4 flex-wrap">
            <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><Clock className="w-5 h-5" /></div>
            <div className="flex-1 min-w-[200px]">
              <h3 className="font-heading font-bold">{a.patient} <span className="text-xs text-muted-foreground font-normal">• {a.age}{a.gender}</span></h3>
              <p className="text-sm text-muted-foreground">{a.reason}</p>
              <div className="flex gap-3 mt-2 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />Today</span><span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{a.time}</span></div>
            </div>
            <div className="flex gap-2">
              {a.status === "scheduled" && <><button className="px-3 py-1.5 text-sm bg-success text-success-foreground rounded-lg flex items-center gap-1"><Check className="w-3.5 h-3.5" />Accept</button><button className="px-3 py-1.5 text-sm border border-border rounded-lg flex items-center gap-1"><X className="w-3.5 h-3.5" />Decline</button></>}
              {a.status === "waiting" && <button className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg">Start consult</button>}
              {a.status === "in_progress" && <button className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg">Continue</button>}
            </div>
          </div>
        ))}
      </div>
    </DoctorLayout>
  );
}
