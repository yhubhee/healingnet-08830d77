import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Edit2, Shield, CheckCircle2, Clock, AlertCircle, Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export default function DoctorProfile() {
  const [doc, setDoc] = useState<any>(null);
  const [market, setMarket] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setLoading(false);
    const { data } = await supabase.from("doctors").select("*").eq("user_id", user.id).maybeSingle();
    setDoc(data);
    if (data) {
      const { data: m } = await supabase.from("doctor_marketplace").select("*").eq("doctor_id", data.id).maybeSingle();
      setMarket(m || { doctor_id: data.id, is_available_for_external: false, external_consultation_fee: 0, external_virtual_fee: 0, max_external_hours_per_week: 10, bio_for_marketplace: "" });
    }
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  if (loading) return <DoctorLayout><div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div></DoctorLayout>;
  if (!doc) return <DoctorLayout><div className="text-muted-foreground">Doctor profile not found.</div></DoctorLayout>;

  const status = doc.verification_status || "unverified";
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
        <div><h1 className="text-2xl font-heading font-bold">My Profile</h1><p className="text-muted-foreground text-sm">Information visible to patients and hospitals</p></div>
        <EditProfileDialog doc={doc} onSaved={load} />
      </div>

      <div className="bg-gradient-to-r from-primary/15 to-info/15 border border-primary/20 rounded-xl p-6 mb-6 flex items-center gap-5 flex-wrap">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-info text-primary-foreground flex items-center justify-center text-2xl font-bold overflow-hidden">
          {doc.profile_image_url ? <img src={doc.profile_image_url} className="w-full h-full object-cover" alt="" /> : <>{doc.first_name?.[0]}{doc.last_name?.[0]}</>}
        </div>
        <div className="flex-1 min-w-[200px]">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-heading font-bold">Dr. {doc.first_name} {doc.last_name}</h2>
            <StatusBadge />
          </div>
          <p className="text-sm text-muted-foreground">{doc.specialty || "Specialty not set"} • {doc.years_experience || 0} years experience</p>
          <p className="text-sm flex items-center gap-1 mt-1"><Star className="w-4 h-4 text-warning fill-warning" />{doc.rating ?? 0} rating</p>
        </div>
        {status !== "approved" && (
          <Link to="/doctor/verification" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium">
            {status === "rejected" ? "Resubmit credentials" : "Submit credentials"}
          </Link>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <Section title="About"><p className="text-sm text-muted-foreground leading-relaxed">{doc.bio || "No bio yet."}</p></Section>
        <Section title="Contact"><Field label="Email" value={doc.email} /><Field label="Phone" value={doc.phone} /></Section>
        <MarketplaceCard market={market} setMarket={setMarket} approved={status === "approved"} />
        <Section title="Verification">
          <Field label="Status" value={status.replace("_", " ")} />
          <Field label="License number" value={doc.license_number || "—"} />
          <Field label="Council" value={doc.license_council || "—"} />
          <Field label="License expiry" value={doc.license_expiry || "—"} />
        </Section>
      </div>
    </DoctorLayout>
  );
}

function Section({ title, children }: any) { return <div className="bg-card border border-border rounded-xl p-5"><h3 className="font-heading font-bold mb-3">{title}</h3><div className="space-y-2">{children}</div></div>; }
function Field({ label, value }: { label: string; value: any }) { return <div className="flex justify-between gap-4"><span className="text-sm text-muted-foreground">{label}</span><span className="text-sm font-medium text-right capitalize">{value || "—"}</span></div>; }

function EditProfileDialog({ doc, onSaved }: { doc: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ first_name: doc.first_name || "", last_name: doc.last_name || "", phone: doc.phone || "", specialty: doc.specialty || "", years_experience: doc.years_experience || 0, bio: doc.bio || "" });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("doctors").update(form).eq("id", doc.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated"); setOpen(false); onSaved();
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><Edit2 className="w-4 h-4" />Edit</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First name</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><Label>Last name</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Specialty</Label><Input value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} /></div>
            <div><Label>Years experience</Label><Input type="number" value={form.years_experience} onChange={(e) => setForm({ ...form, years_experience: Number(e.target.value) })} /></div>
          </div>
          <div><Label>Bio</Label><Textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin" />}Save</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MarketplaceCard({ market, setMarket, approved }: any) {
  const [saving, setSaving] = useState(false);
  async function save() {
    if (!approved) return toast.error("Verify your credentials first");
    setSaving(true);
    const { error } = await supabase.from("doctor_marketplace").upsert(market, { onConflict: "doctor_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Marketplace updated");
  }
  return (
    <Section title="Care Zone marketplace">
      <div className="flex items-center justify-between"><span className="text-sm">Available for external consults</span>
        <Switch disabled={!approved} checked={!!market?.is_available_for_external} onCheckedChange={(v) => setMarket({ ...market, is_available_for_external: v })} /></div>
      <div className="flex items-center justify-between gap-2"><span className="text-sm">External in-person fee (₦)</span>
        <Input type="number" className="w-32" disabled={!approved} value={market?.external_consultation_fee ?? 0} onChange={(e) => setMarket({ ...market, external_consultation_fee: Number(e.target.value) })} /></div>
      <div className="flex items-center justify-between gap-2"><span className="text-sm">External virtual fee (₦)</span>
        <Input type="number" className="w-32" disabled={!approved} value={market?.external_virtual_fee ?? 0} onChange={(e) => setMarket({ ...market, external_virtual_fee: Number(e.target.value) })} /></div>
      <div className="flex items-center justify-between gap-2"><span className="text-sm">Max hours / week</span>
        <Input type="number" className="w-32" disabled={!approved} value={market?.max_external_hours_per_week ?? 10} onChange={(e) => setMarket({ ...market, max_external_hours_per_week: Number(e.target.value) })} /></div>
      {!approved && <p className="text-xs text-muted-foreground">🔒 Locked — verify your credentials first</p>}
      <Button onClick={save} disabled={!approved || saving} className="w-full mt-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />}Save marketplace settings</Button>
    </Section>
  );
}
