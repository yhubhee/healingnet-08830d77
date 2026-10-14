import { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Shield, Clock, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { missingProfileItems, useDoctorStatus } from "@/hooks/useDoctorStatus";

// Reachable before verification is approved.
const ALLOWED_WHEN_UNVERIFIED = ["/doctor/verification", "/doctor/profile"];
// Reachable while an approved doctor's profile is still incomplete.
const ALLOWED_WHEN_INCOMPLETE = ["/doctor/onboarding", "/doctor/profile", "/doctor/settings", "/doctor/verification"];

export function VerificationGate({ children }: { children: ReactNode }) {
  const { data: doc, isLoading } = useDoctorStatus();
  const { pathname } = useLocation();

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }
  // No doctor row (or it couldn't be read): let the page handle it.
  if (!doc) return <>{children}</>;

  const status = doc.verification_status;

  if (status === "approved") {
    const incomplete = missingProfileItems(doc).length > 0;
    if (incomplete && !ALLOWED_WHEN_INCOMPLETE.includes(pathname)) return <Navigate to="/doctor/onboarding" replace />;
    return <>{children}</>;
  }

  if (pathname === "/doctor/onboarding") return <Navigate to="/doctor/verification" replace />;
  // The verification page shows its own status view.
  if (pathname === "/doctor/verification") return <>{children}</>;
  if (ALLOWED_WHEN_UNVERIFIED.includes(pathname)) {
    return (
      <>
        <Banner status={status} reason={doc.verification_rejection_reason} />
        {children}
      </>
    );
  }

  if (status === "pending_review") {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-warning/15 text-warning mx-auto flex items-center justify-center mb-4"><Clock className="w-7 h-7" /></div>
          <h2 className="text-xl font-heading font-bold mb-2">Verification under review</h2>
          <p className="text-sm text-muted-foreground mb-5">Your credentials are being reviewed. This usually takes 24–48 hours. You'll get an email once you're approved.</p>
          <Link to="/doctor/verification" className="text-primary text-sm">View what you submitted →</Link>
        </div>
      </div>
    );
  }

  // unverified or rejected
  return (
    <div className="max-w-2xl mx-auto py-12">
      <div className="bg-card border border-border rounded-xl p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-primary/15 text-primary mx-auto flex items-center justify-center mb-4"><Shield className="w-7 h-7" /></div>
        <h2 className="text-xl font-heading font-bold mb-2">Verify your medical credentials</h2>
        <p className="text-sm text-muted-foreground mb-2">To protect patients and meet MDCN requirements, we verify every doctor who joins HealingNet directly.</p>
        {status === "rejected" && doc.verification_rejection_reason && (
          <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3 mt-4 text-left flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><div><strong>Previous submission rejected:</strong> {doc.verification_rejection_reason}</div></div>
        )}
        <p className="text-sm text-muted-foreground mt-4 mb-6">You'll need: your licence number and expiry, your licence document, a government ID, your medical school certificate, and your current or last place of practice.</p>
        <Link to="/doctor/verification" className="inline-block bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium">
          {status === "rejected" ? "Update and resubmit" : "Submit credentials"}
        </Link>
      </div>
    </div>
  );
}

function Banner({ status, reason }: { status: string; reason: string | null }) {
  if (status === "pending_review") {
    return <div className="bg-warning/10 border border-warning/30 text-warning rounded-lg p-3 mb-5 flex items-center gap-2 text-sm"><Clock className="w-4 h-4 shrink-0" />Your verification is under review (24–48h).</div>;
  }
  if (status === "rejected") {
    return <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-3 mb-5 flex items-start gap-2 text-sm"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><div>Verification rejected. {reason || "Please review and resubmit."} <Link to="/doctor/verification" className="underline">Resubmit</Link></div></div>;
  }
  return <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-3 mb-5 flex flex-wrap items-center gap-2 text-sm"><Shield className="w-4 h-4 shrink-0" />Complete your verification to unlock the full doctor portal. <Link to="/doctor/verification" className="underline sm:ml-auto">Start now</Link></div>;
}
