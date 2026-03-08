import { HospitalLayout } from "@/layouts/HospitalLayout";
import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePatients } from "@/hooks/useHospitalData";

export default function HospitalPatients() {
  const { data: patients = [], isLoading } = usePatients();
  const [search, setSearch] = useState("");

  const filtered = patients.filter((p: any) =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase())
  );

  const getAge = (dob: string | null) => {
    if (!dob) return "—";
    return String(Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
  };

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
        <Button><UserPlus className="h-4 w-4 mr-2" />Register Patient</Button>
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
                    <td className="p-4 text-sm text-muted-foreground">{new Date(p.updated_at).toLocaleDateString()}</td>
                    <td className="p-4"><span className="text-xs font-semibold px-3 py-1 rounded-full bg-success/15 text-success">active</span></td>
                    <td className="p-4"><Button variant="outline" size="sm">View</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </HospitalLayout>
  );
}
