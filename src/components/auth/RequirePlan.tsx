import { ReactNode } from "react";
import { useSubscription, hasPlan } from "@/hooks/useSubscription";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export function RequirePlan({ plan, children }: { plan: "emr" | "telemedicine"; children: ReactNode }) {
  const { data: sub, isLoading } = useSubscription();
  if (isLoading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (hasPlan(sub, plan)) return <>{children}</>;
  return (
    <div className="max-w-2xl mx-auto p-8">
      <div className="bg-card border border-border rounded-2xl p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-heading font-bold mb-2">{sub?.state === "expired" ? "Your plan has expired" : plan === "emr" ? "Choose a plan" : "Upgrade to Telemedicine Suite"}</h2>
        <p className="text-muted-foreground mb-6">
          {sub?.state === "expired"
            ? "Your plan has expired. Renew in Settings to keep using this feature."
            : plan === "emr"
              ? "This feature needs an active plan. Choose one in Settings."
              : "This feature requires the Telemedicine plan. Unlock teleconsultations, doctor marketplace, video calls and advanced analytics."}
        </p>
        <Button asChild>
          <Link to="/hospital/settings"><Sparkles className="w-4 h-4 mr-2" />{sub?.state === "expired" ? "Renew in Settings" : "Go to Settings"}</Link>
        </Button>
      </div>
    </div>
  );
}
