import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Edit2, Shield, CheckCircle2, Clock, AlertCircle, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DoctorProfile() {
  const [doc, setDoc] = useState<any>(null);
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("doctors").select("*").eq("user_id", user.id).maybeSingle();
      setDoc(data || {
        first_name: "Adaobi", last_name: "Okonkwo", specialty: "Cardiology", years_experience: 12,
        bio: "Consultant cardiologist with 12+ years' experience in non-invasive cardiology and heart-failure management.",
        email: "adaobi.okonkwo@example.com", phone: "+234 803 555 0190", rating: 4.8, verification_status: "approved",
      });
    })();
  }, []);

  if (!doc) return <DoctorLayout><div className="text-muted-foreground">Loading…</div></DoctorLayout>;

  const status = doc.verification_status || "approved";
  const StatusBadge = () => {
    const map: Record<string, { icon: any; cls: string; label: string }> = {
      approved: { icon: CheckCircle2, cls: "bg-success/15 text-success border-success/30", label: "Verified" },
      pending_review: { icon: Clock, cls: "bg-warning/15 text-warning border-warning/30", label: "Under review" },
      rejected: { icon: AlertCircle, cls: "bg-destructive/15 text-destructive border-destructive/30", label: "Rejected" },
      unverified: { icon: Shield, cls: "bg-muted text-muted-foreground border-border", label: "Unverified" },
    };
    const m = map[status] || map.unverified;
    return <span className={cn("inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border", m.cls)}><m.icon className="w-3.5 h-3.5" />{m.label}</span>;
  };

  return (
    <DoctorLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">My Profile</h1>
          <p className="text-muted-foreground text-sm">Information visible to patients and hospitals</p>
        </div>
        <button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg inline-flex items-center gap-2"><Edit2 className="w-4 h-4" />Edit</button>
      </div>

      <div className="bg-gradient-to-r from-primary/15 to-info/15 border border-primary/20 rounded-xl p-6 mb-6 flex items-center gap-5 flex-wrap">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground flex items-center justify-center text-2xl font-bold">{doc.first_name?.[0]}{doc.last_name?.[0]}</div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-heading font-bold">Dr. {doc.first_name} {doc.last_name}</h2>
            <StatusBadge />
          </div>
          <p className="text-sm text-muted-foreground">{doc.specialty} • {doc.years_experience || 0} years experience</p>
          <p className="text-sm flex items-center gap-1 mt-1"><Star className="w-4 h-4 text-warning fill-warning" />{doc.rating ?? 0} rating</p>
        </div>
        {status !== "approved" && (
          <Link to="/doctor/verification" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">
            {status === "rejected" ? "Resubmit credentials" : "Submit credentials"}
          </Link>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Section title="About">
          <p className="text-sm text-muted-foreground leading-relaxed">{doc.bio || "No bio yet."}</p>
        </Section>
        <Section title="Contact">
          <Field label="Email" value={doc.email} />
          <Field label="Phone" value={doc.phone} />
        </Section>
        <Section title="Marketplace settings">
          <Field label="Available for external consults" value={status === "approved" ? "Yes" : "Locked — verify first"} />
          <Field label="External consultation fee" value="₦25,000" />
          <Field label="External virtual fee" value="₦15,000" />
          <Field label="Max external hours / week" value="10" />
        </Section>
        <Section title="Verification">
          <Field label="Status" value={status.replace("_", " ")} />
          <Field label="License number" value={doc.license_number || "—"} />
          <Field label="Council" value={doc.license_council || "MDCN"} />
          <Field label="License expiry" value={doc.license_expiry || "—"} />
        </Section>
      </div>
    </DoctorLayout>
  );
}

function Section({ title, children }: any) {
  return <div className="bg-card border border-border rounded-xl p-5"><h3 className="font-heading font-bold mb-3">{title}</h3><div className="space-y-2">{children}</div></div>;
}
function Field({ label, value }: { label: string; value: any }) {
  return <div className="flex justify-between gap-4"><span className="text-sm text-muted-foreground">{label}</span><span className="text-sm font-medium text-right capitalize">{value}</span></div>;
}
