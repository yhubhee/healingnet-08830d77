import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

const ALLOWED_WHEN_BLOCKED = ["/doctor/verification", "/doctor/profile"];

export function VerificationGate({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { pathname } = useLocation();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase.from("doctors").select("verification_status, verification_rejection_reason").eq("user_id", user.id).maybeSingle();
      setStatus((data as any)?.verification_status ?? "approved");
      setReason((data as any)?.verification_rejection_reason ?? null);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="p-8 text-muted-foreground text-sm">Loading…</div>;
  if (!status || status === "approved") return <>{children}</>;

  // Allow profile/verification pages even when not approved
  if (ALLOWED_WHEN_BLOCKED.includes(pathname)) {
    return (
      <>
        <Banner status={status} reason={reason} />
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
          <Link to="/doctor/profile" className="text-primary text-sm">Go to profile →</Link>
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
        {status === "rejected" && reason && (
          <div className="bg-destructive/10 text-destructive text-sm rounded-lg p-3 mt-4 text-left flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><div><strong>Previous submission rejected:</strong> {reason}</div></div>
        )}
        <p className="text-sm text-muted-foreground mt-4 mb-6">You'll need: medical license number, license document, current/last hospital of practice, and a government ID.</p>
        <Link to="/doctor/verification" className="inline-block bg-primary text-primary-foreground px-5 py-2.5 rounded-lg font-medium">Submit credentials</Link>
      </div>
    </div>
  );
}

function Banner({ status, reason }: { status: string; reason: string | null }) {
  if (status === "pending_review") {
    return <div className="bg-warning/10 border border-warning/30 text-warning rounded-lg p-3 mb-5 flex items-center gap-2 text-sm"><Clock className="w-4 h-4" />Your verification is under review (24–48h).</div>;
  }
  if (status === "rejected") {
    return <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-lg p-3 mb-5 flex items-start gap-2 text-sm"><AlertCircle className="w-4 h-4 mt-0.5" /><div>Verification rejected. {reason || "Please review and resubmit."}</div></div>;
  }
  return <div className="bg-primary/10 border border-primary/30 text-primary rounded-lg p-3 mb-5 flex items-center gap-2 text-sm"><Shield className="w-4 h-4" />Complete your verification to unlock the full doctor portal. <Link to="/doctor/verification" className="underline ml-auto">Start now</Link></div>;
}
