import { useEffect, useState } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { usePatientProfile } from "@/hooks/usePatientData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function PatientProfile() {
  const { data: profile } = usePatientProfile();
  const [form, setForm] = useState<any>({});
  const { toast } = useToast();
  const qc = useQueryClient();

  useEffect(() => { if (profile) setForm(profile); }, [profile]);

  async function save() {
    if (!profile) return;
    const { error } = await supabase.from("patients").update({
      first_name: form.first_name, last_name: form.last_name, phone: form.phone,
      date_of_birth: form.date_of_birth || null, gender: form.gender, blood_group: form.blood_group,
      address: form.address, emergency_contact_name: form.emergency_contact_name, emergency_contact_phone: form.emergency_contact_phone,
      insurance_provider: form.insurance_provider, insurance_policy_number: form.insurance_policy_number,
    }).eq("id", profile.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Profile updated" });
    qc.invalidateQueries({ queryKey: ["patient-profile"] });
  }

  return (
    <PatientLayout>
      <div className="mb-6"><h1 className="text-2xl font-heading font-bold">Profile</h1><p className="text-muted-foreground">Personal & medical information</p></div>
      <div className="max-w-2xl bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>First name</Label><Input value={form.first_name || ""} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
          <div><Label>Last name</Label><Input value={form.last_name || ""} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Phone</Label><Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div><Label>Date of birth</Label><Input type="date" value={form.date_of_birth || ""} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Gender</Label><Input value={form.gender || ""} onChange={(e) => setForm({ ...form, gender: e.target.value })} /></div>
          <div><Label>Blood group</Label><Input value={form.blood_group || ""} onChange={(e) => setForm({ ...form, blood_group: e.target.value })} /></div>
        </div>
        <div><Label>Address</Label><Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Emergency contact</Label><Input value={form.emergency_contact_name || ""} onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })} /></div>
          <div><Label>Emergency phone</Label><Input value={form.emergency_contact_phone || ""} onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Insurance provider</Label><Input value={form.insurance_provider || ""} onChange={(e) => setForm({ ...form, insurance_provider: e.target.value })} /></div>
          <div><Label>Policy number</Label><Input value={form.insurance_policy_number || ""} onChange={(e) => setForm({ ...form, insurance_policy_number: e.target.value })} /></div>
        </div>
        <Button onClick={save}>Save Changes</Button>
      </div>
    </PatientLayout>
  );
}
