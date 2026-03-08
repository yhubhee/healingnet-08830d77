import { HospitalLayout } from "@/layouts/HospitalLayout";
import { useState } from "react";
import { Bed, Building, AlertTriangle, CheckCircle, Plus, Users, TrendingUp, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHospitalWards, useHospitalBeds, useRealtimeBeds, usePatients } from "@/hooks/useHospitalData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const wardTypes = ["general", "private", "icu", "maternity", "pediatric", "surgical"];
const bedTypes = ["standard", "electric", "icu", "crib", "bariatric"];
const bedStatuses = ["available", "occupied", "reserved", "maintenance"];

const statusColors: Record<string, string> = {
  available: "bg-success/15 text-success",
  occupied: "bg-destructive/15 text-destructive",
  reserved: "bg-warning/15 text-warning",
  maintenance: "bg-muted text-muted-foreground",
};

const wardTypeColors: Record<string, string> = {
  general: "bg-primary/15 text-primary",
  private: "bg-warning/15 text-warning",
  icu: "bg-destructive/15 text-destructive",
  maternity: "bg-pink-500/15 text-pink-400",
  pediatric: "bg-info/15 text-info",
  surgical: "bg-purple-500/15 text-purple-400",
};

export default function HospitalBedManagement() {
  useRealtimeBeds();
  const { data: wards = [], isLoading: wardsLoading } = useHospitalWards();
  const { data: beds = [], isLoading: bedsLoading } = useHospitalBeds();
  const { data: patients = [] } = usePatients();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("Overview");
  const [wardDialogOpen, setWardDialogOpen] = useState(false);
  const [bedDialogOpen, setBedDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedBed, setSelectedBed] = useState<any>(null);

  // Ward form
  const [wardForm, setWardForm] = useState({ ward_name: "", ward_type: "general", total_beds: 0, floor: "" });
  // Bed form
  const [bedForm, setBedForm] = useState({ bed_number: "", ward_id: "", bed_type: "standard", daily_rate: 0 });
  // Assign form
  const [assignPatientId, setAssignPatientId] = useState("");

  const totalBeds = beds.length;
  const occupiedBeds = beds.filter((b: any) => b.status === "occupied").length;
  const availableBeds = beds.filter((b: any) => b.status === "available").length;
  const maintenanceBeds = beds.filter((b: any) => b.status === "maintenance").length;
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
  const dailyRevenue = beds.filter((b: any) => b.status === "occupied").reduce((sum: number, b: any) => sum + (Number(b.daily_rate) || 0), 0);

  const stats = [
    { label: "Total Beds", value: totalBeds, icon: Bed, gradient: "gradient-primary" },
    { label: "Occupied", value: `${occupiedBeds} (${occupancyRate}%)`, icon: Users, gradient: "gradient-danger" },
    { label: "Available", value: availableBeds, icon: CheckCircle, gradient: "gradient-success" },
    { label: "Daily Revenue", value: `₦${dailyRevenue.toLocaleString()}`, icon: CreditCard, gradient: "gradient-info" },
  ];

  const tabs = ["Overview", "Wards", "All Beds", "Occupied", "Available"];

  async function handleAddWard() {
    const hospitalId = (await supabase.rpc("get_user_hospital_id", { _user_id: (await supabase.auth.getUser()).data.user?.id! })).data;
    if (!hospitalId) { toast.error("Not associated with a hospital"); return; }
    const { error } = await supabase.from("hospital_wards" as any).insert({ ...wardForm, hospital_id: hospitalId } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Ward added");
    setWardDialogOpen(false);
    setWardForm({ ward_name: "", ward_type: "general", total_beds: 0, floor: "" });
    queryClient.invalidateQueries({ queryKey: ["hospital-wards"] });
  }

  async function handleAddBed() {
    const hospitalId = (await supabase.rpc("get_user_hospital_id", { _user_id: (await supabase.auth.getUser()).data.user?.id! })).data;
    if (!hospitalId) { toast.error("Not associated with a hospital"); return; }
    const { error } = await supabase.from("hospital_beds" as any).insert({ ...bedForm, hospital_id: hospitalId, status: "available" } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Bed added");
    setBedDialogOpen(false);
    setBedForm({ bed_number: "", ward_id: "", bed_type: "standard", daily_rate: 0 });
    queryClient.invalidateQueries({ queryKey: ["hospital-beds"] });
  }

  async function handleAssignPatient() {
    if (!selectedBed || !assignPatientId) return;
    const { error } = await supabase.from("hospital_beds" as any).update({ patient_id: assignPatientId, status: "occupied", assigned_at: new Date().toISOString() } as any).eq("id", selectedBed.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Patient assigned to bed");
    setAssignDialogOpen(false);
    setSelectedBed(null);
    setAssignPatientId("");
    queryClient.invalidateQueries({ queryKey: ["hospital-beds"] });
  }

  async function handleDischargeBed(bedId: string) {
    const { error } = await supabase.from("hospital_beds" as any).update({ patient_id: null, status: "available", assigned_at: null, discharged_at: new Date().toISOString() } as any).eq("id", bedId);
    if (error) { toast.error(error.message); return; }
    toast.success("Patient discharged from bed");
    queryClient.invalidateQueries({ queryKey: ["hospital-beds"] });
  }

  const filteredBeds = activeTab === "Overview" || activeTab === "Wards" || activeTab === "All Beds"
    ? beds
    : beds.filter((b: any) => b.status === activeTab.toLowerCase());

  const isLoading = wardsLoading || bedsLoading;

  return (
    <HospitalLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold mb-1">Bed Management</h1>
          <p className="text-muted-foreground">Ward management, bed allocation, occupancy tracking, and billing rates</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={wardDialogOpen} onOpenChange={setWardDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Building className="h-4 w-4 mr-2" />Add Ward</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Ward</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div><Label>Ward Name</Label><Input value={wardForm.ward_name} onChange={(e) => setWardForm({ ...wardForm, ward_name: e.target.value })} placeholder="e.g., Male Medical Ward" /></div>
                <div><Label>Ward Type</Label>
                  <Select value={wardForm.ward_type} onValueChange={(v) => setWardForm({ ...wardForm, ward_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{wardTypes.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Floor</Label><Input value={wardForm.floor} onChange={(e) => setWardForm({ ...wardForm, floor: e.target.value })} placeholder="e.g., 2nd Floor" /></div>
                <Button className="w-full" onClick={handleAddWard}>Add Ward</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={bedDialogOpen} onOpenChange={setBedDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Bed</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Bed</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-4">
                <div><Label>Bed Number</Label><Input value={bedForm.bed_number} onChange={(e) => setBedForm({ ...bedForm, bed_number: e.target.value })} placeholder="e.g., A-101" /></div>
                <div><Label>Ward</Label>
                  <Select value={bedForm.ward_id} onValueChange={(v) => setBedForm({ ...bedForm, ward_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select ward" /></SelectTrigger>
                    <SelectContent>{wards.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.ward_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Bed Type</Label>
                  <Select value={bedForm.bed_type} onValueChange={(v) => setBedForm({ ...bedForm, bed_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{bedTypes.map((t) => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Daily Rate (₦)</Label><Input type="number" value={bedForm.daily_rate} onChange={(e) => setBedForm({ ...bedForm, daily_rate: Number(e.target.value) })} /></div>
                <Button className="w-full" onClick={handleAddBed}>Add Bed</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((s) => (
          <div key={s.label} className={cn("relative rounded-xl p-5 text-foreground overflow-hidden", s.gradient)}>
            <s.icon className="stat-card-icon" />
            <p className="text-sm opacity-80">{s.label}</p>
            <h3 className="text-2xl font-heading font-bold">{s.value}</h3>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 mb-6">
        {tabs.map((t) => (
          <Button key={t} variant={activeTab === t ? "default" : "secondary"} size="sm" onClick={() => setActiveTab(t)}>{t}</Button>
        ))}
      </div>

      {isLoading && <div className="text-center p-8 text-muted-foreground">Loading bed data...</div>}

      {/* Wards view */}
      {activeTab === "Wards" && !isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {wards.length === 0 ? (
            <div className="col-span-full text-center p-8 text-muted-foreground">No wards configured yet. Add a ward to get started.</div>
          ) : wards.map((ward: any) => {
            const wardBeds = beds.filter((b: any) => b.ward_id === ward.id);
            const wardOccupied = wardBeds.filter((b: any) => b.status === "occupied").length;
            const wardAvailable = wardBeds.filter((b: any) => b.status === "available").length;
            const wardOccupancy = wardBeds.length > 0 ? Math.round((wardOccupied / wardBeds.length) * 100) : 0;
            return (
              <div key={ward.id} className="bg-card border border-border rounded-xl p-5 hover:border-primary transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-heading font-bold">{ward.ward_name}</h3>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider", wardTypeColors[ward.ward_type] || "bg-muted text-muted-foreground")}>{ward.ward_type}</span>
                </div>
                {ward.floor && <p className="text-xs text-muted-foreground mb-3">Floor: {ward.floor}</p>}
                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                  <div className="bg-background rounded-lg p-2">
                    <p className="text-lg font-heading font-bold">{wardBeds.length}</p>
                    <p className="text-[10px] text-muted-foreground">Total</p>
                  </div>
                  <div className="bg-background rounded-lg p-2">
                    <p className="text-lg font-heading font-bold text-success">{wardAvailable}</p>
                    <p className="text-[10px] text-muted-foreground">Free</p>
                  </div>
                  <div className="bg-background rounded-lg p-2">
                    <p className="text-lg font-heading font-bold text-destructive">{wardOccupied}</p>
                    <p className="text-[10px] text-muted-foreground">Used</p>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${wardOccupancy}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{wardOccupancy}% occupancy</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Overview - visual bed map */}
      {activeTab === "Overview" && !isLoading && (
        <div className="space-y-6">
          {wards.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">No wards or beds configured. Start by adding a ward.</div>
          ) : wards.map((ward: any) => {
            const wardBeds = beds.filter((b: any) => b.ward_id === ward.id);
            return (
              <div key={ward.id} className="bg-card border border-border rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <h3 className="text-lg font-heading font-bold">{ward.ward_name}</h3>
                  <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider", wardTypeColors[ward.ward_type] || "bg-muted text-muted-foreground")}>{ward.ward_type}</span>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {wardBeds.map((bed: any) => (
                    <button
                      key={bed.id}
                      onClick={() => {
                        if (bed.status === "available") {
                          setSelectedBed(bed);
                          setAssignDialogOpen(true);
                        }
                      }}
                      className={cn(
                        "rounded-lg p-2 text-center border transition-all hover:scale-105",
                        bed.status === "available" ? "border-success/50 bg-success/10 cursor-pointer hover:bg-success/20" :
                        bed.status === "occupied" ? "border-destructive/50 bg-destructive/10 cursor-default" :
                        bed.status === "reserved" ? "border-warning/50 bg-warning/10 cursor-default" :
                        "border-muted bg-muted/30 cursor-default"
                      )}
                    >
                      <Bed className={cn("h-4 w-4 mx-auto mb-1",
                        bed.status === "available" ? "text-success" :
                        bed.status === "occupied" ? "text-destructive" :
                        bed.status === "reserved" ? "text-warning" : "text-muted-foreground"
                      )} />
                      <p className="text-[10px] font-bold">{bed.bed_number}</p>
                      {bed.patients && <p className="text-[8px] text-muted-foreground truncate">{bed.patients.first_name}</p>}
                    </button>
                  ))}
                  {wardBeds.length === 0 && <p className="col-span-full text-xs text-muted-foreground">No beds in this ward</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Beds table */}
      {(activeTab === "All Beds" || activeTab === "Occupied" || activeTab === "Available") && !isLoading && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {["Bed #", "Ward", "Type", "Daily Rate", "Patient", "Assigned", "Status", "Actions"].map((h) => (
                    <th key={h} className="text-left p-4 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredBeds.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No beds found</td></tr>
                ) : filteredBeds.map((bed: any) => {
                  const ward = wards.find((w: any) => w.id === bed.ward_id);
                  return (
                    <tr key={bed.id} className="border-b border-border/50 hover:bg-sidebar-accent transition-colors">
                      <td className="p-4 font-heading font-bold">{bed.bed_number}</td>
                      <td className="p-4 text-sm">{ward?.ward_name || "—"}</td>
                      <td className="p-4 text-sm capitalize">{bed.bed_type}</td>
                      <td className="p-4 text-sm">₦{Number(bed.daily_rate || 0).toLocaleString()}</td>
                      <td className="p-4 text-sm">{bed.patients ? `${bed.patients.first_name} ${bed.patients.last_name}` : "—"}</td>
                      <td className="p-4 text-sm text-muted-foreground">{bed.assigned_at ? new Date(bed.assigned_at).toLocaleDateString() : "—"}</td>
                      <td className="p-4"><span className={cn("text-xs font-semibold px-3 py-1 rounded-full", statusColors[bed.status])}>{bed.status}</span></td>
                      <td className="p-4">
                        {bed.status === "available" ? (
                          <Button variant="outline" size="sm" onClick={() => { setSelectedBed(bed); setAssignDialogOpen(true); }}>Assign</Button>
                        ) : bed.status === "occupied" ? (
                          <Button variant="outline" size="sm" className="text-destructive" onClick={() => handleDischargeBed(bed.id)}>Discharge</Button>
                        ) : (
                          <Button variant="outline" size="sm" disabled>—</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Assign Patient Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Assign Patient to Bed {selectedBed?.bed_number}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Select Patient</Label>
              <Select value={assignPatientId} onValueChange={setAssignPatientId}>
                <SelectTrigger><SelectValue placeholder="Search patient..." /></SelectTrigger>
                <SelectContent>
                  {(patients || []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleAssignPatient}>Assign Patient</Button>
          </div>
        </DialogContent>
      </Dialog>
    </HospitalLayout>
  );
}
