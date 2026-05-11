import { PatientLayout } from "@/layouts/PatientLayout";
import { useState } from "react";
import { Bell, Lock, Globe, Shield, Mail, Smartphone } from "lucide-react";

export default function PatientSettings() {
  const [notif, setNotif] = useState({ apptEmail: true, apptSms: true, rxEmail: true, labEmail: true, marketing: false });
  const [lang, setLang] = useState("en");
  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm">Preferences for your account</p>
      </div>

      <div className="space-y-5 max-w-3xl">
        <Card title="Notifications" icon={Bell}>
          <Toggle label="Appointment reminders by email" Icon={Mail} checked={notif.apptEmail} onChange={(v) => setNotif({ ...notif, apptEmail: v })} />
          <Toggle label="Appointment reminders by SMS" Icon={Smartphone} checked={notif.apptSms} onChange={(v) => setNotif({ ...notif, apptSms: v })} />
          <Toggle label="Prescription refill alerts" Icon={Mail} checked={notif.rxEmail} onChange={(v) => setNotif({ ...notif, rxEmail: v })} />
          <Toggle label="Lab result notifications" Icon={Mail} checked={notif.labEmail} onChange={(v) => setNotif({ ...notif, labEmail: v })} />
          <Toggle label="Health tips & promotions" Icon={Mail} checked={notif.marketing} onChange={(v) => setNotif({ ...notif, marketing: v })} />
        </Card>

        <Card title="Language" icon={Globe}>
          <div className="flex gap-2 flex-wrap">
            {[{ id: "en", l: "English" }, { id: "yo", l: "Yorùbá" }, { id: "ha", l: "Hausa" }, { id: "ig", l: "Igbo" }, { id: "pcm", l: "Pidgin" }].map((o) => (
              <button key={o.id} onClick={() => setLang(o.id)} className={`px-3 py-1.5 rounded-lg text-sm border ${lang === o.id ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{o.l}</button>
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
