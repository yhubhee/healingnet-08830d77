import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ShareCode {
  code: string;
  expiresAt: number;
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** "Share my records with a hospital": a one-time code that expires after 15 minutes. */
export function ShareRecordsCard() {
  const [share, setShare] = useState<ShareCode | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!share) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [share]);

  async function getCode() {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_patient_share_code");
    setBusy(false);
    const row = Array.isArray(data) ? data[0] : data;
    if (error || !row?.code) {
      toast.error(/too many codes/i.test(error?.message ?? "") ? "You've asked for too many codes. Please try again in a little while." : "We couldn't create a code. Please try again.");
      return;
    }
    setNow(Date.now());
    setShare({ code: row.code, expiresAt: new Date(row.expires_at).getTime() });
  }

  const remaining = share ? share.expiresAt - now : 0;
  const expired = !!share && remaining <= 0;

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold">Share my records with a hospital</h3>
          <p className="text-sm text-muted-foreground mb-3">Show this code at the front desk. It works once and expires in 15 minutes.</p>

          {share && !expired ? (
            <div className="mb-3">
              <div className="font-mono text-3xl md:text-4xl font-bold tracking-[0.3em] select-all">{share.code}</div>
              <div className="text-sm text-muted-foreground mt-1">Expires in {formatRemaining(remaining)}</div>
            </div>
          ) : expired ? (
            <p className="text-sm text-destructive mb-3">This code has expired.</p>
          ) : null}

          <Button onClick={getCode} disabled={busy} variant={share && !expired ? "outline" : "default"} size="sm">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {share ? "Get a new code" : "Get a code"}
          </Button>
        </div>
      </div>
    </div>
  );
}
