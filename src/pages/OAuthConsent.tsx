import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Heart } from "lucide-react";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

function oauth(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Missing authorization_id");
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("No redirect returned by the authorization server.");
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-card to-background">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8">
        <div className="flex items-center gap-2 mb-6 font-heading font-bold text-xl">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center">
            <Heart className="w-4 h-4 text-primary-foreground" fill="currentColor" />
          </div>
          HealingNet
        </div>
        {error && <p className="text-destructive text-sm">Could not load this request: {error}</p>}
        {!error && !details && <p className="text-muted-foreground text-sm">Loading…</p>}
        {details && (
          <>
            <h1 className="text-xl font-heading font-bold mb-2">
              Connect {details.client?.name ?? "an app"} to your account
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              {details.client?.name ?? "This client"} will be able to access your HealingNet data as you,
              including your profile, appointments, prescriptions, and lab orders.
            </p>
            <div className="flex gap-3">
              <Button disabled={busy} onClick={() => decide(true)} className="flex-1">
                Approve
              </Button>
              <Button disabled={busy} onClick={() => decide(false)} variant="outline" className="flex-1">
                Deny
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
