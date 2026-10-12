import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type Role = "patient" | "hospital" | "doctor";

export interface SignupDetails {
  first_name: string;
  last_name: string;
  phone: string;
  specialty: string;
  hospital_name: string;
  hospital_address: string;
  hospital_phone: string;
}

export const emptyDetails = (): SignupDetails => ({
  first_name: "",
  last_name: "",
  phone: "",
  specialty: "",
  hospital_name: "",
  hospital_address: "",
  hospital_phone: "",
});

/**
 * The profile data the signup trigger (and complete_signup) reads:
 * everyone: first_name, last_name, phone. Doctors also: specialty.
 * Hospitals also: hospital_name, hospital_address, hospital_phone.
 */
export function detailsToData(role: Role, d: SignupDetails): Record<string, string> {
  const base: Record<string, string> = {
    first_name: d.first_name.trim(),
    last_name: d.last_name.trim(),
    phone: d.phone.trim(),
  };
  if (role === "doctor") base.specialty = d.specialty.trim();
  if (role === "hospital") {
    base.hospital_name = d.hospital_name.trim();
    base.hospital_address = d.hospital_address.trim();
    base.hospital_phone = d.hospital_phone.trim();
  }
  return base;
}

export function RoleFields({ role, value, onChange }: { role: Role; value: SignupDetails; onChange: (next: SignupDetails) => void }) {
  const set = (k: keyof SignupDetails) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>First name</Label><Input value={value.first_name} onChange={set("first_name")} required /></div>
        <div><Label>Last name</Label><Input value={value.last_name} onChange={set("last_name")} required /></div>
      </div>
      <div><Label>Phone</Label><Input type="tel" value={value.phone} onChange={set("phone")} placeholder="e.g., 0803 000 0000" /></div>
      {role === "doctor" && (
        <div><Label>Specialty</Label><Input value={value.specialty} onChange={set("specialty")} placeholder="e.g., Cardiology" required /></div>
      )}
      {role === "hospital" && (
        <div className="border-t border-border pt-4 mt-4">
          <h3 className="font-heading font-bold mb-3 text-sm">Hospital details</h3>
          <div className="space-y-3">
            <div><Label>Hospital name</Label><Input value={value.hospital_name} onChange={set("hospital_name")} required /></div>
            <div><Label>Address</Label><Input value={value.hospital_address} onChange={set("hospital_address")} /></div>
            <div><Label>Hospital phone</Label><Input value={value.hospital_phone} onChange={set("hospital_phone")} /></div>
          </div>
        </div>
      )}
    </>
  );
}
