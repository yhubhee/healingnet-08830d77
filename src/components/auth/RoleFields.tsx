import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { NIGERIAN_STATES } from "@/lib/pharmacy";
import { cn } from "@/lib/utils";

export type Role = "patient" | "hospital" | "doctor" | "pharmacy" | "pharmacist";

export interface SignupDetails {
  first_name: string;
  last_name: string;
  phone: string;
  specialty: string;
  hospital_name: string;
  hospital_address: string;
  hospital_phone: string;
  // Pharmacy (owner) sign-up
  pharmacy_name: string;
  pharmacy_address: string;
  pharmacy_city: string;
  pharmacy_state: string;
  pharmacy_phone: string;
  premises_licence_no: string;
  is_pharmacist: boolean;
  // Pharmacist joining a pharmacy (and owners who are pharmacists)
  join_code: string;
  member_role: "pharmacist" | "assistant";
  pcn_reg_no: string;
  licence_expiry: string;
}

export const emptyDetails = (): SignupDetails => ({
  first_name: "",
  last_name: "",
  phone: "",
  specialty: "",
  hospital_name: "",
  hospital_address: "",
  hospital_phone: "",
  pharmacy_name: "",
  pharmacy_address: "",
  pharmacy_city: "",
  pharmacy_state: "",
  pharmacy_phone: "",
  premises_licence_no: "",
  is_pharmacist: false,
  join_code: "",
  member_role: "pharmacist",
  pcn_reg_no: "",
  licence_expiry: "",
});

