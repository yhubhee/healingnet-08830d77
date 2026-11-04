import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { QueryState } from "@/components/common/QueryState";
import { RxDocumentView, RxStatusBadge } from "@/components/rx/RxDocumentView";
import { DispensePanel } from "@/components/rx/DispensePanel";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  fmtDateTime, formatKobo, nairaToKobo, OPEN_REQUEST, REQUEST_LABEL, useMyPharmacy,
  type RxPayload, type RxRequest,
} from "@/lib/pharmacy";
import { REQUEST_TONE } from "./Requests";

type Reply = "available" | "partial" | "unavailable";
const REPLIES: { id: Reply; label: string }[] = [
  { id: "available", label: "Available" },
  { id: "partial", label: "Partly available" },
  { id: "unavailable", label: "Not available" },
];
const QUICK: { label: string; mins: number }[] = [
  { label: "30 min", mins: 30 },
  { label: "1 hour", mins: 60 },
  { label: "2 hours", mins: 120 },
  { label: "4 hours", mins: 240 },
];

/** Date → value for <input type="datetime-local"> in local time. */
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function PharmacyRequestDetail() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: me } = useMyPharmacy();
  const [showDispense, setShowDispense] = useState(false);
  const [reply, setReply] = useState<Reply>("available");
  const [price, setPrice] = useState("");
  const [readyBy, setReadyBy] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError, error, refetch } = useQuery({
    enabled: !!id,
    queryKey: ["pharmacy", "requests", "detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rx_request_detail", { p_request_id: id! });
      if (error) throw error;
      return data as unknown as { request: RxRequest; document: RxPayload };
    },
    // One read per open: every view by a pharmacy is logged.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    meta: { inlineError: true },
  });

  const req = data?.request;
  const doc = data?.document;
  const open = !!req && OPEN_REQUEST.includes(req.status);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!req) return;
    let kobo: number | null = null;
    if (reply !== "unavailable") {
      kobo = nairaToKobo(price);
      if (kobo === null) return toast.error("Enter the price in naira, e.g. 2,500");
    }
    setBusy(true);
    const { error } = await supabase.rpc("rx_request_respond", {
      p_request_id: req.id,
      p_status: reply,
      p_price_kobo: kobo ?? undefined,
      p_ready_by: reply !== "unavailable" && readyBy ? new Date(readyBy).toISOString() : undefined,
      p_note: note.trim() || undefined,
    });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Reply sent to the patient");
    qc.invalidateQueries({ queryKey: ["pharmacy", "requests"] });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/pharmacy/requests" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" aria-hidden />All requests
      </Link>
      <QueryState isLoading={isLoading} isError={isError} error={error} onRetry={() => refetch()}>
        {req && doc && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-2xl font-bold">Request</h1>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", REQUEST_TONE[req.status])} data-testid="request-status">{REQUEST_LABEL[req.status]}</span>
              <RxStatusBadge doc={doc} />
            </div>
            <p className="text-sm text-muted-foreground">Sent {fmtDateTime(req.created_at)}{doc.code ? ` · Code ${doc.code}` : ""}</p>

            {req.patient_note && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient's note</h3>
                <p className="break-words text-sm">{req.patient_note}</p>
              </div>
            )}
            {req.responded_at && (
              <div className="rounded-xl border border-border bg-card p-4 text-sm">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your reply</h3>
                <p>{REQUEST_LABEL[req.status]}{req.price_kobo !== null ? ` · ${formatKobo(req.price_kobo)}` : ""}{req.ready_by ? ` · ready ${fmtDateTime(req.ready_by)}` : ""}</p>
                {req.pharmacy_note && <p className="mt-1 break-words text-muted-foreground">{req.pharmacy_note}</p>}
              </div>
            )}

            <RxDocumentView doc={doc} />

            {open && (
              <form onSubmit={send} className="space-y-4 rounded-xl border border-border bg-card p-4" aria-labelledby="reply-title">
                <h3 id="reply-title" className="font-heading text-lg font-bold">{req.responded_at ? "Change your reply" : "Reply"}</h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Stock">
                  {REPLIES.map((r) => (
                    <label key={r.id} className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 text-sm", reply === r.id ? "border-primary bg-primary/5" : "border-border")}>
                      <input type="radio" name="reply" value={r.id} checked={reply === r.id} onChange={() => setReply(r.id)} className="accent-primary" />{r.label}
                    </label>
                  ))}
                </div>
                {reply !== "unavailable" && (
                  <>
                    <div className="space-y-1.5">
                      <Label htmlFor="price">Price the patient pays at the counter (₦)</Label>
                      <Input id="price" inputMode="decimal" placeholder="e.g. 2,500" value={price} onChange={(e) => setPrice(e.target.value)} required />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ready">Ready by</Label>
                      <div className="flex flex-wrap gap-2">
                        {QUICK.map((q) => (
                          <Button key={q.label} type="button" size="sm" variant="outline" onClick={() => setReadyBy(toLocalInput(new Date(Date.now() + q.mins * 60_000)))}>In {q.label}</Button>
                        ))}
                      </div>
                      <Input id="ready" type="datetime-local" value={readyBy} onChange={(e) => setReadyBy(e.target.value)} />
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="note">Note for the patient (optional)</Label>
                  <Textarea id="note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={reply === "partial" ? "Which items you have" : ""} />
                </div>
                <Button type="submit" className="h-11 w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Send reply</Button>
              </form>
            )}

            {showDispense && doc.code ? (
              <DispensePanel code={doc.code} doc={doc} onDispensed={() => refetch()} />
            ) : open && me?.member.can_dispense && doc.code ? (
              <Button variant="secondary" className="h-12 w-full text-base" onClick={() => setShowDispense(true)}>Dispense now</Button>
            ) : null}
          </>
        )}
      </QueryState>
    </div>
  );
}
