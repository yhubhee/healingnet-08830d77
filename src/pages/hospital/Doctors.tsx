import { HospitalLayout } from "@/layouts/HospitalLayout";
import { useState } from "react";
import { Award, Star, Briefcase, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const mockDoctors = [
  { id: 1, first_name: "Chidi", last_name: "Adebayo", specialty: "General Practice", employment_type: "full_time", department: "General", years_experience: 12, rating: 4.8, is_available: true },
  { id: 2, first_name: "Ngozi", last_name: "Okonkwo", specialty: "Cardiologist", employment_type: "full_time", department: "Cardiology", years_experience: 15, rating: 4.9, is_available: true },
  { id: 3, first_name: "Emeka", last_name: "Nnamdi", specialty: "Orthopedics", employment_type: "visiting_consultant", department: "Orthopedics", years_experience: 20, rating: 4.7, is_available: false },
  { id: 4, first_name: "Aisha", last_name: "Mohammed", specialty: "Pediatrics", employment_type: "full_time", department: "Pediatrics", years_experience: 8, rating: 4.6, is_available: true },
  { id: 5, first_name: "Bayo", last_name: "Ogundimu", specialty: "Dermatology", employment_type: "locum", department: "Dermatology", years_experience: 6, rating: 4.5, is_available: true },
];

const typeColors: Record<string, string> = {
  full_time: "bg-primary/15 text-primary",
  visiting_consultant: "bg-warning/15 text-warning",
  locum: "bg-purple-500/15 text-purple-400",
};
const typeLabels: Record<string, string> = { full_time: "Full-time", visiting_consultant: "Visiting", locum: "Locum" };

const filters = ["All", "Full-time", "Visiting", "Locum"];
const filterMap: Record<string, string> = { "Full-time": "full_time", Visiting: "visiting_consultant", Locum: "locum" };

export default function HospitalDoctors() {
  const [activeFilter, setActiveFilter] = useState("All");

  const filtered = activeFilter === "All"
    ? mockDoctors
    : mockDoctors.filter((d) => d.employment_type === filterMap[activeFilter]);

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Doctor Management</h1>
        <p className="text-muted-foreground">Add, remove, and manage doctors assigned to your hospital</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Button key={f} variant={activeFilter === f ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setActiveFilter(f)}>
              {f}
            </Button>
          ))}
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" />Add Doctor</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Doctor to Hospital</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-4">
              <div><Label>Doctor ID</Label><Input type="number" placeholder="Enter doctor ID" /></div>
              <div><Label>Employment Type</Label>
                <Select><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent><SelectItem value="full_time">Full-time</SelectItem><SelectItem value="visiting_consultant">Visiting Consultant</SelectItem><SelectItem value="locum">Locum</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Department</Label><Input placeholder="e.g., Cardiology" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Contract Start</Label><Input type="date" /></div>
                <div><Label>Contract End</Label><Input type="date" /></div>
              </div>
              <div><Label>Salary (₦)</Label><Input type="number" placeholder="Monthly salary" /></div>
              <Button className="w-full">Add Doctor</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((d) => (
          <div key={d.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary transition-colors">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full gradient-info flex items-center justify-center text-sm font-bold text-foreground">
                {d.first_name[0]}{d.last_name[0]}
              </div>
              <div className="flex-1">
                <h3 className="font-heading font-bold">Dr. {d.first_name} {d.last_name}</h3>
                <p className="text-sm text-muted-foreground">{d.specialty}</p>
              </div>
              <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider", typeColors[d.employment_type])}>
                {typeLabels[d.employment_type]}
              </span>
            </div>
            <div className="flex flex-wrap gap-3 mb-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Award className="h-3.5 w-3.5" />{d.years_experience} yrs</span>
              <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{d.rating}</span>
              <span className="flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" />{d.department}</span>
              <span className={cn("w-2.5 h-2.5 rounded-full ml-auto", d.is_available ? "bg-success shadow-[0_0_6px] shadow-success" : "bg-muted-foreground")} />
            </div>
            <div className="flex gap-2 pt-4 border-t border-border">
              <Button variant="outline" size="sm" className="flex-1">Edit</Button>
              <Button variant="ghost" size="sm" className="flex-1 text-destructive hover:text-destructive">Remove</Button>
            </div>
          </div>
        ))}
      </div>
    </HospitalLayout>
  );
}
