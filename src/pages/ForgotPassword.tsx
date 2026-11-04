import { useState } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageMeta } from "@/components/landing/PageMeta";
import { AuthLayout, authCard, authInput, authPrimary } from "@/components/marketing/AuthLayout";

/** Step 1 of a password reset: email a link that opens /reset-password signed in. */
export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    // Only a rate limit or network problem is shown. Whether the email has an account is never revealed.
    if (error && /rate limit|too many|429/i.test(`${error.message} ${error.status ?? ""}`)) {
      return setError("Too many reset emails were sent. Please wait a few minutes and try again.");
    }
    if (error && /fetch|network/i.test(error.message)) {
      return setError("Network problem. Check your connection and try again.");
    }
    setSent(true);
  }

  return (
    <AuthLayout line="Your account, kept safe.">
      <PageMeta title="Reset your password | HealingNet" description="Get a link to choose a new password for your HealingNet account." noindex />
      <div className={authCard}>
        {sent ? (
          <div className="space-y-4" role="status">
            <MailCheck className="h-10 w-10 text-primary" aria-hidden />
            <h1 className="text-[2rem] md:text-[2.5rem]">Check your email</h1>
            <p className="text-base text-muted-foreground">
              If <span className="font-semibold text-foreground">{email.trim()}</span> has a HealingNet account, we've sent a link to choose a new password. It can take a few minutes; check your spam folder too.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setSent(false)}>Use a different email</Button>
            <p className="text-center text-base"><Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">Back to sign in</Link></p>
          </div>
        ) : (
          <form onSubmit={handle} className="space-y-4">
            <h1 className="text-[2rem] md:text-[2.5rem]">Forgot your password?</h1>
            <p className="text-base text-muted-foreground">Enter your email and we'll send you a link to choose a new one.</p>
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email">Email</Label>
              <Input id="forgot-email" type="email" autoComplete="email" className={authInput} value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" className={authPrimary} disabled={loading}>{loading ? "Sending…" : "Send reset link"}</Button>
            <p className="text-center text-base"><Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">Back to sign in</Link></p>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
