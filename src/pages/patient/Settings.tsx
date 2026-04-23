import { PatientLayout } from "@/layouts/PatientLayout";
import { Switch } from "@/components/ui/switch";

export default function PatientSettings() {
  return (
    <PatientLayout>
      <div className="mb-6"><h1 className="text-2xl font-heading font-bold">Settings</h1><p className="text-muted-foreground">Preferences & privacy</p></div>
      <div className="max-w-2xl bg-card border border-border rounded-xl p-6 space-y-4">
        <h3 className="font-heading font-bold mb-3">Notifications</h3>
        {["Appointment reminders", "Prescription updates", "New lab results", "Messages from doctors"].map((p) => (
          <div key={p} className="flex items-center justify-between"><span className="text-sm">{p}</span><Switch defaultChecked /></div>
        ))}
      </div>
    </PatientLayout>
  );
}
