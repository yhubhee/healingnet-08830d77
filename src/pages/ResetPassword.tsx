import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { friendlyError } from "@/lib/errors";
import { PageMeta } from "@/components/landing/PageMeta";
import { AuthLayout, authCard, authInput, authPrimary } from "@/components/marketing/AuthLayout";

/**
 * Step 2 of a password reset. The emailed link signs the user in (Supabase reads the
 * token from the URL), then they choose a new password here.
 */
export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState<"checking" | "yes" | "no">("checking");
  const [linkError, setLinkError] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // An expired or used link comes back with the error in the URL.
    const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
    const err = params.get("error_description");
    if (err) {
      setLinkError(err.replace(/\+/g, " "));
      setReady("no");
      return;
    }
    let done = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        done = true;
        setReady("yes");
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) { done = true; setReady("yes"); }
    });
    // Give the client a moment to read the token from the link before saying it's missing.
    const t = setTimeout(() => { if (!done) setReady("no"); }, 4000);
    return () => { subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return toast({ title: "Passwords don't match", description: "Type the same new password twice.", variant: "destructive" });
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      const description = /different from the old/i.test(error.message) ? "Choose a password you haven't used before."
        : /at least|short|weak/i.test(error.message) ? "Choose a stronger password (at least 6 characters)."
        : friendlyError(error);
      return toast({ title: "Couldn't update your password", description, variant: "destructive" });
    }
    toast({ title: "Password updated", description: "Sign in with your new password." });
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <AuthLayout line="Your account, kept safe.">
      <PageMeta title="Set a new password | HealingNet" description="Choose a new password for your HealingNet account." noindex />
      <div className={authCard}>
        {ready === "checking" ? (
          <p className="flex items-center gap-2 text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Checking your reset link…</p>
        ) : ready === "no" ? (
          <div className="space-y-4">
            <h1 className="text-[2rem] md:text-[2.5rem]">This link doesn't work</h1>
            <p className="text-base text-muted-foreground">
              {linkError ? `${linkError}. ` : ""}Reset links work once and expire after a while. Ask for a new one.
            </p>
            <Button asChild className={authPrimary}><Link to="/forgot-password">Send a new reset link</Link></Button>
            <p className="text-center text-base"><Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">Back to sign in</Link></p>
          </div>
        ) : (
          <form onSubmit={handle} className="space-y-4">
            <h1 className="text-[2rem] md:text-[2.5rem]">Set new password</h1>
            <div className="space-y-1.5"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={6} className={authInput} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            <div className="space-y-1.5"><Label htmlFor="confirm-password">Type it again</Label><Input id="confirm-password" type="password" autoComplete="new-password" minLength={6} className={authInput} value={confirm} onChange={(e) => setConfirm(e.target.value)} required /></div>
            <Button type="submit" className={authPrimary} disabled={loading}>{loading ? "Updating…" : "Update Password"}</Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
