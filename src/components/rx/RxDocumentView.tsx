import { CheckCircle2, CircleSlash, Clock, PackageCheck, ShieldAlert, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ageGender, fmtDate, fmtDateTime, prescriberName, rxStatusLabel, NOT_VALID_TEXT,
  type RxPayload, type RxStatus,
} from "@/lib/pharmacy";

const TONE: Record<RxStatus, string> = {
  valid: "bg-success/15 text-success",
  expired: "bg-destructive/15 text-destructive",
  used: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/15 text-destructive",
  not_valid: "bg-warning/15 text-warning",
  not_found: "bg-destructive/15 text-destructive",
};

export function RxStatusBadge({ doc, className }: { doc: Pick<RxPayload, "status" | "expires_at">; className?: string }) {
  return <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[doc.status], className)}>{rxStatusLabel(doc)}</span>;
}

/** Big, plain result for a busy counter. */
export function RxVerdict({ doc }: { doc: RxPayload }) {
  const map: Record<RxStatus, { icon: typeof CheckCircle2; title: string; sub?: string; cls: string }> = {
    valid: { icon: CheckCircle2, title: "Valid", sub: `Valid until ${fmtDate(doc.expires_at)}`, cls: "border-success/50 bg-success/10 text-success" },
    expired: { icon: Clock, title: "Expired", sub: `Expired on ${fmtDate(doc.expires_at)}`, cls: "border-destructive/50 bg-destructive/10 text-destructive" },
    used: { icon: PackageCheck, title: "Already dispensed", sub: "Every medicine on this prescription has been dispensed.", cls: "border-destructive/50 bg-destructive/10 text-destructive" },
    cancelled: { icon: CircleSlash, title: "Cancelled", sub: "The doctor cancelled this prescription.", cls: "border-destructive/50 bg-destructive/10 text-destructive" },
    not_valid: { icon: ShieldAlert, title: "Not valid outside the hospital", sub: NOT_VALID_TEXT, cls: "border-warning/50 bg-warning/10 text-warning" },
    not_found: { icon: SearchX, title: "Code not found", sub: "Check the code and try again. Codes look like HN-7K4P2-9QWXZ.", cls: "border-destructive/50 bg-destructive/10 text-destructive" },
  };
  const v = map[doc.status] ?? map.not_found;
  const Icon = v.icon;
  return (
    <div className={cn("flex items-center gap-4 rounded-2xl border-2 p-5", v.cls)} role="status" data-testid="rx-verdict">
      <Icon className="h-10 w-10 shrink-0" aria-hidden />
      <div className="min-w-0">
        <p className="font-heading text-2xl font-bold leading-tight">{doc.status === "valid" ? "✅ " : "⛔ "}{v.title}</p>
        {v.sub && <p className="mt-1 text-sm text-foreground/80">{v.sub}</p>}
      </div>
    </div>
  );
}

/** The prescriber block every viewer may see. */
export function RxPrescriberFacts({ doc }: { doc: RxPayload }) {
  const p = doc.prescriber ?? {};
  const rows: [string, string | null | undefined][] = [
    ["Doctor", prescriberName(p)],
    ["Licence", [p.licence_number, p.licence_council].filter(Boolean).join(" · ") || "Not given"],
    ["Hospital", doc.hospital_name ?? p.hospital_name],
    ["Issued", fmtDate(doc.issued_at)],
    ["Expires", fmtDate(doc.expires_at)],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
      {rows.filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="min-w-0 break-words font-medium">{v}</dd></div>
      ))}
    </dl>
  );
}

/** The full document: patient, medicines, prescriber, signature and dispense history. Only for full === true payloads. */
export function RxDocumentView({ doc }: { doc: RxPayload }) {
  if (!doc.full) return null;
  const p = doc.prescriber ?? {};
  const items = doc.items ?? [];
  const dispenses = doc.dispenses ?? [];
  const ag = ageGender(doc.patient?.date_of_birth, doc.patient?.gender);
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient</h3>
        <p className="font-heading text-lg font-bold" data-testid="rx-patient-name">{doc.patient?.name || "—"}</p>
        {ag && <p className="text-sm text-muted-foreground">{ag}</p>}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Medicines</h3>
        <ul className="divide-y divide-border">
          {items.map((it) => (
            <li key={it.prescription_id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">{it.drug_name}</p>
                <span className="text-xs text-muted-foreground">{it.remaining} of {1 + (it.refills_allowed ?? 0)} left</span>
              </div>
              <p className="text-sm text-muted-foreground">{[it.dosage, it.frequency, it.duration].filter(Boolean).join(" · ") || "No dose given"}</p>
              {it.instructions && <p className="mt-1 text-sm italic text-muted-foreground">“{it.instructions}”</p>}
              {!it.doctor_issued && <p className="mt-1 text-xs font-medium text-warning">{NOT_VALID_TEXT}</p>}
            </li>
          ))}
          {items.length === 0 && <li className="text-sm text-muted-foreground">No medicines on this prescription.</li>}
        </ul>
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prescriber</h3>
        <RxPrescriberFacts doc={doc} />
        {(p.practice_address || p.phone) && (
          <p className="mt-2 text-sm text-muted-foreground break-words">{[p.practice_address, p.phone].filter(Boolean).join(" · ")}</p>
        )}
        {doc.signature_data ? (
          <img src={doc.signature_data} alt={`Signature of ${prescriberName(p)}`} className="mt-3 h-16 w-auto max-w-full rounded bg-white p-1" />
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">No signature on file.</p>
        )}
      </section>

      {dispenses.length > 0 && (
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dispensed</h3>
          <ul className="space-y-1.5 text-sm">
            {dispenses.map((d, i) => {
              const drug = items.find((it) => it.prescription_id === d.prescription_id)?.drug_name ?? "Medicine";
              return (
                <li key={i} className="break-words">
                  <span className="font-medium">{drug}</span>{d.is_refill ? " (refill)" : ""}{d.quantity ? `, ${d.quantity}` : ""}: {d.pharmacy}, {d.pharmacist} (PCN {d.pcn_reg_no}), {fmtDateTime(d.at)}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
