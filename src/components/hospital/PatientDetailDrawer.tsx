import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Phone, Mail, MapPin, Heart, Shield, Calendar, Pill, FlaskConical, Bed, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props { patient: any | null; onClose: () => void; }

const ngn = (n: number) => `₦${(n || 0).toLocaleString()}`;

function calcAge(dob?: string | null) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5));
}

function Section({ icon: Icon, title, children }: any) {
  return (
    <div className="border border-border rounded-lg p-4">
      <h3 className="flex items-center gap-2 text-sm font-heading font-bold mb-3">
        <Icon className="w-4 h-4 text-primary" />{title}
      </h3>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value ?? "—"}</div>
    </div>
  );
}

export function PatientDetailDrawer({ patient, onClose }: Props) {
  const open = !!patient;
  const pid = patient?.id;

  const { data: appts } = useQuery({
    enabled: open,
    queryKey: ["pd-appts", pid],
    queryFn: async () => {
      const { data } = await supabase.from("patient_appointments")
        .select("*, doctors(first_name,last_name,specialty)")
        .eq("patient_id", pid).order("requested_date", { ascending: false }).limit(5);
      return data || [];
    },
  });

  const { data: rxs } = useQuery({
    enabled: open,
    queryKey: ["pd-rx", pid],
    queryFn: async () => {
      const { data } = await supabase.from("prescriptions").select("*").eq("patient_id", pid).order("created_at", { ascending: false }).limit(5);
      return data || [];
    },
  });

  const { data: labs } = useQuery({
    enabled: open,
    queryKey: ["pd-labs", pid],
    queryFn: async () => {
      const { data } = await supabase.from("lab_results").select("*").eq("patient_id", pid).order("created_at", { ascending: false }).limit(3);
      return data || [];
    },
  });

  const { data: bed } = useQuery({
    enabled: open,
    queryKey: ["pd-bed", pid],
    queryFn: async () => {
      const { data } = await supabase.from("hospital_beds").select("bed_number, ward_id, hospital_wards(ward_name)").eq("current_patient_id", pid).maybeSingle();
      return data;
    },
  });

  const { data: bills } = useQuery({
    enabled: open,
    queryKey: ["pd-bills", pid],
    queryFn: async () => {
      const { data } = await supabase.from("hospital_billing").select("total_amount, status").eq("patient_id", pid);
      return data || [];
    },
  });

  const outstanding = (bills || []).filter((b: any) => b.status !== "paid").reduce((s: number, b: any) => s + Number(b.total_amount || 0), 0);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-xl">{patient?.first_name} {patient?.last_name}</SheetTitle>
        </SheetHeader>

        {!patient ? <Loader2 className="w-4 h-4 animate-spin" /> : (
          <div className="space-y-4 mt-4">
            <Section icon={User} title="Identity">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Age" value={calcAge(patient.date_of_birth) ? `${calcAge(patient.date_of_birth)} yrs` : "—"} />
                <Field label="Gender" value={patient.gender} />
                <Field label="Phone" value={patient.phone} />
                <Field label="Email" value={patient.email} />
                <Field label="City / State" value={[patient.city, patient.state].filter(Boolean).join(", ")} />
                <Field label="Address" value={patient.address} />
              </div>
            </Section>

            <Section icon={Heart} title="Medical">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Blood Group" value={patient.blood_group && <Badge variant="secondary">{patient.blood_group}</Badge>} />
                <Field label="Genotype" value={patient.genotype && <Badge variant="secondary">{patient.genotype}</Badge>} />
                <Field label="Current Status" value={<Badge>{patient.status || "outpatient"}</Badge>} />
                <Field label="Last Updated" value={new Date(patient.updated_at).toLocaleDateString()} />
              </div>
            </Section>

            <Section icon={Shield} title="Insurance & Emergency">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Insurance Provider" value={patient.insurance_provider} />
                <Field label="Policy No." value={patient.insurance_policy_number} />
                <Field label="Emergency Contact" value={patient.emergency_contact_name} />
                <Field label="Emergency Phone" value={patient.emergency_contact_phone} />
              </div>
            </Section>

            {bed && (
              <Section icon={Bed} title="Active Admission">
                <Field label="Ward / Bed" value={`${(bed as any).hospital_wards?.ward_name || "Ward"} • Bed ${(bed as any).bed_number}`} />
              </Section>
            )}

            <Section icon={Calendar} title="Recent Appointments">
              {(appts || []).length === 0 ? <p className="text-sm text-muted-foreground">No appointments yet.</p> :
                <div className="space-y-2">
                  {(appts || []).map((a: any) => (
                    <div key={a.id} className="flex justify-between text-sm border-b border-border pb-2 last:border-0">
                      <div>
                        <div className="font-medium">Dr. {a.doctors?.first_name} {a.doctors?.last_name}</div>
                        <div className="text-xs text-muted-foreground">{new Date(a.requested_date).toDateString()} {a.requested_time || ""}</div>
                      </div>
                      <Badge variant="outline" className="capitalize">{a.status}</Badge>
                    </div>
                  ))}
                </div>}
            </Section>

            <Section icon={Pill} title="Recent Prescriptions">
              {(rxs || []).length === 0 ? <p className="text-sm text-muted-foreground">No prescriptions.</p> :
                <ul className="text-sm space-y-1">
                  {(rxs || []).map((r: any) => <li key={r.id}>• {r.medication_name || r.diagnosis || "Prescription"} <span className="text-xs text-muted-foreground capitalize">({r.status})</span></li>)}
                </ul>}
            </Section>

            <Section icon={FlaskConical} title="Recent Lab Results">
              {(labs || []).length === 0 ? <p className="text-sm text-muted-foreground">No lab results.</p> :
                <ul className="text-sm space-y-1">
                  {(labs || []).map((l: any) => <li key={l.id}>• {l.test_name || l.category} <span className="text-xs text-muted-foreground capitalize">({l.status})</span></li>)}
                </ul>}
            </Section>

            <Section icon={Receipt} title="Billing">
              <Field label="Outstanding Balance" value={<span className={cn(outstanding > 0 ? "text-destructive font-bold" : "")}>{ngn(outstanding)}</span>} />
            </Section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
