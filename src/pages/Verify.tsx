// Public prescription check: /verify and /verify/:code. No sign-in needed; the QR on
// every prescription links here. Only rx_verify's own answer is shown: drugs and
// patient details appear only when the database returns full === true (a verified
// pharmacist who may dispense, or the patient). The code is never logged.
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Camera, Heart, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RxDocumentView, RxPrescriberFacts, RxVerdict } from "@/components/rx/RxDocumentView";
import { DispensePanel } from "@/components/rx/DispensePanel";
import { useAuth } from "@/hooks/useAuth";
import { useMyPharmacy, type RxPayload } from "@/lib/pharmacy";

const QrScanner = lazy(() => import("@/components/rx/QrScanner"));

/** Tidy what was typed for the URL; the database accepts any case and spacing. */
const tidy = (s: string) => s.toUpperCase().replace(/[^0-9A-Z-]/g, "");

/** While mounted: no indexing, and no Referer (the URL holds the code). */
function usePrivatePage() {
  useEffect(() => {
    const prev = document.title;
    document.title = "Check a prescription | HealingNet";
    const add = (name: string, content: string) => {
      const m = document.createElement("meta");
      m.name = name;
      m.content = content;
      document.head.appendChild(m);
      return m;
    };
    const metas = [add("robots", "noindex, nofollow"), add("referrer", "no-referrer")];
    return () => {
      document.title = prev;
      metas.forEach((m) => m.remove());
    };
  }, []);
}

export default function Verify() {
  usePrivatePage();
  const { code: raw } = useParams<{ code?: string }>();
  const code = raw ? tidy(decodeURIComponent(raw)) : "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const { data: me } = useMyPharmacy(!!user);
  const [input, setInput] = useState(code);
  const [scan, setScan] = useState(false);
  useEffect(() => setInput(code), [code]);

  const { data: doc, isFetching, isError, refetch } = useQuery({
    enabled: !!code && !authLoading,
    queryKey: ["rx-verify", code, user?.id ?? "anon"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rx_verify", { p_code: code });
      if (error) throw error;
      return data as unknown as RxPayload;
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    retry: 1,
    meta: { inlineError: true },
  });

  const go = (c: string) => {
    const t = tidy(c);
    if (t) navigate(`/verify/${encodeURIComponent(t)}`, { replace: !!code });
  };
  const onScan = useCallback((c: string) => {
    setScan(false);
    const t = tidy(c);
    if (t) navigate(`/verify/${encodeURIComponent(t)}`);
  }, [navigate]);

  const isMember = !!me?.member;
  const canDispense = !!me?.member.can_dispense;
  const next = `/verify/${encodeURIComponent(code)}`;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-sidebar px-4 py-3">
        <Link to={isMember ? "/pharmacy" : "/"} className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-info">
            <Heart className="h-4 w-4 text-primary-foreground" fill="currentColor" aria-hidden />
          </span>
          <span className="font-heading text-sm font-bold">HealingNet</span>
        </Link>
        {isMember && (
          <Link to="/pharmacy" className="ml-auto inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden />Pharmacy
          </Link>
        )}
      </header>

      <main className="mx-auto max-w-xl space-y-5 p-4 pb-16">
        <div>
          <h1 className="font-heading text-2xl font-bold">Check a prescription</h1>
          <p className="text-sm text-muted-foreground">Type the code on the prescription, or scan its QR code.</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); go(input); }} className="space-y-2">
          <label htmlFor="rx-code" className="sr-only">Prescription code</label>
          <div className="flex gap-2">
            <Input id="rx-code" value={input} onChange={(e) => setInput(e.target.value)} placeholder="HN-7K4P2-9QWXZ"
              autoCapitalize="characters" autoComplete="off" spellCheck={false} inputMode="text"
              className="h-12 min-w-0 flex-1 font-mono text-lg uppercase tracking-wider" />
            <Button type="submit" className="h-12 shrink-0 px-4" aria-label="Check code"><Search className="h-5 w-5" aria-hidden /><span className="hidden sm:inline">Check</span></Button>
          </div>
          {!scan && (
            <Button type="button" variant="outline" className="h-12 w-full" onClick={() => setScan(true)}>
              <Camera className="h-5 w-5" aria-hidden />Scan QR
            </Button>
          )}
        </form>

        {scan && (
          <Suspense fallback={<div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" aria-hidden /></div>}>
            <QrScanner onResult={onScan} onClose={() => setScan(false)} />
          </Suspense>
        )}

        {code && (isFetching && !doc ? (
          <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" aria-hidden />Checking…</div>
        ) : isError ? (
          <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
            <p>We couldn't check this code. Check your connection and try again.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : doc ? (
          <div className="space-y-4">
            <RxVerdict doc={doc} />
            {doc.status !== "not_found" && (
              <>
                {doc.code && <p className="text-center font-mono text-lg font-bold tracking-wider">{doc.code}</p>}
                {doc.full ? (
                  <>
                    <RxDocumentView doc={doc} />
                    {canDispense && doc.code && (
                      <DispensePanel code={doc.code} doc={doc}
                        onDispensed={(d) => qc.setQueryData(["rx-verify", code, user?.id ?? "anon"], d)} />
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-border bg-card p-4">
                    <RxPrescriberFacts doc={doc} />
                  </div>
                )}
                {!doc.full && (
                  <div className="rounded-xl border border-primary/40 bg-primary/5 p-4 text-sm">
                    {user ? (
                      isMember ? (
                        <p>You can see the medicines once HealingNet has verified you and your pharmacy, and your licence is in date.</p>
                      ) : (
                        <p>Only verified pharmacists and the patient can see the medicines on this prescription.</p>
                      )
                    ) : (
                      <p>
                        Are you a pharmacist?{" "}
                        <Link to={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                          Sign in to see the medicines and dispense
                        </Link>
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        ) : null)}
      </main>
    </div>
  );
}
