import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { useHospitalPatients, useHospitalId } from "@/hooks/useHospitalData";

interface PatientPickerProps {
  value: string;
  onChange: (patientId: string) => void;
}

export function PatientPicker({ value, onChange }: PatientPickerProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const { data: hospitalId } = useHospitalId();
  const { data: hospitalPatients = [] } = useHospitalPatients(hospitalId);

  const filtered = useMemo(() =>
    hospitalPatients.filter((p: any) =>
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(search.toLowerCase()) ||
      (p.phone && p.phone.includes(search))
    ).slice(0, 30),
    [hospitalPatients, search]
  );

  const selected = hospitalPatients.find((p: any) => p.id === value);

  return (
    <div>
      <Label>Patient</Label>
      <div className="relative">
        <div className="relative mb-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or phone..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="pl-10"
          />
        </div>

        {selected && (
          <div className="p-2 bg-muted/50 rounded-lg mb-2 text-sm">
            <div className="font-medium">{selected.first_name} {selected.last_name}</div>
            <div className="text-xs text-muted-foreground">{selected.phone || "—"}</div>
          </div>
        )}

        {open && (
          <div className="absolute z-50 w-full border rounded-lg bg-card shadow-lg mt-1 max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground text-center">
                {search ? "No patients found" : "Start typing to search"}
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onChange(p.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="w-full text-left p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="font-medium text-sm">{p.first_name} {p.last_name}</div>
                    <div className="text-xs text-muted-foreground">{p.phone || "—"} • {p.gender || "—"}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
