import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { routeForUser } from "@/lib/roles";
import { saveNext, destinationAfterLogin } from "@/lib/safeNext";
import { PageMeta } from "@/components/landing/PageMeta";
import { AuthLayout, authCard, authInput, authPrimary, authSecondary } from "@/components/marketing/AuthLayout";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { toast } = useToast();

  useEffect(() => {
    // ?next= (validated) is kept for the first sign-in; auth redirect URLs stay unchanged.
    saveNext(params.get("next"));
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) routeByRole(data.session.user.id);
    });
  }, []);

  async function routeByRole(userId: string) {
    navigate(destinationAfterLogin(await routeForUser(userId)));
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast({ title: "Login failed", description: "Check your email and password and try again.", variant: "destructive" });
    if (data.user) routeByRole(data.user.id);
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/login` } });
  }

  const next = params.get("next");
  return (
    <AuthLayout>
      <PageMeta title="Log in | HealingNet" description="Log in to HealingNet to see your appointments, records and dashboard." />
      <div className={authCard}>
        <h1 className="mb-2 text-[2rem] md:text-[2.5rem]">Welcome back</h1>
        <p className="mb-6 text-base text-muted-foreground">Sign in to continue to your dashboard</p>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="login-email">Email</Label><Input id="login-email" type="email" autoComplete="email" className={authInput} value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label htmlFor="login-password">Password</Label><Input id="login-password" type="password" autoComplete="current-password" className={authInput} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <Button type="submit" className={authPrimary} disabled={loading}>{loading ? "Signing in…" : "Sign In"}</Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />OR<div className="h-px flex-1 bg-border" /></div>
        <Button onClick={handleGoogle} variant="outline" className={authSecondary}>Continue with Google</Button>
        <p className="mt-6 text-center text-base text-muted-foreground">
          Don't have an account? <Link to={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold text-primary underline-offset-4 hover:underline">Sign up</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
