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

export function AssignDoctorDialog() {
  const [f, setF] = useState<any>({ employment_type: "full_time" });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [allDoctors, setAllDoctors] = useState<any[]>([]);
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: hospitalId } = useHospitalId();

  // Fetch all doctors from the system (not just assigned ones)
  const loadDoctors = async () => {
    console.log("Loading doctors...");
    const { data, error } = await supabase
      .from("doctors")
      .select("*")
      .order("first_name");
    console.log("Doctors fetched:", data, "Error:", error);
    setAllDoctors(data || []);
  };

  const filtered = useMemo(() => {
    console.log("All doctors:", allDoctors);
    console.log("Search term:", search);
    if (!search) {
      console.log("No search, returning all:", allDoctors);
      return allDoctors;
    }
    const result = allDoctors.filter(
      (d) =>
        d.first_name.toLowerCase().includes(search.toLowerCase()) ||
        d.last_name.toLowerCase().includes(search.toLowerCase()) ||
        d.specialty?.toLowerCase().includes(search.toLowerCase())
    );
    console.log("Filtered result:", result);
    return result;
  }, [search, allDoctors]);

  const selectedDoctor = f.doctor_id ? allDoctors.find((d) => d.id === f.doctor_id) : null;

  return (
    <FormDialog title="Invite Doctor" triggerLabel="Add Doctor" onOpen={() => loadDoctors()}>
      {(close) => (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!f.doctor_id) {
              toast.error("Please select a doctor");
              return;
            }
            const doctorData = allDoctors.find((d) => d.id === f.doctor_id);
            await handleSubmit(
              supabase.from("hospital_doctors").insert({
                ...f,
                hospital_id: hospitalId,
                is_active: true,
                status: "pending",
              }),
              { toast, close, qc, invalidate: ["hospital-doctors"] }
            );

            if (doctorData?.email) {
              const { data: hospital } = await supabase
                .from("hospitals")
                .select("name")
                .eq("id", hospitalId)
                .single();

              fetch(new URL("/functions/v1/send-doctor-notification", import.meta.env.VITE_SUPABASE_URL).toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  hospitalId,
                  doctorName: `${doctorData.first_name} ${doctorData.last_name}`,
                  action: "invited",
                  adminEmail: "",
                  doctorEmail: doctorData.email,
                }),
              }).catch(() => {});
            }
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
