import { useState, useMemo } from "react";
import { Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Patient { id: string; first_name: string; last_name: string }

export function PatientPicker({ patients, value, onChange }: { patients: Patient[]; value: string | null; onChange: (id: string) => void }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() =>
    patients.filter((p) => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q.toLowerCase())).slice(0, 30),
    [patients, q]);

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="relative border-b border-border">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search patients..." className="w-full pl-9 pr-3 py-2 bg-transparent text-sm outline-none" />
      </div>
      <div className="max-h-52 overflow-auto">
        {filtered.length === 0 ? <div className="text-xs text-muted-foreground p-3 text-center">No patients found</div> :
          filtered.map((p) => (
            <button key={p.id} type="button" onClick={() => onChange(p.id)}
              className={cn("w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-muted/30", value === p.id && "bg-primary/10 text-primary")}>
              <span>{p.first_name} {p.last_name}</span>
              {value === p.id && <Check className="w-4 h-4" />}
            </button>
          ))}
      </div>
    </div>
  );
}
