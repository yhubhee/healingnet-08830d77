import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Heart, User, Building2, Stethoscope } from "lucide-react";

type Role = "patient" | "hospital" | "doctor";

export default function Signup() {
  const [params] = useSearchParams();
  const [role, setRole] = useState<Role | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalAddress, setHospitalAddress] = useState("");
  const [hospitalPhone, setHospitalPhone] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [plan, setPlan] = useState<"emr" | "telemedicine">((params.get("plan") as any) || "emr");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setLoading(true);
    const { data: signUp, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { first_name: firstName, last_name: lastName, role, specialty },
      },
    });
    if (error || !signUp.user) {
      setLoading(false);
      return toast({ title: "Signup failed", description: error?.message || "Try again", variant: "destructive" });
    }

    if (role === "hospital") {
      // Ensure session is established before calling the RPC (auto-confirm signups)
      if (!signUp.session) {
        await supabase.auth.signInWithPassword({ email, password });
      }
      const { error: hErr } = await supabase.rpc("create_hospital_with_admin" as any, {
        _name: hospitalName,
        _address: hospitalAddress,
        _phone: hospitalPhone,
        _email: email,
        _first_name: firstName,
        _last_name: lastName,
        _plan: plan,
      });
      if (hErr) {
        setLoading(false);
        return toast({ title: "Hospital creation failed", description: hErr.message, variant: "destructive" });
      }
      toast({ title: "Welcome to HealingNet!", description: "Your hospital is ready." });
      setLoading(false);
      navigate("/hospital");
    } else if (role === "doctor") {
      toast({ title: "Doctor account created!", description: "Welcome to HealingNet." });
      setLoading(false);
      navigate("/doctor");
    } else {
      toast({ title: "Account created!", description: "Welcome to HealingNet." });
      setLoading(false);
      navigate("/patient");
    }
  }

  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-card to-background">
        <div className="w-full max-w-2xl">
          <Link to="/" className="flex items-center gap-2 justify-center mb-8 font-heading font-bold text-2xl">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary-foreground" fill="currentColor" />
            </div>
            HealingNet
          </Link>
          <h1 className="text-3xl font-heading font-bold text-center mb-2">Get started with HealingNet</h1>
          <p className="text-muted-foreground text-center mb-8">Choose how you'll use the platform</p>
          <div className="grid md:grid-cols-3 gap-4">
            <button onClick={() => setRole("patient")} className="bg-card border-2 border-border hover:border-primary rounded-2xl p-6 text-left transition-colors">
              <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center mb-4"><User className="w-6 h-6 text-info" /></div>
              <h3 className="font-heading font-bold text-lg mb-1">I'm a Patient</h3>
              <p className="text-sm text-muted-foreground">Book appointments, view records & message doctors. Free forever.</p>
            </button>
            <button onClick={() => setRole("doctor")} className="bg-card border-2 border-border hover:border-primary rounded-2xl p-6 text-left transition-colors">
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center mb-4"><Stethoscope className="w-6 h-6 text-success" /></div>
              <h3 className="font-heading font-bold text-lg mb-1">I'm a Doctor</h3>
              <p className="text-sm text-muted-foreground">Manage your patients, prescriptions & telemedicine consults.</p>
            </button>
            <button onClick={() => setRole("hospital")} className="bg-card border-2 border-border hover:border-primary rounded-2xl p-6 text-left transition-colors">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4"><Building2 className="w-6 h-6 text-primary" /></div>
              <h3 className="font-heading font-bold text-lg mb-1">I represent a Hospital</h3>
              <p className="text-sm text-muted-foreground">Set up your hospital, choose a plan & onboard your team.</p>
            </button>
          </div>
          <p className="text-sm text-center mt-6 text-muted-foreground">
            Already have an account? <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

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
          <button onClick={() => setRole(null)} className="text-sm text-muted-foreground hover:text-foreground mb-4">← Change role</button>
          <h1 className="text-2xl font-heading font-bold mb-1">{role === "hospital" ? "Create your hospital account" : role === "doctor" ? "Create your doctor account" : "Create your patient account"}</h1>
          <p className="text-muted-foreground text-sm mb-6">{role === "hospital" ? "Set up your hospital in under 2 minutes" : role === "doctor" ? "Join the network and reach more patients" : "Free forever — no credit card needed"}</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></div>
              <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} required /></div>
            </div>
            <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><Label>Password</Label><Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
            {role === "doctor" && (
              <div><Label>Specialty</Label><Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g., Cardiology" required /></div>
            )}
            {role === "hospital" && (
              <>
                <div className="border-t border-border pt-4 mt-4">
                  <h3 className="font-heading font-bold mb-3 text-sm">Hospital details</h3>
                  <div className="space-y-3">
                    <div><Label>Hospital name</Label><Input value={hospitalName} onChange={(e) => setHospitalName(e.target.value)} required /></div>
                    <div><Label>Address</Label><Input value={hospitalAddress} onChange={(e) => setHospitalAddress(e.target.value)} /></div>
                    <div><Label>Phone</Label><Input value={hospitalPhone} onChange={(e) => setHospitalPhone(e.target.value)} /></div>
                  </div>
                </div>
                <div>
                  <Label>Choose your plan</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {(["emr", "telemedicine"] as const).map((p) => (
                      <button key={p} type="button" onClick={() => setPlan(p)}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${plan === p ? "border-primary bg-primary/5" : "border-border"}`}>
                        <div className="font-heading font-bold text-sm">{p === "emr" ? "EMR Essentials" : "Telemedicine Suite"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{p === "emr" ? "₦75K/mo" : "₦150K/mo"}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Creating account…" : "Create Account"}</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
