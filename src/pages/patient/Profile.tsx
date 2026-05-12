import { PatientLayout } from "@/layouts/PatientLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Phone, Mail, Heart, Shield, Loader2 } from "lucide-react";

export default function PatientProfile() {
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("patients").select("*").eq("user_id", user.id).maybeSingle();
      setP(data);
      setLoading(false);
    })();
  }, []);

  if (loading) return <PatientLayout><div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div></PatientLayout>;
  if (!p) return <PatientLayout><p className="text-muted-foreground text-sm">Profile not found.</p></PatientLayout>;

  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">My Profile</h1>
        <p className="text-muted-foreground text-sm">Personal and medical information</p>
      </div>

      <div className="bg-gradient-to-r from-primary/15 to-info/15 border border-primary/20 rounded-xl p-6 mb-6 flex items-center gap-5 flex-wrap">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground flex items-center justify-center text-2xl font-bold">{p.first_name?.[0]}{p.last_name?.[0]}</div>
        <div className="flex-1 min-w-[200px]">
          <h2 className="text-xl font-heading font-bold">{p.first_name} {p.last_name}</h2>
          <p className="text-sm text-muted-foreground">{p.gender || "—"} {p.date_of_birth && `• Born ${p.date_of_birth}`}</p>
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            {p.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{p.email}</span>}
            {p.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Section title="Personal Information" icon={User}>
          <Field label="Full name" value={`${p.first_name} ${p.last_name}`} />
          <Field label="Date of birth" value={p.date_of_birth} />
          <Field label="Gender" value={p.gender} />
          <Field label="Address" value={p.address} />
          <Field label="City / State" value={[p.city, p.state].filter(Boolean).join(", ")} />
        </Section>
        <Section title="Medical Information" icon={Heart}>
          <Field label="Blood group" value={p.blood_group} />
          <Field label="Genotype" value={p.genotype} />
        </Section>
        <Section title="Emergency Contact" icon={Phone}>
          <Field label="Name" value={p.emergency_contact_name} />
          <Field label="Phone" value={p.emergency_contact_phone} />
        </Section>
        <Section title="Insurance / NHIS" icon={Shield}>
          <Field label="Provider" value={p.insurance_provider} />
          <Field label="Policy number" value={p.insurance_policy_number} />
        </Section>
      </div>
    </PatientLayout>
  );
}

function Section({ title, icon: Icon, children }: any) {
  return <div className="bg-card border border-border rounded-xl p-5"><h3 className="font-heading font-bold mb-4 flex items-center gap-2"><Icon className="w-4 h-4 text-primary" />{title}</h3><div className="space-y-3">{children}</div></div>;
}
function Field({ label, value }: { label: string; value?: string | null }) {
  return <div className="flex justify-between gap-4"><span className="text-sm text-muted-foreground">{label}</span><span className="text-sm font-medium text-right">{value || "—"}</span></div>;
}
