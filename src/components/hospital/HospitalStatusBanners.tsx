import { Link } from "react-router-dom";
import { AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";

/** Trial / expired plan banner and hospital verification banner, shown at the top of hospital pages. */
export function HospitalStatusBanners() {
  const { data: sub } = useSubscription();
  if (!sub) return null;

  return (
    <div className="space-y-3 mb-4">
      {sub.state === "trialing" && (
        <div className="flex items-center gap-3 rounded-lg border border-info/30 bg-info/10 px-4 py-2.5 text-sm">
          <Clock className="w-4 h-4 text-info shrink-0" />
          <span>Trial: {sub.trialDaysLeft} day{sub.trialDaysLeft === 1 ? "" : "s"} left.</span>
          <Link to="/hospital/settings" className="ml-auto text-primary hover:underline whitespace-nowrap">Choose a plan</Link>
        </div>
      )}
      {sub.state === "expired" && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span>Your plan has expired. Renew in Settings.</span>
          <Link to="/hospital/settings" className="ml-auto text-primary hover:underline whitespace-nowrap">Renew</Link>
        </div>
      )}
      {sub.verificationStatus === "pending" && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm">
          <ShieldCheck className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <span>Your hospital is awaiting verification by HealingNet. You can use the EMR with patients you register. Patients will be able to find and book you once you're verified.</span>
        </div>
      )}
      {sub.verificationStatus === "rejected" && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-sm">
          <ShieldCheck className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
          <span>
            Your hospital verification was not approved.
            {sub.verificationNotes ? ` Reason: ${sub.verificationNotes}` : ""}
          </span>
        </div>
      )}
    </div>
  );
}

/** For features that expose the hospital to patients: explain instead of failing. */
export function VerificationNotice() {
  const { data: sub } = useSubscription();
  if (!sub || sub.verificationStatus === "approved") return null;
  return (
    <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm mb-4">
      <ShieldCheck className="w-4 h-4 text-warning shrink-0 mt-0.5" />
      <span>
        {sub.verificationStatus === "rejected"
          ? "This feature is available after your hospital is verified. Your verification was not approved, so it is unavailable for now."
          : "This feature is available after HealingNet verifies your hospital. We'll let you know once you're approved."}
      </span>
    </div>
  );
}
