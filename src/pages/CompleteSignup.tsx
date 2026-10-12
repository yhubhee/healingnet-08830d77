import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Heart, User, Building2, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RoleFields, detailsToData, emptyDetails, type Role, type SignupDetails } from "@/components/auth/RoleFields";
import { routeForUser } from "@/lib/roles";
import { friendlyError } from "@/lib/errors";

const ROLES: { id: Role; title: string; blurb: string; icon: typeof User }[] = [
  { id: "patient", title: "Patient", blurb: "Book appointments and view your records.", icon: User },
  { id: "doctor", title: "Doctor", blurb: "Manage patients, prescriptions and consults.", icon: Stethoscope },
  { id: "hospital", title: "Hospital", blurb: "Set up your hospital. Includes a 30-day EMR trial.", icon: Building2 },
];

/** For signed-in users with no profile yet (e.g. first Google sign-in): pick a role and finish setup. */
export default function CompleteSignup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [role, setRole] = useState<Role | null>(null);
  const [details, setDetails] = useState<SignupDetails>(emptyDetails());
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) return navigate("/login", { replace: true });
      // Already has a profile? Go straight to the right dashboard.
      const dest = await routeForUser(user.id);
      if (dest !== "/complete-signup") return navigate(dest, { replace: true });
      const meta = (user.user_metadata ?? {}) as Record<string, any>;
      const full = String(meta.full_name ?? meta.name ?? "").trim();
      const [first = "", ...rest] = full.split(" ");
      setDetails((d) => ({ ...d, first_name: meta.given_name ?? first, last_name: meta.family_name ?? rest.join(" ") }));
      setChecking(false);
    })();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setLoading(true);
    const { error } = await supabase.rpc("complete_signup", { p_role: role, p_data: detailsToData(role, details) });
    if (error) {
      setLoading(false);
      return toast({ title: "Couldn't finish setup", description: friendlyError(error), variant: "destructive" });
    }
    const { data } = await supabase.auth.getUser();
    const dest = data.user ? await routeForUser(data.user.id) : "/login";
    setLoading(false);
    if (role === "hospital") toast({ title: "Your 30-day EMR trial has started", description: "You can upgrade any time from Settings." });
    navigate(dest === "/complete-signup" ? "/login" : dest, { replace: true });
  }

  if (checking) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-card to-background">
      <div className="w-full max-w-lg">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8 font-heading font-bold text-2xl">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary-foreground" fill="currentColor" />
          </div>
          HealingNet
        </Link>
        <div className="bg-card border border-border rounded-2xl p-8">
          <h1 className="text-2xl font-heading font-bold mb-1">Finish setting up</h1>
          <p className="text-muted-foreground text-sm mb-6">Tell us how you'll use HealingNet.</p>
          <div className="grid grid-cols-3 gap-2 mb-6">
            {ROLES.map(({ id, title, blurb, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setRole(id)} title={blurb}
                className={`p-3 rounded-xl border-2 text-center transition-colors ${role === id ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
                <Icon className="w-5 h-5 mx-auto mb-1 text-primary" />
                <div className="font-heading font-bold text-sm">{title}</div>
              </button>
            ))}
          </div>
          {role && (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-xs text-muted-foreground">{ROLES.find((r) => r.id === role)?.blurb}</p>
              <RoleFields role={role} value={details} onChange={setDetails} />
              <Button type="submit" className="w-full" disabled={loading}>{loading ? "Saving…" : "Continue"}</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
