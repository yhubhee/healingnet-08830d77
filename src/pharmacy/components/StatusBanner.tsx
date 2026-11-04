import { Link } from "react-router-dom";
import { AlertTriangle, Clock, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate, type MyPharmacy } from "@/lib/pharmacy";

type Msg = { tone: "warn" | "bad"; text: string; link?: boolean };

/** Every reason this pharmacy or member can't work yet, most serious first. */
export function pharmacyStatusMessages({ member, pharmacy }: MyPharmacy): Msg[] {
  const out: Msg[] = [];
  if (!member.is_active) out.push({ tone: "bad", text: "Your account at this pharmacy is turned off. Ask the pharmacy owner to turn it back on." });
  if (pharmacy.verification_status === "pending") {
    out.push({ tone: "warn", text: "Your pharmacy is waiting for HealingNet to verify it. You can't be found by patients yet." });
  } else if (pharmacy.verification_status === "rejected") {
    out.push({ tone: "bad", text: `Your pharmacy was not verified${pharmacy.review_note ? `: ${pharmacy.review_note}` : "."} Update your details in Settings.`, link: true });
  } else if (pharmacy.verification_status === "suspended") {
    out.push({ tone: "bad", text: `Your pharmacy is suspended${pharmacy.paused_reason ? `: ${pharmacy.paused_reason}` : "."}` });
  } else if (!pharmacy.is_listed && pharmacy.paused_reason) {
    out.push({ tone: "bad", text: `Your pharmacy is hidden from patients: ${pharmacy.paused_reason}` });
  }
  // Assistants (and owners who don't dispense) have no PCN details to check.
  const dispenser = member.role !== "assistant" && !!member.pcn_reg_no;
  if (dispenser && member.verification_status === "pending") {
    out.push({ tone: "warn", text: "Your PCN details are being checked. You can't dispense yet." });
  } else if (dispenser && member.verification_status === "rejected") {
    out.push({ tone: "bad", text: `Your PCN details were not verified${member.review_note ? `: ${member.review_note}` : "."} Update them in Settings.`, link: true });
  }
  if (dispenser && member.licence_expiry && new Date(member.licence_expiry + "T23:59:59") < new Date()) {
    out.push({ tone: "bad", text: `Your licence expired on ${fmtDate(member.licence_expiry)}. Update it in Settings.`, link: true });
  }
  return out;
}

export function PharmacyStatusBanner({ me }: { me: MyPharmacy }) {
  const msgs = pharmacyStatusMessages(me);
  if (msgs.length === 0) return null;
  return (
    <div className="mb-5 space-y-2" role="status">
      {msgs.map((m, i) => {
        const Icon = m.tone === "bad" ? ShieldX : i === 0 ? Clock : AlertTriangle;
        return (
          <div key={i} className={cn("flex items-start gap-3 rounded-xl border p-4 text-sm",
            m.tone === "bad" ? "border-destructive/40 bg-destructive/10" : "border-warning/40 bg-warning/10")}>
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", m.tone === "bad" ? "text-destructive" : "text-warning")} aria-hidden />
            <p className="min-w-0 flex-1 break-words">
              {m.text}{" "}
              {m.link && <Link to="/pharmacy/settings" className="font-semibold text-primary underline-offset-4 hover:underline">Open Settings</Link>}
            </p>
          </div>
        );
      })}
    </div>
  );
}
