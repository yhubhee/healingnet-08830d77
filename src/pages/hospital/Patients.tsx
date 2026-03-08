import { HospitalLayout } from "@/layouts/HospitalLayout";
import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const mockPatients = [
  { id: 1, name: "Amara Obi", age: 34, gender: "F", phone: "080-1234-5678", blood_group: "O+", last_visit: "2026-03-07", status: "active" },
  { id: 2, name: "Chidi Nwosu", age: 56, gender: "M", phone: "070-2345-6789", blood_group: "A+", last_visit: "2026-03-06", status: "active" },
  { id: 3, name: "Fatima Bello", age: 8, gender: "F", phone: "090-3456-7890", blood_group: "B+", last_visit: "2026-03-08", status: "active" },
  { id: 4, name: "Emeka Eze", age: 42, gender: "M", phone: "081-4567-8901", blood_group: "AB+", last_visit: "2026-03-05", status: "active" },
  { id: 5, name: "Ngozi Adamu", age: 29, gender: "F", phone: "070-5678-9012", blood_group: "O-", last_visit: "2026-03-08", status: "active" },
  { id: 6, name: "Ibrahim Musa", age: 65, gender: "M", phone: "080-6789-0123", blood_group: "A-", last_visit: "2026-03-01", status: "inactive" },
];

export default function HospitalPatients() {
  const [search, setSearch] = useState("");
  const filtered = mockPatients.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

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
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                  <td className="p-4 font-medium">{p.name}</td>
                  <td className="p-4 text-sm">{p.age}y • {p.gender}</td>
                  <td className="p-4 text-sm">{p.phone}</td>
                  <td className="p-4"><span className="bg-primary/15 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">{p.blood_group}</span></td>
                  <td className="p-4 text-sm text-muted-foreground">{new Date(p.last_visit).toLocaleDateString()}</td>
                  <td className="p-4">
                    <span className={cn("text-xs font-semibold px-3 py-1 rounded-full", p.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4"><Button variant="outline" size="sm">View</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </HospitalLayout>
  );
}
