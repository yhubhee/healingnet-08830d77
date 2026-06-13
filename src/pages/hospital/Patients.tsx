import { HospitalLayout } from "@/layouts/HospitalLayout";
import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePatients, useHospitalId, useHospitalPatients } from "@/hooks/useHospitalData";
import { AddPatientDialog } from "@/components/hospital/dialogs/AddPatientDialog";
import { PatientDetailDrawer } from "@/components/hospital/PatientDetailDrawer";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "outpatient", label: "Outpatient", color: "bg-success/15 text-success" },
  { value: "inpatient", label: "Inpatient", color: "bg-primary/15 text-primary" },
  { value: "admitted", label: "Admitted", color: "bg-primary/15 text-primary" },
  { value: "under_observation", label: "Under Observation", color: "bg-warning/15 text-warning" },
  { value: "critical", label: "Critical", color: "bg-destructive/15 text-destructive" },
  { value: "discharged", label: "Discharged", color: "bg-muted text-muted-foreground" },
  { value: "transferred", label: "Transferred", color: "bg-muted text-muted-foreground" },
  { value: "deceased", label: "Deceased", color: "bg-destructive/15 text-destructive" },
];

const statusColor = (s: string) => STATUS_OPTIONS.find((o) => o.value === s)?.color || "bg-muted text-muted-foreground";

export default function HospitalPatients() {
  const { data: patients = [], isLoading } = usePatients();
  const { data: hospitalId } = useHospitalId();
  const { data: hospitalPatients = [] } = useHospitalPatients(hospitalId);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<any>(null);
  const [filterType, setFilterType] = useState<"all" | "hospital">("all");
  const qc = useQueryClient();

  const hospitalPatientIds = new Set(hospitalPatients.map((p: any) => p.id));

  const filtered = patients.filter((p: any) => {
    const matchesSearch = `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase());
    const isHospitalPatient = hospitalPatientIds.has(p.id);
    return filterType === "all" ? matchesSearch : (matchesSearch && isHospitalPatient);
  });

  const getAge = (dob: string | null) => {
    if (!dob) return "—";
    return String(Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5)));
  };

  const getLastVisit = (patientId: string) => {
    const visit = hospitalPatients.find((p: any) => p.id === patientId);
    return visit ? new Date(visit.updated_at).toLocaleDateString() : "Not visited";
  };

  async function updateStatus(id: string, status: string) {
    const { error } = await supabase.from("patients").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status updated");
    qc.invalidateQueries({ queryKey: ["patients"] });
  }

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Patients</h1>
        <p className="text-muted-foreground">View and manage hospital patient records</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search patients..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Patients</SelectItem>
            <SelectItem value="hospital">Hospital Patients Only</SelectItem>
          </SelectContent>
        </Select>
        <AddPatientDialog />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading patients...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Name", "Age/Gender", "Phone", "Blood Group", "Last Visit", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No patients found</td></tr>
                ) : filtered.map((p: any) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                    <td className="p-4 font-medium">{p.first_name} {p.last_name}</td>
                    <td className="p-4 text-sm">{getAge(p.date_of_birth)}y • {p.gender || "—"}</td>
                    <td className="p-4 text-sm">{p.phone || "—"}</td>
                    <td className="p-4">{p.blood_group ? <span className="bg-primary/15 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">{p.blood_group}</span> : "—"}</td>
                    <td className="p-4 text-sm text-muted-foreground">{getLastVisit(p.id)}</td>
                    <td className="p-4">
                      <Select value={p.status || "outpatient"} onValueChange={(v) => updateStatus(p.id, v)}>
                        <SelectTrigger className={cn("h-8 w-[170px] text-xs font-semibold rounded-full border-0", statusColor(p.status || "outpatient"))}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-4">
                      <Button variant="outline" size="sm" onClick={() => setActive(p)}>View</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PatientDetailDrawer patient={active} onClose={() => setActive(null)} />
    </HospitalLayout>
  );
}
