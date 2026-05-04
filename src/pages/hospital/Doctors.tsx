import { HospitalLayout } from "@/layouts/HospitalLayout";
import { useState } from "react";
import { Award, Star, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useHospitalDoctors } from "@/hooks/useHospitalData";
import { AssignDoctorDialog } from "@/components/hospital/dialogs/AssignDoctorDialog";

const typeColors: Record<string, string> = {
  full_time: "bg-primary/15 text-primary",
  visiting_consultant: "bg-warning/15 text-warning",
  locum: "bg-purple-500/15 text-purple-400",
};
const typeLabels: Record<string, string> = { full_time: "Full-time", visiting_consultant: "Visiting", locum: "Locum" };
const filters = ["All", "Full-time", "Visiting", "Locum"];
const filterMap: Record<string, string> = { "Full-time": "full_time", Visiting: "visiting_consultant", Locum: "locum" };

export default function HospitalDoctors() {
  const { data: hospitalDoctors = [], isLoading } = useHospitalDoctors();
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = activeFilter === "All"
    ? hospitalDoctors
    : hospitalDoctors.filter((d: any) => d.employment_type === filterMap[activeFilter]);

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Doctor Management</h1>
        <p className="text-muted-foreground">Add, remove, and manage doctors assigned to your hospital</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Button key={f} variant={activeFilter === f ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setActiveFilter(f)}>{f}</Button>
          ))}
        </div>
        <AssignDoctorDialog />

      </div>

      {isLoading ? (
        <div className="text-center p-8 text-muted-foreground">Loading doctors...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.length === 0 ? (
            <div className="col-span-full text-center p-8 text-muted-foreground">No doctors found</div>
          ) : filtered.map((d: any) => (
            <div key={d.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary transition-colors">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full gradient-info flex items-center justify-center text-sm font-bold text-foreground">
                  {d.doctors?.first_name?.[0]}{d.doctors?.last_name?.[0]}
                </div>
                <div className="flex-1">
                  <h3 className="font-heading font-bold">Dr. {d.doctors?.first_name} {d.doctors?.last_name}</h3>
                  <p className="text-sm text-muted-foreground">{d.doctors?.specialty || "—"}</p>
                </div>
                <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider", typeColors[d.employment_type] || "bg-muted text-muted-foreground")}>
                  {typeLabels[d.employment_type] || d.employment_type}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 mb-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Award className="h-3.5 w-3.5" />{d.doctors?.years_experience || 0} yrs</span>
                <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{d.doctors?.rating || 0}</span>
                <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{d.department || "—"}</span>
                <span className={cn("w-2.5 h-2.5 rounded-full ml-auto", d.doctors?.is_available ? "bg-success shadow-[0_0_6px] shadow-success" : "bg-muted-foreground")} />
              </div>
              <div className="flex gap-2 pt-4 border-t border-border">
                <Button variant="outline" size="sm" className="flex-1">Edit</Button>
                <Button variant="ghost" size="sm" className="flex-1 text-destructive hover:text-destructive">Remove</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </HospitalLayout>
  );
}
