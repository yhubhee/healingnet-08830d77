import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { friendlyError } from "@/lib/errors";
import { MY_PHARMACY_KEY, NIGERIAN_STATES, useMyPharmacy, type MyPharmacy } from "@/lib/pharmacy";

const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

type PharmacyForm = {
  name: string; address: string; city: string; state: string; phone: string;
  premises_licence_no: string; premises_licence_expiry: string; superintendent_name: string; superintendent_pcn_no: string;
};
const LICENCE_KEYS: (keyof PharmacyForm)[] = ["premises_licence_no", "premises_licence_expiry", "superintendent_pcn_no"];

const fromPharmacy = (p: MyPharmacy["pharmacy"]): PharmacyForm => ({
  name: p.name ?? "", address: p.address ?? "", city: p.city ?? "", state: p.state ?? "", phone: p.phone ?? "",
  premises_licence_no: p.premises_licence_no ?? "", premises_licence_expiry: p.premises_licence_expiry ?? "",
  superintendent_name: p.superintendent_name ?? "", superintendent_pcn_no: p.superintendent_pcn_no ?? "",
});

function Confirm({ open, title, body, onCancel, onConfirm }: { open: boolean; title: string; body: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Save and send for checking</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function PharmacySettings() {
  const qc = useQueryClient();
  const { data: me } = useMyPharmacy();
  const isOwner = me?.member.role === "owner";
  const isAssistant = me?.member.role === "assistant";

  const [ph, setPh] = useState<PharmacyForm | null>(null);
  const [pcn, setPcn] = useState("");
  const [expiry, setExpiry] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState<"pharmacy" | "member" | null>(null);
  const [confirm, setConfirm] = useState<"pharmacy" | "member" | null>(null);

  useEffect(() => {
    if (!me) return;
    setPh(fromPharmacy(me.pharmacy));
    setPcn(me.member.pcn_reg_no ?? "");
    setExpiry(me.member.licence_expiry ?? "");
  }, [me]);

  if (!me || !ph) return null;

  const original = fromPharmacy(me.pharmacy);
  const licenceChanged = LICENCE_KEYS.some((k) => ph[k].trim() !== original[k].trim());
  const memberChanged = pcn.trim() !== (me.member.pcn_reg_no ?? "") || expiry !== (me.member.licence_expiry ?? "");
  const set = (k: keyof PharmacyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setPh({ ...ph, [k]: e.target.value });

  async function savePharmacy() {
    setConfirm(null);
    setBusy("pharmacy");
    const { error } = await supabase.rpc("update_my_pharmacy", { p_data: ph });
    setBusy(null);
    if (error) return toast.error(friendlyError(error));
    toast.success(licenceChanged ? "Saved. HealingNet will check your pharmacy again." : "Pharmacy details saved");
    qc.invalidateQueries({ queryKey: MY_PHARMACY_KEY });
  }
  async function saveMember() {
    setConfirm(null);
    setBusy("member");
    const { error } = await supabase.rpc("update_my_pharmacist_details", {
      // Both parameters are required by the function; null clears them (sent as JSON null).
      p_pcn_reg_no: (pcn.trim() || null) as string,
      p_licence_expiry: (expiry || null) as string,
      p_phone: phone.trim() || undefined,
    });
    setBusy(null);
    if (error) return toast.error(friendlyError(error));
    toast.success(memberChanged ? "Saved. HealingNet will check your details again." : "Your details are saved");
    setPhone("");
    qc.invalidateQueries({ queryKey: MY_PHARMACY_KEY });
  }

  const pharmacyNeedsWarning = licenceChanged && (me.pharmacy.verification_status === "approved" || me.pharmacy.verification_status === "rejected");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="font-heading text-2xl font-bold">Settings</h1>

      <form className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-6" aria-labelledby="ph-title"
        onSubmit={(e) => { e.preventDefault(); if (pharmacyNeedsWarning) setConfirm("pharmacy"); else savePharmacy(); }}>
        <div>
          <h2 id="ph-title" className="font-heading text-lg font-bold">Pharmacy details</h2>
          {!isOwner && <p className="text-sm text-muted-foreground">Only the pharmacy owner can change these.</p>}
        </div>
        <fieldset disabled={!isOwner} className="space-y-3">
          <div><Label htmlFor="ph-name">Pharmacy name</Label><Input id="ph-name" value={ph.name} onChange={set("name")} maxLength={120} required /></div>
          <div><Label htmlFor="ph-address">Street address</Label><Input id="ph-address" value={ph.address} onChange={set("address")} maxLength={300} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="ph-city">City or town</Label><Input id="ph-city" value={ph.city} onChange={set("city")} maxLength={80} /></div>
            <div>
              <Label htmlFor="ph-state">State</Label>
              <select id="ph-state" className={selectCls} value={ph.state} onChange={set("state")}>
                <option value="">Choose a state</option>
                {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                {ph.state && !(NIGERIAN_STATES as readonly string[]).includes(ph.state) && <option value={ph.state}>{ph.state}</option>}
              </select>
            </div>
          </div>
          <div><Label htmlFor="ph-phone">Pharmacy phone</Label><Input id="ph-phone" type="tel" value={ph.phone} onChange={set("phone")} maxLength={30} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="ph-lic">Premises licence number</Label><Input id="ph-lic" value={ph.premises_licence_no} onChange={set("premises_licence_no")} maxLength={60} /></div>
            <div><Label htmlFor="ph-licexp">Premises licence expiry</Label><Input id="ph-licexp" type="date" value={ph.premises_licence_expiry} onChange={set("premises_licence_expiry")} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="ph-sup">Superintendent pharmacist</Label><Input id="ph-sup" value={ph.superintendent_name} onChange={set("superintendent_name")} maxLength={120} /></div>
            <div><Label htmlFor="ph-suppcn">Superintendent PCN number</Label><Input id="ph-suppcn" value={ph.superintendent_pcn_no} onChange={set("superintendent_pcn_no")} maxLength={60} /></div>
          </div>
          {pharmacyNeedsWarning && <p className="text-sm text-warning">Changing licence details sends your pharmacy back for verification.</p>}
          {isOwner && <Button type="submit" disabled={busy === "pharmacy"}>{busy === "pharmacy" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save pharmacy details</Button>}
        </fieldset>
      </form>

      <form className="space-y-4 rounded-xl border border-border bg-card p-4 md:p-6" aria-labelledby="me-title"
        onSubmit={(e) => { e.preventDefault(); if (memberChanged) setConfirm("member"); else saveMember(); }}>
        <div>
          <h2 id="me-title" className="font-heading text-lg font-bold">Your details</h2>
          <p className="text-sm text-muted-foreground">{me.member.first_name} {me.member.last_name} · {isOwner ? "Owner" : isAssistant ? "Assistant" : "Pharmacist"}</p>
        </div>
        {!isAssistant && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label htmlFor="me-pcn">PCN registration number</Label><Input id="me-pcn" value={pcn} onChange={(e) => setPcn(e.target.value)} maxLength={60} /></div>
            <div><Label htmlFor="me-exp">Licence expiry</Label><Input id="me-exp" type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></div>
          </div>
        )}
        <div><Label htmlFor="me-phone">New phone number (optional)</Label><Input id="me-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="Leave blank to keep your current number" /></div>
        {memberChanged && <p className="text-sm text-warning">Changing your PCN number or licence expiry sends you back for verification.</p>}
        <Button type="submit" disabled={busy === "member" || (!memberChanged && !phone.trim())}>{busy === "member" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Save your details</Button>
      </form>

      <Confirm open={confirm === "pharmacy"} title="Send your pharmacy back for checking?"
        body="You changed a licence detail. Your pharmacy will go back to pending, and patients can't find you until HealingNet checks it again."
        onCancel={() => setConfirm(null)} onConfirm={savePharmacy} />
      <Confirm open={confirm === "member"} title="Send your details back for checking?"
        body="You changed your PCN number or licence expiry. You can't dispense until HealingNet checks your details again."
        onCancel={() => setConfirm(null)} onConfirm={saveMember} />
    </div>
  );
}