/**
 * The profile data the signup trigger (and complete_signup) reads:
 * everyone: first_name, last_name, phone. Doctors also: specialty.
 * Hospitals also: hospital_name, hospital_address, hospital_phone.
 * Pharmacies also: pharmacy_name, pharmacy_address, pharmacy_city, pharmacy_state,
 *   pharmacy_phone, premises_licence_no, plus pcn_reg_no and licence_expiry when the owner is a pharmacist.
 * Pharmacists also: join_code, member_role ('assistant' or 'pharmacist'), pcn_reg_no, licence_expiry.
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
  if (role === "pharmacy") {
    base.pharmacy_name = d.pharmacy_name.trim();
    base.pharmacy_address = d.pharmacy_address.trim();
    base.pharmacy_city = d.pharmacy_city.trim();
    base.pharmacy_state = d.pharmacy_state.trim();
    base.pharmacy_phone = d.pharmacy_phone.trim();
    base.premises_licence_no = d.premises_licence_no.trim();
    if (d.is_pharmacist) {
      base.pcn_reg_no = d.pcn_reg_no.trim();
      base.licence_expiry = d.licence_expiry;
    }
  }
  if (role === "pharmacist") {
    base.join_code = d.join_code.trim().toUpperCase();
    base.member_role = d.member_role;
    if (d.member_role === "pharmacist") {
      base.pcn_reg_no = d.pcn_reg_no.trim();
      base.licence_expiry = d.licence_expiry;
    }
  }
  return base;
}

const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type JoinState = { status: "idle" | "checking" | "ok" | "bad"; name?: string; city?: string | null };

/** Live check of a pharmacy join code ("You are joining Good Health Pharmacy, Uyo"). */
function useJoinCode(code: string): JoinState {
  const [state, setState] = useState<JoinState>({ status: "idle" });
  useEffect(() => {
    const c = code.trim().toUpperCase();
    if (c.length < 8) {
      setState({ status: "idle" });
      return;
    }
    let live = true;
    setState({ status: "checking" });
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("pharmacy_for_join_code", { p_code: c });
      if (!live) return;
      const p = data as { name?: string; city?: string | null } | null;
      setState(!error && p?.name ? { status: "ok", name: p.name, city: p.city } : { status: "bad" });
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [code]);
  return state;
}

export function RoleFields({ role, value, onChange, onJoinCodeChecked }: {
  role: Role;
  value: SignupDetails;
  onChange: (next: SignupDetails) => void;
  /** Pharmacist sign-up: called with true once the join code matches a pharmacy. */
  onJoinCodeChecked?: (ok: boolean) => void;
}) {
  const uid = useId();
  // Ties each label to its input, so screen readers announce the field name.
  const fid = (k: keyof SignupDetails) => `${uid}-${k}`;
  const set = (k: keyof SignupDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });
  const join = useJoinCode(role === "pharmacist" ? value.join_code : "");
  useEffect(() => {
    onJoinCodeChecked?.(join.status === "ok");
  }, [join.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const pcnFields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div><Label htmlFor={fid("pcn_reg_no")}>PCN registration number</Label><Input id={fid("pcn_reg_no")} value={value.pcn_reg_no} onChange={set("pcn_reg_no")} maxLength={60} required /></div>
      <div><Label htmlFor={fid("licence_expiry")}>Licence expiry</Label><Input id={fid("licence_expiry")} type="date" value={value.licence_expiry} onChange={set("licence_expiry")} required /></div>
    </div>
  );

  const joinMessage =
    join.status === "ok" ? `You are joining ${join.name}${join.city ? `, ${join.city}` : ""}`
    : join.status === "bad" ? "That code doesn't match a pharmacy. Ask the pharmacy owner for their code."
    : join.status === "checking" ? "Checking…"
    : "Ask the pharmacy owner for the code shown on their Team page.";

  return (
    <>
      {role === "pharmacist" && (
        <div className="space-y-1.5">
          <Label htmlFor={fid("join_code")}>Pharmacy code</Label>
          <Input id={fid("join_code")} value={value.join_code} onChange={(e) => onChange({ ...value, join_code: e.target.value.toUpperCase() })}
            placeholder="8 letters and numbers" autoComplete="off" maxLength={12} required
            aria-describedby={`${fid("join_code")}-status`} />
          <p id={`${fid("join_code")}-status`} role="status"
            className={cn("text-sm", join.status === "ok" ? "text-success" : join.status === "bad" ? "text-destructive" : "text-muted-foreground")}>
            {joinMessage}
          </p>
        </div>
      )}
      {role === "pharmacy" && <h3 className="font-heading font-bold text-sm">Your details (owner)</h3>}
      <div className="grid grid-cols-2 gap-3">
        <div><Label htmlFor={fid("first_name")}>First name</Label><Input id={fid("first_name")} value={value.first_name} onChange={set("first_name")} required /></div>
        <div><Label htmlFor={fid("last_name")}>Last name</Label><Input id={fid("last_name")} value={value.last_name} onChange={set("last_name")} required /></div>
      </div>
      <div><Label htmlFor={fid("phone")}>Phone</Label><Input id={fid("phone")} type="tel" value={value.phone} onChange={set("phone")} placeholder="e.g., 0803 000 0000" /></div>
      {role === "doctor" && (
        <div><Label htmlFor={fid("specialty")}>Specialty</Label><Input id={fid("specialty")} value={value.specialty} onChange={set("specialty")} placeholder="e.g., Cardiology" required /></div>
      )}
      {role === "hospital" && (
        <div className="border-t border-border pt-4 mt-4">
          <h3 className="font-heading font-bold mb-3 text-sm">Hospital details</h3>
          <div className="space-y-3">
            <div><Label htmlFor={fid("hospital_name")}>Hospital name</Label><Input id={fid("hospital_name")} value={value.hospital_name} onChange={set("hospital_name")} required /></div>
            <div><Label htmlFor={fid("hospital_address")}>Address</Label><Input id={fid("hospital_address")} value={value.hospital_address} onChange={set("hospital_address")} /></div>
            <div><Label htmlFor={fid("hospital_phone")}>Hospital phone</Label><Input id={fid("hospital_phone")} value={value.hospital_phone} onChange={set("hospital_phone")} /></div>
          </div>
        </div>
      )}
      {role === "pharmacy" && (
        <>
          <div className="border-t border-border pt-4 mt-4">
            <h3 className="font-heading font-bold mb-3 text-sm">Pharmacy details</h3>
            <div className="space-y-3">
              <div><Label htmlFor={fid("pharmacy_name")}>Pharmacy name</Label><Input id={fid("pharmacy_name")} value={value.pharmacy_name} onChange={set("pharmacy_name")} maxLength={120} required /></div>
              <div><Label htmlFor={fid("pharmacy_address")}>Street address</Label><Input id={fid("pharmacy_address")} value={value.pharmacy_address} onChange={set("pharmacy_address")} maxLength={300} required /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><Label htmlFor={fid("pharmacy_city")}>City or town</Label><Input id={fid("pharmacy_city")} value={value.pharmacy_city} onChange={set("pharmacy_city")} maxLength={80} required /></div>
                <div>
                  <Label htmlFor={fid("pharmacy_state")}>State</Label>
                  <select id={fid("pharmacy_state")} className={selectCls} value={value.pharmacy_state} onChange={set("pharmacy_state")} required>
                    <option value="">Choose a state</option>
                    {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div><Label htmlFor={fid("pharmacy_phone")}>Pharmacy phone</Label><Input id={fid("pharmacy_phone")} type="tel" value={value.pharmacy_phone} onChange={set("pharmacy_phone")} maxLength={30} /></div>
              <div><Label htmlFor={fid("premises_licence_no")}>Premises licence number</Label><Input id={fid("premises_licence_no")} value={value.premises_licence_no} onChange={set("premises_licence_no")} maxLength={60} required /></div>
            </div>
          </div>
          <div className="space-y-3">
            <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
              <input type="checkbox" className="h-5 w-5 accent-primary" checked={value.is_pharmacist}
                onChange={(e) => onChange({ ...value, is_pharmacist: e.target.checked })} />
              I am also a pharmacist
            </label>
            {value.is_pharmacist && pcnFields}
          </div>
        </>
      )}
      {role === "pharmacist" && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Your role</legend>
          <div className="grid grid-cols-2 gap-2">
            {(["pharmacist", "assistant"] as const).map((r) => (
              <label key={r} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm", value.member_role === r ? "border-primary bg-primary/5" : "border-border")}>
                <input type="radio" name={fid("member_role")} value={r} checked={value.member_role === r} onChange={() => onChange({ ...value, member_role: r })} className="accent-primary" />
                {r === "pharmacist" ? "Pharmacist" : "Assistant (no PCN)"}
              </label>
            ))}
          </div>
          {value.member_role === "pharmacist" ? pcnFields : <p className="text-sm text-muted-foreground">Assistants can see and answer requests but can't dispense.</p>}
        </fieldset>
      )}
    </>
  );
}
