import { HospitalLayout } from "@/layouts/HospitalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useHospitalInfo } from "@/hooks/useHospitalData";

export default function HospitalSettings() {
  const { data: hospital, isLoading } = useHospitalInfo();

  return (
    <HospitalLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-heading font-bold mb-1">Settings</h1>
        <p className="text-muted-foreground">Hospital configuration and preferences</p>
      </div>
      {isLoading ? <div className="text-center p-8 text-muted-foreground">Loading...</div> : (
        <div className="max-w-2xl space-y-8">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-heading font-bold mb-4">Hospital Information</h3>
            <div className="space-y-4">
              <div><Label>Hospital Name</Label><Input defaultValue={hospital?.name || ""} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Phone</Label><Input defaultValue={hospital?.phone || ""} /></div>
                <div><Label>Email</Label><Input defaultValue={hospital?.email || ""} /></div>
              </div>
              <div><Label>Address</Label><Input defaultValue={hospital?.address || ""} /></div>
              <div><Label>License Number</Label><Input defaultValue={hospital?.license_number || ""} /></div>
              <Button>Save Changes</Button>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-lg font-heading font-bold mb-4">Notification Preferences</h3>
            <div className="space-y-4">
              {["Patient check-ins", "Lab results ready", "Low stock alerts", "Payment received", "Emergency alerts", "Consultation requests"].map((pref) => (
                <div key={pref} className="flex items-center justify-between">
                  <span className="text-sm">{pref}</span>
                  <Switch defaultChecked />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </HospitalLayout>
  );
}
