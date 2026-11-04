import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Printer, QrCode as QrIcon, Send, Star, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RxStatusBadge } from "@/components/rx/RxDocumentView";
import { QrCode } from "@/components/rx/QrCode";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import {
  fmtDate, fmtDateTime, formatKobo, NOT_VALID_TEXT, OPEN_REQUEST, prescriberName, REQUEST_LABEL, verifyUrl,
  type RxPayload, type RxRequest,
} from "@/lib/pharmacy";
import { MedicineCheck, type CheckResult } from "./MedicineCheck";
import { PharmacyPicker } from "./PharmacyPicker";
import { RatePharmacyDialog } from "./RatePharmacy";

export type PatientRequest = RxRequest & { pharmacies: { name: string } | null };

const REQ_TONE: Record<string, string> = {
  sent: "bg-info/15 text-info", available: "bg-success/15 text-success", partial: "bg-warning/15 text-warning",
  unavailable: "bg-destructive/15 text-destructive", collected: "bg-muted text-muted-foreground", cancelled: "bg-muted text-muted-foreground",
};

export function RxCard({ doc, requests, reviews, checks, profile, onChanged }: {
  doc: RxPayload;
  requests: PatientRequest[];
  reviews: Record<string, number>;
  checks: Record<string, CheckResult>;
  profile: { state?: string | null; city?: string | null } | null | undefined;
  onChanged: () => void;
}) {
  const [qr, setQr] = useState(false);
  const [pick, setPick] = useState(false);
  const [rate, setRate] = useState<PatientRequest | null>(null);
  const [notMe, setNotMe] = useState<string | null>(null);
  const items = doc.items ?? [];
  const dispenses = doc.dispenses ?? [];
  const code = doc.code ?? "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.error("Couldn't copy. Select the code and copy it yourself.");
    }
  }
  async function cancel(r: PatientRequest) {
    const { error } = await supabase.rpc("rx_request_cancel", { p_request_id: r.id });
    if (error) return toast.error(friendlyError(error));
    toast.success("Request cancelled");
    onChanged();
  }
  async function reportNotMe(prescriptionId: string) {
    setNotMe(null);
    const { error } = await supabase.rpc("record_medicine_check", {
      p_prescription_id: prescriptionId, p_result: "suspected_fake", p_details: "Dispense not made by me",
    });
    if (error) return toast.error(friendlyError(error));
    toast.success("Thank you. HealingNet will review this. You can also report to NAFDAC directly.");
    onChanged();
  }

  return (
    <article className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-5" data-testid="rx-card" data-code={code}>
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 font-heading font-bold"><User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />{prescriberName(doc.prescriber)}</p>
          <p className="text-sm text-muted-foreground">{[doc.hospital_name, fmtDate(doc.issued_at)].filter(Boolean).join(" · ")}</p>
        </div>
        <RxStatusBadge doc={doc} />
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <code className="break-all font-mono text-xl font-bold tracking-wider sm:text-2xl" data-testid="rx-code">{code}</code>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={copy}><Copy className="h-4 w-4" aria-hidden />Copy</Button>
          <Button size="sm" variant="outline" onClick={() => setQr(true)}><QrIcon className="h-4 w-4" aria-hidden />Show QR</Button>
        </div>
      </div>
      {doc.status === "not_valid" && <p className="text-sm font-medium text-warning">{NOT_VALID_TEXT}</p>}

      <ul className="divide-y divide-border rounded-lg border border-border">
        {items.map((it) => {
          const done = dispenses.filter((d) => d.prescription_id === it.prescription_id);
          return (
            <li key={it.prescription_id} className="p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{it.drug_name}</p>
                <span className="text-xs text-muted-foreground">{it.status === "cancelled" ? "Cancelled" : `${it.remaining} of ${1 + (it.refills_allowed ?? 0)} left`}</span>
              </div>
              <p className="text-sm text-muted-foreground">{[it.dosage, it.frequency, it.duration].filter(Boolean).join(" · ") || "No dose given"}</p>
              {it.instructions && <p className="text-sm italic text-muted-foreground">“{it.instructions}”</p>}
              {done.map((d, i) => (
                <p key={i} className="mt-1 text-sm" data-testid="rx-dispensed-line">
                  Dispensed at {d.pharmacy} by {d.pharmacist} on {fmtDateTime(d.at)}{d.is_refill ? " (refill)" : ""}.{" "}
                  <button className="font-semibold text-destructive underline-offset-4 hover:underline" onClick={() => setNotMe(it.prescription_id)}>Wasn't me?</button>
                </p>
              ))}
              <MedicineCheck prescriptionId={it.prescription_id} drugName={it.drug_name} last={checks[it.prescription_id] ?? null} onRecorded={onChanged} />
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild><Link to={`/patient/prescriptions/${doc.document_id}/print`}><Printer className="h-4 w-4" aria-hidden />View / print</Link></Button>
        {doc.status === "valid" && <Button onClick={() => setPick(true)}><Send className="h-4 w-4" aria-hidden />Get it from a pharmacy</Button>}
      </div>

      {requests.length > 0 && (
        <section aria-label="Pharmacy requests" className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sent to pharmacies</h4>
          <ul className="space-y-2">
            {requests.map((r) => {
              const name = r.pharmacies?.name ?? "Pharmacy";
              const open = OPEN_REQUEST.includes(r.status);
              return (
                <li key={r.id} className="rounded-lg border border-border p-3 text-sm" data-testid="rx-request">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{name}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", REQ_TONE[r.status])}>{REQUEST_LABEL[r.status]}</span>
                  </div>
                  {(r.price_kobo !== null || r.ready_by) && (
                    <p className="mt-1">{r.price_kobo !== null ? <span className="font-semibold">{formatKobo(r.price_kobo)}</span> : null}{r.price_kobo !== null && r.ready_by ? " · " : ""}{r.ready_by ? `ready ${fmtDateTime(r.ready_by)}` : ""}</p>
                  )}
                  {r.pharmacy_note && <p className="mt-1 break-words text-muted-foreground">{r.pharmacy_note}</p>}
                  {(r.status === "available" || r.status === "partial") && <p className="mt-1 text-xs text-muted-foreground">Pay at the counter when you collect. Show your code: {code}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {open && <Button size="sm" variant="outline" onClick={() => cancel(r)}>Cancel</Button>}
                    {r.status === "collected" && (reviews[r.id] ? (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">You rated {reviews[r.id]} <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden /></span>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setRate(r)}><Star className="h-4 w-4" aria-hidden />Rate this pharmacy</Button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Dialog open={qr} onOpenChange={setQr}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Show this at the pharmacy</DialogTitle>
            <DialogDescription>The pharmacist scans it to check your prescription.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3">
            {code && <QrCode text={verifyUrl(code)} size={240} label={`QR code for prescription ${code}`} />}
            <code className="font-mono text-xl font-bold tracking-wider">{code}</code>
          </div>
        </DialogContent>
      </Dialog>

      {doc.document_id && (
        <PharmacyPicker open={pick} onOpenChange={setPick} documentId={doc.document_id} code={code}
          defaultState={profile?.state} defaultCity={profile?.city} onSent={onChanged} />
      )}
      {rate && (
        <RatePharmacyDialog open={!!rate} onOpenChange={(o) => !o && setRate(null)} requestId={rate.id}
          pharmacyName={rate.pharmacies?.name ?? "this pharmacy"} onRated={onChanged} />
      )}
      <AlertDialog open={!!notMe} onOpenChange={(o) => !o && setNotMe(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Report a dispense you didn't make?</AlertDialogTitle>
            <AlertDialogDescription>HealingNet will review it with the pharmacy. You can also report to NAFDAC directly.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => notMe && reportNotMe(notMe)}>Report it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
