import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useDoctorId, useDoctorProfile } from "@/hooks/useHospitalData";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export default function DoctorProfile() {
  const { data: docId } = useDoctorId();
  const { data: profile } = useDoctorProfile(docId);
  const [f, setF] = useState<any>({});
  const { toast } = useToast(); const qc = useQueryClient();

  useEffect(() => { if (profile) setF(profile); }, [profile]);

  async function save() {
    const { error } = await supabase.from("doctors").update({
      first_name: f.first_name, last_name: f.last_name, phone: f.phone, specialty: f.specialty, bio: f.bio, years_experience: f.years_experience,
    }).eq("id", docId!);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Profile saved" });
    qc.invalidateQueries({ queryKey: ["doctor-profile"] });
  }

  if (!profile) return <DoctorLayout><p>Loading...</p></DoctorLayout>;

  return (
    <DoctorLayout>
      <h1 className="text-2xl font-heading font-bold mb-6">Profile</h1>
      <div className="bg-card border border-border rounded-xl p-6 max-w-2xl space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>First name</Label><Input value={f.first_name || ""} onChange={(e) => setF({ ...f, first_name: e.target.value })} /></div>
          <div><Label>Last name</Label><Input value={f.last_name || ""} onChange={(e) => setF({ ...f, last_name: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Specialty</Label><Input value={f.specialty || ""} onChange={(e) => setF({ ...f, specialty: e.target.value })} /></div>
          <div><Label>Years experience</Label><Input type="number" value={f.years_experience || 0} onChange={(e) => setF({ ...f, years_experience: +e.target.value })} /></div>
        </div>
        <div><Label>Phone</Label><Input value={f.phone || ""} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div><Label>Bio</Label><Textarea rows={4} value={f.bio || ""} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
        <Button onClick={save}>Save</Button>
      </div>
    </DoctorLayout>
  );
}
