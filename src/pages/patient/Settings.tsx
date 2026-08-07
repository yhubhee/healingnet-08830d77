import { PatientLayout } from "@/layouts/PatientLayout";
import { useEffect, useState } from "react";
import { Bell, Lock, Globe, Shield, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNotificationPrefs, useSaveNotificationPrefs } from "@/hooks/useUserNotifications";

export default function PatientSettings() {
  const { data: prefs, isLoading } = useNotificationPrefs();
  const savePrefs = useSaveNotificationPrefs();
  const [form, setForm] = useState({
    email_enabled: true,
    email_appointments: true,
    email_lab_results: true,
    email_prescriptions: true,
    email_letters: true,
    email_billing: true,
    language: "en",
  });

  useEffect(() => {
    if (prefs) {
      setForm({
        email_enabled: prefs.email_enabled,
        email_appointments: prefs.email_appointments,
        email_lab_results: prefs.email_lab_results,
        email_prescriptions: prefs.email_prescriptions,
        email_letters: prefs.email_letters,
        email_billing: prefs.email_billing,
        language: prefs.language || "en",
      });
    }
  }, [prefs]);

  function update(patch: Partial<typeof form>) {
    const next = { ...form, ...patch };
    setForm(next);
    savePrefs.mutate(next, {
      onSuccess: () => toast.success("Preferences saved"),
      onError: (e: any) => toast.error(e.message || "Could not save preferences"),
    });
  }

  return (
    <PatientLayout>
      <div className="mb-6 flex items-center gap-2">
        <div>
          <h1 className="text-2xl font-heading font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm">Preferences for your account</p>
        </div>
        {savePrefs.isPending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>

      <div className="space-y-5 max-w-3xl">
        <Card title="Email notifications" icon={Bell}>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-2">Loading preferences...</p>
          ) : (
            <>
              <Toggle label="Send me email notifications" Icon={Mail} checked={form.email_enabled} onChange={(v) => update({ email_enabled: v })} />
              <div className={form.email_enabled ? "" : "opacity-50 pointer-events-none"}>
                <Toggle label="Appointment reminders & updates" Icon={Mail} checked={form.email_appointments} onChange={(v) => update({ email_appointments: v })} />
                <Toggle label="Lab result notifications" Icon={Mail} checked={form.email_lab_results} onChange={(v) => update({ email_lab_results: v })} />
                <Toggle label="Prescription & refill alerts" Icon={Mail} checked={form.email_prescriptions} onChange={(v) => update({ email_prescriptions: v })} />
                <Toggle label="Letters & reports issued" Icon={Mail} checked={form.email_letters} onChange={(v) => update({ email_letters: v })} />
                <Toggle label="Billing & payment receipts" Icon={Mail} checked={form.email_billing} onChange={(v) => update({ email_billing: v })} />
              </div>
              <p className="text-xs text-muted-foreground pt-2">
                In-app notifications are always delivered to your Notifications inbox.
              </p>
            </>
          )}
        </Card>

        <Card title="Language" icon={Globe}>
          <div className="flex gap-2 flex-wrap">
            {[{ id: "en", l: "English" }, { id: "yo", l: "Yorùbá" }, { id: "ha", l: "Hausa" }, { id: "ig", l: "Igbo" }, { id: "pcm", l: "Pidgin" }].map((o) => (
              <button key={o.id} onClick={() => update({ language: o.id })} className={`px-3 py-1.5 rounded-lg text-sm border ${form.language === o.id ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{o.l}</button>
            ))}
          </div>
        </Card>

        <Card title="Privacy" icon={Shield}>
          <Toggle label="Allow doctors to message me" Icon={Mail} checked={true} onChange={() => {}} />
          <Toggle label="Share anonymized data for research" Icon={Mail} checked={false} onChange={() => {}} />
        </Card>

        <Card title="Security" icon={Lock}>
          <button className="px-4 py-2 border border-border rounded-lg text-sm">Change password</button>
          <button className="px-4 py-2 border border-border rounded-lg text-sm ml-2">Enable 2FA</button>
          <button className="px-4 py-2 bg-destructive/10 text-destructive border border-destructive/30 rounded-lg text-sm ml-2">Delete account</button>
        </Card>
      </div>
    </PatientLayout>
  );
}

function Card({ title, icon: Icon, children }: any) {
  return <div className="bg-card border border-border rounded-xl p-5"><h3 className="font-heading font-bold mb-4 flex items-center gap-2"><Icon className="w-4 h-4 text-primary" />{title}</h3><div className="space-y-2">{children}</div></div>;
}
function Toggle({ label, Icon, checked, onChange }: { label: string; Icon: any; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="flex items-center gap-2 text-sm"><Icon className="w-4 h-4 text-muted-foreground" />{label}</span>
      <button type="button" onClick={() => onChange(!checked)} className={`w-10 h-6 rounded-full transition relative ${checked ? "bg-primary" : "bg-muted"}`}>
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-card transition ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </label>
  );
}
