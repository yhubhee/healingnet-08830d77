import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyError } from "@/lib/errors";

const SignaturePad = lazy(() => import("./SignaturePad"));
const MAX_SIGNATURE_CHARS = 70_000;

export type PrescriberDetails = {
  licence_number: string | null;
  licence_council: string | null;
  practice_address: string | null;
  signature_data: string | null;
  ready: boolean;
};

export function usePrescriberDetails() {
  return useQuery({
    queryKey: ["doctor", "prescriber-details"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("my_prescriber_details");
      if (error) throw error;
      return (data as unknown as PrescriberDetails | null) ?? null;
    },
    staleTime: 60_000,
    meta: { inlineError: true },
  });
}

/** Shown on the consultation and Prescriptions pages until the doctor can issue valid documents. */
export function PrescriberReadyBanner() {
  const { data } = usePrescriberDetails();
  if (!data || data.ready) return null;
  const text = !data.signature_data
    ? "Add your signature so pharmacies outside your hospital can accept your prescriptions."
    : "Finish verification and add your licence number so pharmacies outside your hospital can accept your prescriptions.";
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm" role="status" data-testid="prescriber-not-ready">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
      <p className="min-w-0 flex-1">
        {text}{" "}
        <Link to="/doctor/profile#prescription-details" className="font-semibold text-primary underline-offset-4 hover:underline">Prescription details</Link>
      </p>
    </div>
  );
}

/** "Prescription details" card: practice address, signature pad and a preview of what pharmacies see. */
export function PrescriberDetailsCard() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = usePrescriberDetails();
  const [address, setAddress] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => setAddress(data?.practice_address ?? ""), [data?.practice_address]);

  // Scroll here when opened from the "Add your signature" banner.
  useEffect(() => {
    if (window.location.hash === "#prescription-details" && data) {
      document.getElementById("prescription-details")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [data]);

  async function save(signature?: string) {
    if (signature && signature.length > MAX_SIGNATURE_CHARS) {
      return toast.error("That signature is too detailed to save. Clear it and sign again, a little simpler.");
    }
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSaving(false);
      return toast.error("Please sign in again.");
    }
    const patch: { practice_address: string | null; signature_data?: string } = { practice_address: address.trim().slice(0, 300) || null };
    if (signature) patch.signature_data = signature;
    const { error } = await supabase.from("doctors").update(patch).eq("user_id", auth.user.id);
    setSaving(false);
    if (error) return toast.error(friendlyError(error));
    toast.success(signature ? "Signature saved" : "Practice address saved");
    setDrawing(false);
    qc.invalidateQueries({ queryKey: ["doctor", "prescriber-details"] });
  }

  return (
    <section id="prescription-details" className="scroll-mt-20 rounded-xl border border-border bg-card p-5 lg:col-span-2" aria-labelledby="rxd-title">
      <h3 id="rxd-title" className="mb-1 font-heading font-bold">Prescription details</h3>
      <p className="mb-4 text-sm text-muted-foreground">Printed on every prescription you write, so pharmacies outside your hospital can check and accept it.</p>
      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Loading…</div>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">Couldn't load your details. <button className="font-semibold text-primary underline" onClick={() => refetch()}>Try again</button></p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <Label htmlFor="practice-address">Practice address</Label>
              <Input id="practice-address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={300} placeholder="Leave empty to use your hospital's address" />
              <Button type="submit" variant="outline" disabled={saving || address.trim() === (data?.practice_address ?? "")}>Save address</Button>
            </form>
            <div className="space-y-2">
              <p className="text-sm font-medium">Signature</p>
              {drawing ? (
                <Suspense fallback={<div className="h-[150px] animate-pulse rounded-lg bg-muted" />}>
                  <SignaturePad onSave={(s) => save(s)} saving={saving} />
                </Suspense>
              ) : (
                <Button type="button" variant="outline" onClick={() => setDrawing(true)}>{data?.signature_data ? "Draw a new signature" : "Add your signature"}</Button>
              )}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm" data-testid="prescriber-preview">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">What pharmacies see</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-muted-foreground">Licence</dt><dd className="font-medium">{[data?.licence_number, data?.licence_council].filter(Boolean).join(" · ") || "Not added yet"}</dd>
              <dt className="text-muted-foreground">Address</dt><dd className="break-words font-medium">{data?.practice_address || "Your hospital's address"}</dd>
            </dl>
            {data?.signature_data ? (
              <img src={data.signature_data} alt="Your saved signature" className="mt-3 h-16 w-auto max-w-full rounded bg-white p-1" />
            ) : (
              <p className="mt-3 text-muted-foreground">No signature saved.</p>
            )}
            <p className={`mt-3 flex items-center gap-1.5 font-medium ${data?.ready ? "text-success" : "text-warning"}`}>
              {data?.ready ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
              {data?.ready ? "Ready: pharmacies can accept your prescriptions" : "Not ready yet: needs verification, a licence number and a signature"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
