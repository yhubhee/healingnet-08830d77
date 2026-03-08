import { HospitalLayout } from "@/layouts/HospitalLayout";
import { useState } from "react";
import { Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const tabs = ["All Records", "Consultation Notes", "Vitals", "Diagnoses", "Lab Orders", "Procedures"];

const mockEntries = [
  { id: 1, patient: "Amara Obi", title: "Consultation Note - General Checkup", type: "consultation_note", doctor: "Dr. Adebayo", date: "2026-03-08", content: "Patient presents with mild fever and headache..." },
  { id: 2, patient: "Chidi Nwosu", title: "Vitals Recording", type: "vitals", doctor: "Nurse Okafor", date: "2026-03-08", content: "BP: 140/90, Temp: 37.2°C, Pulse: 78 bpm" },
  { id: 3, patient: "Fatima Bello", title: "Diagnosis - Malaria", type: "diagnosis", doctor: "Dr. Mohammed", date: "2026-03-07", content: "Confirmed malaria parasite via RDT. Prescribed ACT." },
  { id: 4, patient: "Emeka Eze", title: "Lab Order - Full Blood Count", type: "lab_order", doctor: "Dr. Nnamdi", date: "2026-03-07", content: "Ordered FBC, ESR, and blood film" },
  { id: 5, patient: "Ngozi Adamu", title: "Procedure - Wound Dressing", type: "procedure", doctor: "Dr. Adebayo", date: "2026-03-06", content: "Wound cleaned and redressed. Healing well." },
];

const typeColors: Record<string, string> = {
  consultation_note: "bg-primary/15 text-primary",
  vitals: "bg-success/15 text-success",
  diagnosis: "bg-warning/15 text-warning",
  lab_order: "bg-info/15 text-info",
  procedure: "bg-purple-500/15 text-purple-400",
};

export default function HospitalEMR() {
  const [activeTab, setActiveTab] = useState("All Records");
  const [search, setSearch] = useState("");

  const filtered = mockEntries.filter((e) => {
    const matchSearch = e.patient.toLowerCase().includes(search.toLowerCase()) || e.title.toLowerCase().includes(search.toLowerCase());
    if (activeTab === "All Records") return matchSearch;
    const tabType = activeTab.toLowerCase().replace(/ /g, "_").replace(/s$/, "");
    return matchSearch && e.type.includes(tabType);
  });

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">EMR Records</h1>
        <p className="text-muted-foreground">Electronic Medical Records — search, view, and add entries</p>
      </div>

      <div className="relative max-w-md mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by patient or title..." className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-1 mb-6">
        {tabs.map((t) => (
          <Button key={t} variant={activeTab === t ? "default" : "secondary"} size="sm" onClick={() => setActiveTab(t)}>
            {t}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((entry) => (
          <div key={entry.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary transition-colors">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-heading font-bold text-sm">{entry.title}</h4>
                <p className="text-xs text-muted-foreground">{entry.patient} • {entry.doctor}</p>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString()}</span>
            </div>
            <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider inline-block mb-2", typeColors[entry.type])}>
              {entry.type.replace(/_/g, " ")}
            </span>
            <p className="text-sm text-muted-foreground">{entry.content}</p>
          </div>
        ))}
      </div>
    </HospitalLayout>
  );
}
