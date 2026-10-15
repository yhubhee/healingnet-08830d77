import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { friendlyError } from "@/lib/errors";
import { PageMeta } from "@/components/landing/PageMeta";
import { AuthLayout, authCard, authInput, authPrimary } from "@/components/marketing/AuthLayout";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast({ title: "Failed", description: friendlyError(error), variant: "destructive" });
    toast({ title: "Password updated" });
    navigate("/login");
  }
  return (
    <AuthLayout line="Your account, kept safe.">
      <PageMeta title="Set a new password | HealingNet" description="Choose a new password for your HealingNet account." noindex />
      <form onSubmit={handle} className={`${authCard} space-y-4`}>
        <h1 className="text-[2rem] md:text-[2.5rem]">Set new password</h1>
        <div className="space-y-1.5"><Label htmlFor="new-password">New password</Label><Input id="new-password" type="password" autoComplete="new-password" minLength={6} className={authInput} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <Button type="submit" className={authPrimary} disabled={loading}>Update Password</Button>
      </form>
    </AuthLayout>
  );
}
