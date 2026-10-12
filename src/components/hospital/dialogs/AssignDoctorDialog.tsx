import { useState, useMemo } from "react";
import { FormDialog, handleSubmit } from "./FormDialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useHospitalId } from "@/hooks/useHospitalData";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { pick, ALLOWED } from "@/lib/allowed";

export function AssignDoctorDialog() {
  const [f, setF] = useState<any>({ employment_type: "full_time" });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [allDoctors, setAllDoctors] = useState<any[]>([]);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: hospitalId } = useHospitalId();

  // Doctors this hospital can invite (the directory only exposes approved doctors).
  const loadDoctors = async () => {
    const { data } = await supabase
      .from("doctors")
      .select("id, user_id, first_name, last_name, specialty, years_experience, rating, profile_image_url, bio, is_available, verification_status")
      .order("first_name");
    setAllDoctors(data || []);
  };

  const filtered = useMemo(() => {
    if (!search) return allDoctors;
    const q = search.toLowerCase();
    return allDoctors.filter(
      (d) =>
        d.first_name.toLowerCase().includes(q) ||
        d.last_name.toLowerCase().includes(q) ||
        d.specialty?.toLowerCase().includes(q)
    );
  }, [search, allDoctors]);

  const selectedDoctor = f.doctor_id ? allDoctors.find((d) => d.id === f.doctor_id) : null;

  return (
    <FormDialog title="Invite Doctor" triggerLabel="Add Doctor" onOpenChange={(open) => open && loadDoctors()}>
      {(close) => (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!f.doctor_id) {
              toast({ title: "Please select a doctor", variant: "destructive" });
              return;
            }
            // The database notifies the doctor about the invitation by itself.
            await handleSubmit(
              supabase.from("hospital_doctors").insert(
                pick({ ...f, hospital_id: hospitalId, is_active: true, status: "pending" }, ALLOWED.hospitalDoctorInsert) as any
              ),
              { toast, close, qc, invalidate: ["hospital-doctors"] }
            );
          }}
          className="space-y-3"
        >
          <div>
            <Label>Doctor</Label>
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className="w-full justify-between"
                >
                  {selectedDoctor
                    ? `Dr. ${selectedDoctor.first_name} ${selectedDoctor.last_name} — ${selectedDoctor.specialty}`
                    : "Search doctors..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput
                    placeholder="Search by name or specialty..."
                    value={search}
                    onValueChange={setSearch}
                  />
                  <CommandEmpty>No doctors found.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-y-auto">
                    {filtered.map((d) => (
                      <CommandItem
                        key={d.id}
                        value={d.id}
                        onSelect={(currentValue) => {
                          setF({ ...f, doctor_id: currentValue === f.doctor_id ? "" : currentValue });
                          setOpen(false);
                        }}
                      >
                        <Check
                          className={cn("mr-2 h-4 w-4", f.doctor_id === d.id ? "opacity-100" : "opacity-0")}
                        />
                        <div className="flex-1">
                          <div className="font-medium">
                            Dr. {d.first_name} {d.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {d.specialty} • {d.years_experience || 0} yrs • ⭐{d.rating || 0}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Employment</Label>
              <Select value={f.employment_type} onValueChange={(v) => setF({ ...f, employment_type: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">Full-time</SelectItem>
                  <SelectItem value="visiting">Visiting Consultant</SelectItem>
                  <SelectItem value="locum">Locum</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Input value={f.department || ""} onChange={(e) => setF({ ...f, department: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Salary (₦)</Label>
              <Input type="number" value={f.salary || ""} onChange={(e) => setF({ ...f, salary: +e.target.value })} />
            </div>
            <div>
              <Label>Commission %</Label>
              <Input
                type="number"
                value={f.commission_rate || ""}
                onChange={(e) => setF({ ...f, commission_rate: +e.target.value })}
              />
            </div>
          </div>
          <Button type="submit" className="w-full">
            Send Invitation
          </Button>
        </form>
      )}
    </FormDialog>
  );
}
