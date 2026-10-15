import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { User, Building2, Stethoscope, Gift, CreditCard, Check } from "lucide-react";
import { RoleFields, detailsToData, emptyDetails, type Role, type SignupDetails } from "@/components/auth/RoleFields";
import { usePlanPrices, priceNaira, formatNaira } from "@/hooks/usePlanPrices";
import { paystackService } from "@/services/paystack";
import { saveNext, destinationAfterLogin } from "@/lib/safeNext";
import { cn } from "@/lib/utils";
import { PageMeta } from "@/components/landing/PageMeta";
import { AuthLayout, authCard, authInput, authPrimary } from "@/components/marketing/AuthLayout";

function signupErrorMessage(message?: string) {
  if (message && /already (registered|exists)/i.test(message)) return "An account with this email already exists. Try signing in instead.";
  if (message && /password/i.test(message)) return "Choose a stronger password (at least 6 characters).";
  return "We couldn't create your account. Please check your details and try again.";
}

const ROLES: Role[] = ["patient", "doctor", "hospital"];

export default function Signup() {
  const [params] = useSearchParams();
  // ?role= pre-selects the role (from the public site's buttons); the flow is unchanged.
  const [role, setRole] = useState<Role | null>(() => {
    const r = params.get("role") as Role | null;
    return r && ROLES.includes(r) ? r : null;
  });
  const [details, setDetails] = useState<SignupDetails>(emptyDetails());
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<"emr" | "telemedicine">((params.get("plan") as any) === "telemedicine" ? "telemedicine" : "emr");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data: prices } = usePlanPrices();

  // ?next= (validated) is kept for the first sign-in; auth redirect URLs stay unchanged.
  useEffect(() => saveNext(params.get("next")), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setLoading(true);

    // One call: a database trigger creates the patient, doctor or hospital records
    // (including the hospital's 30-day EMR trial) from this metadata.
    const { data: signUp, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: { role, ...detailsToData(role, details) },
      },
    });

    if (error || !signUp.user) {
      setLoading(false);
      return toast({ title: "Signup failed", description: signupErrorMessage(error?.message), variant: "destructive" });
    }

    if (role === "hospital") {
      // Telemedicine is paid up front; EMR starts on the free trial.
      if (plan === "telemedicine" && signUp.session) {
        try {
          const { authorization_url } = await paystackService.startCheckout({
            purpose: "subscription",
            plan: "telemedicine",
            billing_cycle: "monthly",
            callback_path: "/hospital/confirming-payment",
          });
          window.location.href = authorization_url;
          return;
        } catch {
          setLoading(false);
          toast({
            title: "Account created, payment not started",
            description: "Your 30-day EMR trial has started. You can upgrade to Telemedicine from Settings.",
          });
          return navigate("/hospital");
        }
      }
      setLoading(false);
      toast({ title: "Your 30-day EMR trial has started", description: "Confirm your email, then upgrade any time from Settings." });
      return navigate(signUp.session ? "/hospital" : "/login");
    }

    setLoading(false);
    if (signUp.session) {
      toast({ title: role === "doctor" ? "Doctor account created!" : "Account created!", description: "Welcome to HealingNet." });
      navigate(destinationAfterLogin(role === "doctor" ? "/doctor" : "/patient"));
    } else {
      toast({ title: "Account created!", description: "Check your email to confirm your address, then sign in." });
      navigate("/login");
    }
  }

  const meta = <PageMeta title="Create your account | HealingNet" description="Create a free HealingNet account as a patient or doctor, or start your hospital's 30-day free trial." />;

  if (!role) {
    const roleCards = [
      { id: "patient" as const, icon: User, title: "I'm a Patient", text: "Book appointments, view records & message doctors. Free forever." },
      { id: "doctor" as const, icon: Stethoscope, title: "I'm a Doctor", text: "Manage your patients, prescriptions & telemedicine consults." },
      { id: "hospital" as const, icon: Building2, title: "I represent a Hospital", text: "Set up your hospital, choose a plan & onboard your team." },
    ];
    return (
      <AuthLayout wide>
        {meta}
        <h1 className="mb-2 text-[2rem] md:text-[2.75rem]">Get started with HealingNet</h1>
        <p className="mb-8 text-base text-muted-foreground">Choose how you'll use the platform</p>
        <div className="grid gap-4 md:grid-cols-3">
          {roleCards.map((r) => (
            <button key={r.id} onClick={() => setRole(r.id)} className="rounded-3xl border-2 border-border bg-card p-6 text-left transition-colors hover:border-primary focus-visible:border-primary">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10"><r.icon className="h-6 w-6 text-primary" aria-hidden /></span>
              <span className="mb-1 block font-display text-xl font-semibold">{r.title}</span>
              <span className="block text-base text-muted-foreground">{r.text}</span>
            </button>
          ))}
        </div>
        <p className="mt-8 text-center text-base text-muted-foreground">
          Already have an account? <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">Sign in</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout wide={role === "hospital"} photo={role === "doctor" ? "doctor-portrait" : role === "hospital" ? "nurse-tablet" : "mother-baby"}>
      {meta}
      <div className={authCard}>
        <button onClick={() => setRole(null)} className="mb-4 inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">← Change role</button>
        <h1 className="mb-2 text-[2rem] md:text-[2.5rem]">{role === "hospital" ? "Create your hospital account" : role === "doctor" ? "Create your doctor account" : "Create your patient account"}</h1>
        <p className="mb-6 text-base text-muted-foreground">{role === "hospital" ? "Set up your hospital in under 2 minutes" : role === "doctor" ? "Join the network and reach more patients" : "Free forever — no credit card needed"}</p>
        <form onSubmit={handleSubmit} className="space-y-4 [&_input]:h-12 [&_input]:rounded-2xl [&_input]:text-base">
          <div className="space-y-1.5"><Label htmlFor="signup-email">Email</Label><Input id="signup-email" type="email" autoComplete="email" className={authInput} value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label htmlFor="signup-password">Password</Label><Input id="signup-password" type="password" autoComplete="new-password" minLength={6} className={authInput} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <RoleFields role={role} value={details} onChange={setDetails} />
          {role === "hospital" && (
            <fieldset>
              <legend className="text-sm font-medium">Choose your plan</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {(["emr", "telemedicine"] as const).map((p) => {
                  const selected = plan === p;
                  return (
                    <button key={p} type="button" onClick={() => setPlan(p)} aria-pressed={selected}
                      className={cn("relative rounded-3xl border-2 p-5 text-left transition-colors", selected ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/50")}>
                      {selected && <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground"><Check className="h-4 w-4" aria-hidden /></span>}
                      <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        {p === "emr" ? <Gift className="h-5 w-5" aria-hidden /> : <CreditCard className="h-5 w-5" aria-hidden />}
                      </span>
                      <span className="block font-semibold">{p === "emr" ? "Free trial (EMR Essentials, 30 days)" : "Skip the trial: Telemedicine Suite"}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {p === "emr"
                          ? `No card needed. Then ${formatNaira(priceNaira(prices, "emr", "monthly"))}/mo if you subscribe.`
                          : `${formatNaira(priceNaira(prices, "telemedicine", "monthly"))}/mo, pay now through Paystack. Includes video visits.`}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}
          <Button type="submit" className={authPrimary} disabled={loading}>{loading ? "Creating account…" : role === "hospital" && plan === "telemedicine" ? "Create Account & Pay" : role === "hospital" ? "Start free trial" : "Create Account"}</Button>
        </form>
        <p className="mt-6 text-center text-base text-muted-foreground">
          Already have an account? <Link to="/login" className="font-semibold text-primary underline-offset-4 hover:underline">Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
