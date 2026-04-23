import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

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
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Password updated" });
    navigate("/login");
  }
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handle} className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 space-y-4">
        <h1 className="text-2xl font-heading font-bold">Set new password</h1>
        <div><Label>New password</Label><Input type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <Button type="submit" className="w-full" disabled={loading}>Update Password</Button>
      </form>
    </div>
  );
}
