// Printable prescription (A4 or phone width), shared by patient, doctor and hospital.
// Reads rx_document(), which only answers the patient, the prescriber and hospital staff.
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QrCode } from "@/components/rx/QrCode";
import { friendlyError } from "@/lib/errors";
import { ageGender, fmtDate, NOT_VALID_TEXT, prescriberName, rxStatusLabel, verifyUrl, type RxPayload } from "@/lib/pharmacy";

export default function RxPrint() {
  const { documentId } = useParams<{ documentId: string }>();
  const navigate = useNavigate();
  const { data: doc, isLoading, isError, error, refetch } = useQuery({
    enabled: !!documentId,
    queryKey: ["rx-document", documentId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rx_document", { p_document_id: documentId! });
      if (error) throw error;
      return data as unknown as RxPayload;
    },
    meta: { inlineError: true },
  });

  useEffect(() => {
    const prev = document.title;
    document.title = doc?.code ? `Prescription ${doc.code} | HealingNet` : "Prescription | HealingNet";
    return () => { document.title = prev; };
  }, [doc?.code]);

  const toolbar = (
    <div className="mx-auto mb-4 flex max-w-[210mm] items-center justify-between gap-2 print:hidden">
      <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" aria-hidden />Back</Button>
      {doc && <Button onClick={() => window.print()}><Printer className="h-4 w-4" aria-hidden />Print</Button>}
    </div>
  );

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" aria-hidden />Loading prescription…</div>;
  }
  if (isError || !doc) {
    return (
      <div className="min-h-screen p-4">
        {toolbar}
        <div className="mx-auto max-w-md space-y-3 rounded-xl border border-destructive/40 bg-destructive/10 p-5 text-center text-sm">
          <p>{friendlyError(error, "We couldn't load this prescription.")}</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      </div>
    );
  }

  const p = doc.prescriber ?? {};
  const items = doc.items ?? [];
  const ag = ageGender(doc.patient?.date_of_birth, doc.patient?.gender);
  const origin = window.location.origin;

  return (
    <div className="min-h-screen bg-background p-3 sm:p-6 print:bg-white print:p-0">
      <style>{`@media print { @page { size: A4; margin: 14mm; } html, body { background: #fff !important; } }`}</style>
      {toolbar}
      <article className="mx-auto max-w-[210mm] rounded-lg bg-white p-5 text-[13px] leading-relaxed text-neutral-900 shadow-lg sm:p-10 print:rounded-none print:p-0 print:shadow-none" data-testid="rx-print">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-neutral-900 pb-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">{p.hospital_name || doc.hospital_name || "Hospital"}</h1>
            {p.hospital_address && <p className="break-words">{p.hospital_address}</p>}
            {p.hospital_phone && <p>{p.hospital_phone}</p>}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Prescription</p>
            <p className="font-mono text-lg font-bold tracking-wider">{doc.code}</p>
            <p className="text-xs">{rxStatusLabel(doc)}</p>
          </div>
        </header>

        <section className="grid gap-4 border-b border-neutral-300 py-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Patient</p>
            <p className="font-semibold">{doc.patient?.name || "—"}</p>
            {ag && <p>{ag}</p>}
          </div>
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Date</p>
            <p className="font-semibold">{fmtDate(doc.issued_at)}</p>
          </div>
        </section>

        <section className="py-4">
          <p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Rx</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[440px] border-collapse text-left">
              <thead>
                <tr className="border-b border-neutral-400 text-xs uppercase text-neutral-500">
                  <th className="py-1.5 pr-2 font-medium">Medicine</th>
                  <th className="py-1.5 pr-2 font-medium">Dose</th>
                  <th className="py-1.5 pr-2 font-medium">How often</th>
                  <th className="py-1.5 pr-2 font-medium">For</th>
                  <th className="py-1.5 font-medium">Refills</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.prescription_id} className="border-b border-neutral-200 align-top">
                    <td className="py-2 pr-2">
                      <span className="font-semibold">{it.drug_name}</span>
                      {it.instructions && <span className="block text-xs italic text-neutral-600">{it.instructions}</span>}
                      {!it.doctor_issued && <span className="block text-xs font-semibold text-amber-700">{NOT_VALID_TEXT}</span>}
                    </td>
                    <td className="py-2 pr-2">{it.dosage || "—"}</td>
                    <td className="py-2 pr-2">{it.frequency || "—"}</td>
                    <td className="py-2 pr-2">{it.duration || "—"}</td>
                    <td className="py-2">{it.refills_allowed ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-wrap items-end justify-between gap-6 border-t border-neutral-300 pt-4">
          <div className="min-w-0 space-y-0.5">
            {doc.signature_data ? (
              <img src={doc.signature_data} alt={`Signature of ${prescriberName(p)}`} className="mb-1 h-16 w-auto max-w-[240px]" data-testid="rx-print-signature" />
            ) : (
              <div className="mb-1 h-16 w-60 border-b border-neutral-400" aria-hidden />
            )}
            <p className="font-semibold">{prescriberName(p)}</p>
            <p>Licence {p.licence_number || "—"}{p.licence_council ? ` · ${p.licence_council}` : ""}</p>
            {p.practice_address && <p className="break-words">{p.practice_address}</p>}
            {p.phone && <p>{p.phone}</p>}
          </div>
          <div className="flex items-center gap-3">
            {doc.code && <QrCode text={verifyUrl(doc.code)} size={120} label={`QR code for prescription ${doc.code}`} />}
          </div>
        </section>

        <footer className="mt-5 border-t border-neutral-300 pt-3 text-xs text-neutral-600">
          {doc.status === "not_valid"
            ? <p>{NOT_VALID_TEXT}.</p>
            : <p>Valid until {fmtDate(doc.expires_at)}. Verify at {origin}/verify</p>}
          <p className="mt-1">Patients pay for medicine at the pharmacy counter. HealingNet never takes payment for medicine.</p>
        </footer>
      </article>
    </div>
  );
}
