import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Clock, Heart } from "lucide-react";

/**
 * Payment is confirmed by the Paystack webhook — never by this redirect.
 * We only watch the hospital record until the webhook flips it to active.
 */
export default function ConfirmingPayment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const hospitalId = params.get("hospital");
  const [status, setStatus] = useState<string>("pending");
  const [plan, setPlan] = useState<string>("none");
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!hospitalId) return;
    let cancelled = false;

    const check = async () => {
      const { data } = await supabase
        .from("hospitals")
        .select("active_plan, subscription_status")
        .eq("id", hospitalId)
        .maybeSingle();
      if (cancelled || !data) return;
      setStatus((data as any).subscription_status);
      setPlan((data as any).active_plan);
      if ((data as any).subscription_status === "active") {
        setTimeout(() => navigate("/hospital"), 1500);
      }
    };

    void check();
    const poll = setInterval(() => {
      setElapsed((e) => e + 5);
      void check();
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [hospitalId, navigate]);

  const active = status === "active";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-card to-background">
      <div className="w-full max-w-md text-center">
        <Link to="/" className="flex items-center gap-2 justify-center mb-8 font-heading font-bold text-2xl">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-info flex items-center justify-center">
            <Heart className="w-5 h-5 text-primary-foreground" fill="currentColor" />
          </div>
          HealingNet
        </Link>
        <div className="bg-card border border-border rounded-2xl p-10">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            {active ? <CheckCircle2 className="w-8 h-8 text-success" /> : <Loader2 className="w-8 h-8 text-primary animate-spin" />}
          </div>
          <h1 className="text-2xl font-heading font-bold mb-2">
            {active ? "Payment confirmed" : "Confirming your payment…"}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {active
              ? `Your ${plan === "telemedicine" ? "Telemedicine Suite" : "EMR Essentials"} plan is now active. Taking you to your dashboard…`
              : "We're waiting for Paystack to confirm the transaction. This usually takes a few seconds — you can safely keep this page open."}
          </p>

          {!active && elapsed >= 60 && (
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-2 mb-4">
              <Clock className="w-4 h-4" />
              Still pending. If you completed payment, it will activate shortly.
            </div>
          )}

          <Button variant={active ? "default" : "outline"} onClick={() => navigate("/hospital")} className="w-full">
            {active ? "Go to dashboard" : "Continue to dashboard"}
          </Button>
        </div>
      </div>
    </div>
  );
}
