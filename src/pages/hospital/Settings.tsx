import { HospitalLayout } from "@/layouts/HospitalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useHospitalInfo, useHospitalSubscription, useHospitalStaff } from "@/hooks/useHospitalData";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { InviteStaffDialog } from "@/components/hospital/dialogs/InviteStaffDialog";
import { Check, Lock, Mail } from "lucide-react";

const NOTIF_KEYS = [
  { key: "checkins", label: "Patient check-ins" },
  { key: "lab_ready", label: "Lab results ready" },
  { key: "low_stock", label: "Low stock alerts" },
  { key: "payment", label: "Payment received" },
  { key: "emergency", label: "Emergency alerts" },
  { key: "consults", label: "Consultation requests" },
];

export default function HospitalSettings() {
  const { data: hospital, isLoading } = useHospitalInfo();
  const { data: subscription } = useHospitalSubscription();
  const { data: staff = [] } = useHospitalStaff();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<any>({});
  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [savingInfo, setSavingInfo] = useState(false);

  useEffect(() => { if (hospital) setForm(hospital); }, [hospital]);

  useEffect(() => {
    (async () => {
      if (!hospital?.id) return;
      const { data } = await supabase.from("hospital_notification_prefs" as any).select("prefs").eq("hospital_id", hospital.id).maybeSingle();
      const stored = (data as any)?.prefs || {};
      const init: Record<string, boolean> = {};
      NOTIF_KEYS.forEach((n) => { init[n.key] = stored[n.key] ?? true; });
      setPrefs(init);
    })();
  }, [hospital?.id]);

  async function saveInfo() {
    if (!hospital?.id) return;
    setSavingInfo(true);
    const { error } = await supabase.from("hospitals").update({
      name: form.name, phone: form.phone, email: form.email, address: form.address, license_number: form.license_number,
    }).eq("id", hospital.id);
    setSavingInfo(false);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Hospital info saved" });
    qc.invalidateQueries({ queryKey: ["hospital-info"] });
  }

  async function savePrefs(next: Record<string, boolean>) {
    setPrefs(next);
    if (!hospital?.id) return;
    await supabase.from("hospital_notification_prefs" as any).upsert({ hospital_id: hospital.id, prefs: next, updated_at: new Date().toISOString() });
  }

  async function deactivateStaff(id: string) {
    const { error } = await supabase.from("hospital_staff").update({ is_active: false }).eq("id", id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Staff deactivated" });
    qc.invalidateQueries({ queryKey: ["hospital-staff"] });
  }

  const plan = (subscription as any)?.plan || "emr";
  const isTele = plan === "telemedicine";

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Settings</h1>
        <p className="text-muted-foreground">Hospital configuration and preferences</p>
      </div>
      {isLoading ? <div className="text-center p-8 text-muted-foreground">Loading...</div> : (
        <Tabs defaultValue="general" className="max-w-4xl">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="subscription">Subscription</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-heading font-bold">Hospital Information</h3>
              <div><Label>Hospital Name</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Phone</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              </div>
              <div><Label>Address</Label><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>License Number</Label><Input value={form.license_number || ""} onChange={(e) => setForm({ ...form, license_number: e.target.value })} /></div>
              <Button onClick={saveInfo} disabled={savingInfo}>{savingInfo ? "Saving..." : "Save Changes"}</Button>
            </div>
          </TabsContent>

          <TabsContent value="subscription" className="mt-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground">Current plan</p>
                  <h3 className="text-2xl font-heading font-bold capitalize">{isTele ? "Telemedicine Suite" : "EMR Essentials"}</h3>
                </div>
                <Badge variant={isTele ? "default" : "secondary"}>{(subscription as any)?.status || "active"}</Badge>
              </div>
              <div className="grid md:grid-cols-2 gap-4 mb-6">
                <div className={`border-2 rounded-xl p-4 ${!isTele ? "border-primary bg-primary/5" : "border-border"}`}>
                  <h4 className="font-heading font-bold mb-2">EMR Essentials — ₦75K/mo</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li className="flex gap-2"><Check className="w-4 h-4 text-success" /> Patients, EMR, Queue, Lab</li>
                    <li className="flex gap-2"><Check className="w-4 h-4 text-success" /> Pharmacy & Billing</li>
                    <li className="flex gap-2"><Check className="w-4 h-4 text-success" /> Bed & Ward management</li>
                  </ul>
                </div>
                <div className={`border-2 rounded-xl p-4 ${isTele ? "border-primary bg-primary/5" : "border-border"}`}>
                  <h4 className="font-heading font-bold mb-2">Telemedicine Suite — ₦150K/mo</h4>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li className="flex gap-2"><Check className="w-4 h-4 text-success" /> Everything in EMR</li>
                    <li className="flex gap-2"><Check className="w-4 h-4 text-success" /> Consultation requests</li>
                    <li className="flex gap-2"><Check className="w-4 h-4 text-success" /> Doctor marketplace access</li>
                  </ul>
                </div>
              </div>
              {!isTele ? (
                <Button onClick={() => toast({ title: "Contact Sales", description: "We'll reach out to upgrade you to Telemedicine." })}>
                  Upgrade to Telemedicine
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground flex items-center gap-2"><Lock className="w-4 h-4" /> You're on the highest tier.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="staff" className="mt-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-heading font-bold">Staff Members</h3>
                <InviteStaffDialog />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3"></th>
                  </tr></thead>
                  <tbody>
                    {staff.length === 0 ? (
                      <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No staff yet</td></tr>
                    ) : staff.map((s: any) => (
                      <tr key={s.id} className="border-b border-border/50">
                        <td className="p-3 font-medium">{s.first_name} {s.last_name}</td>
                        <td className="p-3 text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{s.email}</td>
                        <td className="p-3 capitalize">{s.role}</td>
                        <td className="p-3"><Badge variant={s.is_active ? "default" : "secondary"}>{s.is_active ? "Active" : "Inactive"}</Badge></td>
                        <td className="p-3 text-right">
                          {s.is_active && <Button size="sm" variant="outline" onClick={() => deactivateStaff(s.id)}>Deactivate</Button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="mt-6">
            <div className="bg-card border border-border rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-heading font-bold">Notification Preferences</h3>
              {NOTIF_KEYS.map((n) => (
                <div key={n.key} className="flex items-center justify-between">
                  <span className="text-sm">{n.label}</span>
                  <Switch checked={prefs[n.key] ?? true} onCheckedChange={(v) => savePrefs({ ...prefs, [n.key]: v })} />
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      )}
    </HospitalLayout>
  );
}
