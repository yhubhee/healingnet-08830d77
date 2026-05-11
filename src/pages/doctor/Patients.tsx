import { DoctorLayout } from "@/layouts/DoctorLayout";
import { mockDoctorPatients } from "@/lib/mockData";
import { useState } from "react";
import { Search, Phone, FileText } from "lucide-react";

export default function DoctorPatients() {
  const [q, setQ] = useState("");
  const list = mockDoctorPatients.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <DoctorLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">My Patients</h1>
        <p className="text-muted-foreground text-sm">{mockDoctorPatients.length} patients under your care</p>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patients..." className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm outline-none" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-muted/30 text-xs text-muted-foreground"><tr><th className="text-left p-3">Patient</th><th className="text-left p-3">Conditions</th><th className="text-left p-3">Last visit</th><th className="text-left p-3">Phone</th><th className="p-3"></th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground flex items-center justify-center font-bold text-sm">{p.name[0]}</div>
                    <div><div className="font-medium text-sm">{p.name}</div><div className="text-xs text-muted-foreground">{p.age}{p.gender}</div></div>
                  </div>
                </td>
                <td className="p-3"><div className="flex flex-wrap gap-1">{p.conditions.map((c) => <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning">{c}</span>)}</div></td>
                <td className="p-3 text-sm text-muted-foreground">{p.lastVisit}</td>
                <td className="p-3 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{p.phone}</span></td>
                <td className="p-3"><button className="text-sm text-primary inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" />Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DoctorLayout>
  );
}
