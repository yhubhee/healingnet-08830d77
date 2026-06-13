import { DoctorLayout } from "@/layouts/DoctorLayout";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Save, Globe, Building2, Bell, User } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Slot {
  id?: string;
  doctor_id: string;
  hospital_id: string | null;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  accepts_virtual: boolean;
  accepts_in_person: boolean;
}

interface Settings {
  doctor_id: string;
  availability_mode: "global" | "per_hospital";
  is_currently_available: boolean;
  accepts_virtual_global: boolean;
  virtual_consultation_fee: number;
  notification_prefs: { email?: boolean; sms?: boolean; in_app?: boolean };
  language: string;
  timezone: string;
}

interface HospitalRef { id: string; name: string }

export default function DoctorSettings() {
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<HospitalRef[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [slots, setSlots] = useState<Record<string, Slot[]>>({}); // key: hospitalId or "global"
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: doc } = await supabase.from("doctors").select("id").eq("user_id", user.id).maybeSingle();
      if (!doc) { setLoading(false); return; }
      setDoctorId(doc.id);

      // Load hospitals doctor is part of
      const { data: hd } = await supabase.from("hospital_doctors").select("hospital_id").eq("doctor_id", doc.id).eq("is_active", true);
      const ids = (hd || []).map((r: any) => r.hospital_id);
      const { data: hs } = ids.length
        ? await supabase.from("hospitals").select("id, name").in("id", ids)
        : { data: [] as any[] };
      setHospitals((hs || []) as HospitalRef[]);

      // Load settings or create defaults locally
      const { data: ds } = await supabase.from("doctor_settings").select("*").eq("doctor_id", doc.id).maybeSingle();
      setSettings(ds ? (ds as any) : {
        doctor_id: doc.id,
        availability_mode: "global",
        is_currently_available: true,
        accepts_virtual_global: false,
        virtual_consultation_fee: 0,
        notification_prefs: { email: true, sms: false, in_app: true },
        language: "en",
        timezone: "Africa/Lagos",
      });

      // Load availability rows
      const { data: avs } = await supabase.from("doctor_availability").select("*").eq("doctor_id", doc.id);
      const grouped: Record<string, Slot[]> = { global: makeWeek(doc.id, null) };
      (hs || []).forEach((h: any) => { grouped[h.id] = makeWeek(doc.id, h.id); });
      (avs || []).forEach((row: any) => {
        const key = row.hospital_id || "global";
        if (!grouped[key]) grouped[key] = makeWeek(doc.id, row.hospital_id);
        const idx = grouped[key].findIndex((s) => s.day_of_week === row.day_of_week);
        if (idx >= 0) grouped[key][idx] = row;
      });
      setSlots(grouped);
      setLoading(false);
    })();
  }, []);

  function makeWeek(doctorId: string, hospitalId: string | null): Slot[] {
    return DAYS.map((_, i) => ({
      doctor_id: doctorId,
      hospital_id: hospitalId,
      day_of_week: i,
      start_time: "09:00",
      end_time: "17:00",
      is_available: i >= 1 && i <= 5,
      accepts_virtual: false,
      accepts_in_person: true,
    }));
  }

  function updateSlot(key: string, day: number, patch: Partial<Slot>) {
    setSlots((prev) => ({
      ...prev,
      [key]: prev[key].map((s) => (s.day_of_week === day ? { ...s, ...patch } : s)),
    }));
  }

  async function saveAll() {
    if (!doctorId || !settings) return;
    setSaving(true);
    try {
      const { error: sErr } = await supabase.from("doctor_settings").upsert(settings as any, { onConflict: "doctor_id" });
      if (sErr) throw sErr;

      const isGlobal = settings.availability_mode === "global";
      const keys = isGlobal ? ["global"] : hospitals.map((h) => h.id);
      const rows = keys.flatMap((k) => slots[k] || []).map((s) => ({
        doctor_id: s.doctor_id,
        hospital_id: s.hospital_id,
        day_of_week: s.day_of_week,
        start_time: s.start_time,
        end_time: s.end_time,
        is_available: s.is_available,
        accepts_virtual: s.accepts_virtual,
        accepts_in_person: s.accepts_in_person,
      }));

      // Delete existing rows scoped to what we're about to save, then insert.
      // The table's unique index uses COALESCE(hospital_id, ...), which Postgres
      // can't match via ON CONFLICT's column list, so we avoid upsert here.
      if (isGlobal) {
        const { error: dErr } = await supabase
          .from("doctor_availability")
          .delete()
          .eq("doctor_id", doctorId)
          .is("hospital_id", null);
        if (dErr) throw dErr;
      } else if (hospitals.length) {
        const { error: dErr } = await supabase
          .from("doctor_availability")
          .delete()
          .eq("doctor_id", doctorId)
          .in("hospital_id", hospitals.map((h) => h.id));
        if (dErr) throw dErr;
      }

      if (rows.length) {
        const { error: aErr } = await supabase.from("doctor_availability").insert(rows as any);
        if (aErr) throw aErr;
      }
      toast.success("Settings saved");
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }


  if (loading) return <DoctorLayout><div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" />Loading…</div></DoctorLayout>;
  if (!settings) return <DoctorLayout><p className="text-muted-foreground">Doctor profile not found.</p></DoctorLayout>;

  return (
    <DoctorLayout>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm">Control your availability and account preferences</p>
        </div>
        <button onClick={saveAll} disabled={saving} className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save changes
        </button>
      </div>

      {/* Master availability bar */}
      <div className="bg-card border border-border rounded-xl p-4 mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-medium">Currently accepting patients</div>
          <div className="text-xs text-muted-foreground">Master switch — turning this off makes you unavailable everywhere.</div>
        </div>
        <Switch checked={settings.is_currently_available} onCheckedChange={(v) => setSettings({ ...settings, is_currently_available: v })} />
      </div>

      <Tabs defaultValue="availability">
        <TabsList>
          <TabsTrigger value="availability"><Globe className="w-4 h-4 mr-1" />Availability</TabsTrigger>
          <TabsTrigger value="hospitals"><Building2 className="w-4 h-4 mr-1" />Hospitals</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="w-4 h-4 mr-1" />Notifications</TabsTrigger>
          <TabsTrigger value="account"><User className="w-4 h-4 mr-1" />Account</TabsTrigger>
        </TabsList>

        <TabsContent value="availability" className="mt-5 space-y-5">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-heading font-bold mb-3">Schedule mode</h3>
            <div className="flex gap-3 flex-wrap mb-4">
              {(["global", "per_hospital"] as const).map((m) => (
                <button key={m} onClick={() => setSettings({ ...settings, availability_mode: m })}
                  className={cn("px-4 py-2 rounded-lg text-sm border", settings.availability_mode === m ? "bg-primary text-primary-foreground border-primary" : "border-border")}>
                  {m === "global" ? "Global (all hospitals)" : "Per hospital"}
                </button>
              ))}
            </div>

            <label className="flex items-center justify-between py-2 border-t border-border">
              <span className="text-sm">Open for virtual / online consultations (global)</span>
              <Switch checked={settings.accepts_virtual_global} onCheckedChange={(v) => setSettings({ ...settings, accepts_virtual_global: v })} />
            </label>
            <div className="flex items-center justify-between py-2 border-t border-border gap-3">
              <span className="text-sm">Default virtual consultation fee (₦)</span>
              <Input type="number" className="w-32" value={settings.virtual_consultation_fee || 0}
                onChange={(e) => setSettings({ ...settings, virtual_consultation_fee: Number(e.target.value) })} />
            </div>
          </div>

          {settings.availability_mode === "global" ? (
            <ScheduleCard title="Weekly schedule (applies everywhere)" slots={slots.global || []} onChange={(d, p) => updateSlot("global", d, p)} />
          ) : (
            hospitals.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-5 text-sm text-muted-foreground">
                You're not linked to any hospital yet. Once a hospital invites you, hospital-specific schedules will appear here.
              </div>
            ) : hospitals.map((h) => (
              <ScheduleCard key={h.id} title={h.name} slots={slots[h.id] || []} onChange={(d, p) => updateSlot(h.id, d, p)} />
            ))
          )}
        </TabsContent>

        <TabsContent value="hospitals" className="mt-5">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-heading font-bold mb-3">Hospitals you practice at</h3>
            {hospitals.length === 0 ? <p className="text-sm text-muted-foreground">None yet. A hospital admin must invite you.</p> :
              <ul className="space-y-2">{hospitals.map((h) => <li key={h.id} className="flex items-center gap-2 text-sm"><Building2 className="w-4 h-4 text-muted-foreground" />{h.name}</li>)}</ul>}
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-5">
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            {(["email", "sms", "in_app"] as const).map((k) => (
              <label key={k} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm capitalize">{k.replace("_", " ")} notifications</span>
                <Switch checked={!!settings.notification_prefs[k]}
                  onCheckedChange={(v) => setSettings({ ...settings, notification_prefs: { ...settings.notification_prefs, [k]: v } })} />
              </label>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="account" className="mt-5">
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Language</span>
              <Input className="w-40" value={settings.language || ""} onChange={(e) => setSettings({ ...settings, language: e.target.value })} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">Timezone</span>
              <Input className="w-48" value={settings.timezone || ""} onChange={(e) => setSettings({ ...settings, timezone: e.target.value })} />
            </div>
            <button onClick={signOut} className="mt-3 px-4 py-2 rounded-lg border border-destructive/40 text-destructive text-sm">Sign out</button>
          </div>
        </TabsContent>
      </Tabs>
    </DoctorLayout>
  );
}

function ScheduleCard({ title, slots, onChange }: { title: string; slots: Slot[]; onChange: (day: number, patch: Partial<Slot>) => void }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-heading font-bold mb-3">{title}</h3>
      <div className="space-y-2">
        {DAYS.map((d, i) => {
          const s = slots.find((x) => x.day_of_week === i);
          if (!s) return null;
          return (
            <div key={i} className="grid grid-cols-12 gap-2 items-center text-sm">
              <div className="col-span-2 font-medium">{d}</div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch checked={s.is_available} onCheckedChange={(v) => onChange(i, { is_available: v })} />
                <span className="text-xs text-muted-foreground">{s.is_available ? "On" : "Off"}</span>
              </div>
              <Input type="time" className="col-span-2" value={s.start_time?.slice(0, 5)} disabled={!s.is_available} onChange={(e) => onChange(i, { start_time: e.target.value })} />
              <Input type="time" className="col-span-2" value={s.end_time?.slice(0, 5)} disabled={!s.is_available} onChange={(e) => onChange(i, { end_time: e.target.value })} />
              <label className="col-span-2 flex items-center gap-2 text-xs">
                <Switch checked={s.accepts_in_person} onCheckedChange={(v) => onChange(i, { accepts_in_person: v })} />In-person
              </label>
              <label className="col-span-2 flex items-center gap-2 text-xs">
                <Switch checked={s.accepts_virtual} onCheckedChange={(v) => onChange(i, { accepts_virtual: v })} />Virtual
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
