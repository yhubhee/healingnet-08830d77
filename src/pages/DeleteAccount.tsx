// /delete-account: public page that explains account deletion (Google Play asks for a web
// link). Signed-in patients can delete their account here; the mobile app has the same flow.
import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/landing/PageShell";
import { PageMeta } from "@/components/landing/PageMeta";
import { SUPPORT_EMAIL } from "@/components/marketing/content";

const FALLBACK = "We couldn't delete your account. Please try again.";

/** The function's own message (e.g. why a doctor account can't be deleted here), when it sent one. */
async function functionMessage(error: unknown): Promise<string> {
  try {
    const res = (error as { context?: Response } | null)?.context;
    if (res && typeof res.json === "function") {
      const body = await res.json();
      if (typeof body?.error === "string" && body.error) return body.error;
    }
  } catch {
    /* fall through */
  }
  return FALLBACK;
}

export default function DeleteAccount() {
  const { user, loading } = useAuth();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ held: boolean } | null>(null);
  const confirmed = typed.trim() === "DELETE";

  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!confirmed) return;
    setError(null);
    setBusy(true);
    const { data, error: fnError } = await supabase.functions.invoke("delete-account", { body: {} });
    if (fnError || !data?.deleted) {
      setBusy(false);
      setError(fnError ? await functionMessage(fnError) : FALLBACK);
      return;
    }
    // The login no longer exists; remove the saved session from this browser.
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    setBusy(false);
    setDone({ held: !!data.held_by_hospitals });
  }

  return (
    <PageShell>
      <PageMeta title="Delete your account | HealingNet" description="How to delete your HealingNet patient account and what happens to your data." />
      <article className="mk-container max-w-3xl py-12 md:py-20">
        <h1>Delete your account</h1>

        {done ? (
          <div className="mt-8 space-y-4 rounded-3xl border border-border bg-card p-6" role="status">
            <CheckCircle2 className="h-10 w-10 text-primary" aria-hidden />
            <h2 className="text-[1.6rem]">Your account is deleted</h2>
            <p className="text-base text-muted-foreground">
              {done.held
                ? "Your login, contact details, devices and notifications are deleted. Hospitals you visited keep their own medical records about you, as the law requires; they are no longer linked to an account."
                : "Your login and your data are deleted."}
            </p>
            <Button asChild variant="outline"><Link to="/">Back to the home page</Link></Button>
          </div>
        ) : (
          <>
            <div className="mt-8 space-y-4 text-base text-muted-foreground">
              <h2 className="text-[1.6rem] text-foreground">What happens</h2>
              <p>
                Your login, contact details, devices and notifications are deleted. Appointments that are still open are cancelled. If you have been a patient at a hospital on HealingNet, that hospital keeps its medical records about you, as the law requires; they are no longer linked to an account.
              </p>
              <p>This can't be undone. You can also delete your account in the HealingNet app: Me, then Delete my account.</p>
              <p>
                Doctor, hospital, pharmacy and admin accounts are closed through HealingNet support:{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary underline">{SUPPORT_EMAIL}</a>.
              </p>
            </div>

            <div className="mt-8 rounded-3xl border border-border bg-card p-6">
              {loading ? (
                <p className="flex items-center gap-2 text-muted-foreground" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Checking if you're signed in…</p>
              ) : !user ? (
                <div className="space-y-3">
                  <p className="text-base text-muted-foreground">Sign in first, so we know which account to delete.</p>
                  <Button asChild className="h-12 rounded-2xl px-6 text-base"><Link to="/login?next=/delete-account">Sign in to delete your account</Link></Button>
                </div>
              ) : (
                <form onSubmit={remove} className="space-y-4">
                  <p className="text-base text-muted-foreground">Signed in as <span className="font-semibold text-foreground">{user.email}</span>.</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="delete-confirm">Type DELETE to confirm</Label>
                    <Input id="delete-confirm" className="h-12 max-w-xs rounded-2xl text-base" autoComplete="off" autoCapitalize="characters"
                      value={typed} onChange={(e) => setTyped(e.target.value)} aria-describedby={error ? "delete-error" : undefined} />
                  </div>
                  {error && <p id="delete-error" className="text-sm text-destructive" role="alert">{error}</p>}
                  <Button type="submit" variant="destructive" className="h-12 rounded-2xl px-6 text-base" disabled={!confirmed || busy}>
                    {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="mr-2 h-4 w-4" aria-hidden />}
                    {busy ? "Deleting…" : "Delete my account"}
                  </Button>
                </form>
              )}
            </div>
          </>
        )}
      </article>
    </PageShell>
  );
}
