import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useDoctor } from "@/hooks/useDoctor";
import { useHospitalId, useDoctors } from "@/hooks/useHospitalData";

interface Props {
  patientId: string;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
}

export function DoctorReferralDialog({ patientId, trigger, onSuccess }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    referral_type: "internal",
    referred_to_doctor_id: "",
    referred_to_hospital: "",
    specialty: "",
    urgency: "routine",
    reason: "",
    clinical_summary: "",
  });
  const [saving, setSaving] = useState(false);

  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: doctor } = useDoctor();
  const { data: hospitalId } = useHospitalId();
  const { data: doctors = [] } = useDoctors();

  async function handleSubmit() {
    if (!doctor?.doctor?.id || !hospitalId || !patientId) {
      toast.error("Missing required information");
      return;
    }

    if (!form.reason.trim()) {
      toast.error("Please provide a referral reason");
      return;
    }

    if (form.referral_type === "internal" && !form.referred_to_doctor_id) {
      toast.error("Please select a doctor for internal referral");
      return;
    }

    if (form.referral_type === "external" && !form.referred_to_hospital.trim()) {
      toast.error("Please provide hospital name for external referral");
      return;
    }

    setSaving(true);

    const referralData = {
      hospital_id: hospitalId,
      patient_id: patientId,
      referring_doctor_id: doctor.doctor.id,
      referred_to_doctor_id: form.referral_type === "internal" ? form.referred_to_doctor_id : null,
      referred_to_hospital: form.referral_type === "external" ? form.referred_to_hospital : null,
      specialty: form.specialty || null,
      urgency: form.urgency,
      reason: form.reason,
      clinical_summary: form.clinical_summary || null,
      referral_type: form.referral_type === "internal" ? "internal" : "external_outgoing",
      status: "pending",
    };

    const { error } = await supabase.from("hospital_referrals").insert(referralData);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Referral created successfully");
    qc.invalidateQueries({ queryKey: ["hospital-referrals"] });
    setOpen(false);
    setForm({
      referral_type: "internal",
      referred_to_doctor_id: "",
      referred_to_hospital: "",
      specialty: "",
      urgency: "routine",
      reason: "",
      clinical_summary: "",
    });
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || <Button variant="outline" size="sm">Refer Patient</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Patient Referral</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs">Referral Type</Label>
            <Select value={form.referral_type} onValueChange={(v) => setForm({ ...form, referral_type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="internal">Internal (Within Hospital)</SelectItem>
                <SelectItem value="external">External (Outside Hospital)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.referral_type === "internal" ? (
            <div>
              <Label className="text-xs">Refer To Doctor</Label>
              <Select value={form.referred_to_doctor_id} onValueChange={(v) => setForm({ ...form, referred_to_doctor_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors
                    .filter((d: any) => d.doctors?.id !== doctor?.doctor?.id)
                    .map((d: any) => (
                      <SelectItem key={d.doctors?.id} value={d.doctors?.id || ""}>
                        Dr. {d.doctors?.first_name} {d.doctors?.last_name} ({d.doctors?.specialty})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label className="text-xs">Hospital Name</Label>
              <Input
                placeholder="Enter hospital name"
                value={form.referred_to_hospital}
                onChange={(e) => setForm({ ...form, referred_to_hospital: e.target.value })}
              />
            </div>
          )}

          <div>
            <Label className="text-xs">Specialty</Label>
            <Input
              placeholder="e.g., Cardiology, Neurology"
              value={form.specialty}
              onChange={(e) => setForm({ ...form, specialty: e.target.value })}
            />
          </div>

          <div>
            <Label className="text-xs">Urgency</Label>
            <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="routine">Routine</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="emergency">Emergency</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Reason for Referral *</Label>
            <Textarea
              placeholder="Describe why the patient needs referral"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
              required
            />
          </div>

          <div>
            <Label className="text-xs">Clinical Summary (optional)</Label>
            <Textarea
              placeholder="Add clinical notes or summary"
              value={form.clinical_summary}
              onChange={(e) => setForm({ ...form, clinical_summary: e.target.value })}
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create Referral
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
