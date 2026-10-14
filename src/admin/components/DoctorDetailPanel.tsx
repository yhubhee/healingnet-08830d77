import { Skeleton } from "@/components/ui/skeleton";
import { useDoctorDetail } from "../api";
import { fmtDate, fmtDateTime, fmtNum, titleCase } from "../format";
import { ErrorState, Fact, StatusBadge, VerificationBadge } from "./bits";
import { DetailPanel } from "./DetailPanel";
import { CredentialDocuments } from "./Documents";
import { AuditList, DetailHeading } from "./HospitalDetailPanel";
import { ReviewActions } from "./ReviewActions";
import { useDetail } from "./detail-state";
import { LicenceExpiry } from "./LicenceExpiry";

export function DoctorDetailPanel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useDoctorDetail(id);
  const { open } = useDetail();
  const d = q.data;
  const doc = d?.doctor;
  const name = doc ? `${doc.first_name} ${doc.last_name}`.trim() : "";

  return (
    <DetailPanel
      open={!!id} onOpenChange={(o) => !o && onClose()}
      title={doc ? `Dr ${name}` : q.isLoading ? "Loading…" : "Doctor"}
      subtitle={doc && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <VerificationBadge status={doc.verification_status} />
          {doc.specialty && <span className="text-sm text-muted-foreground">{doc.specialty}</span>}
        </div>
      )}
    >
      {q.isLoading && <div className="space-y-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {d && doc && (
        <div className="pb-4">
          {doc.verification_status === "pending_review" && <ReviewActions kind="doctor" id={doc.id} name={`Dr ${name}`} />}
          {doc.verification_status === "rejected" && doc.verification_rejection_reason && (
            <p className="mt-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">Rejected: {doc.verification_rejection_reason}</p>
          )}

          <DetailHeading>Profile</DetailHeading>
          <dl className="grid grid-cols-2 gap-3">
            <Fact label="Email">{doc.email && <a className="text-primary underline-offset-2 hover:underline" href={`mailto:${doc.email}`}>{doc.email}</a>}</Fact>
            <Fact label="Phone">{doc.phone}</Fact>
            <Fact label="Experience">{doc.years_experience != null ? `${doc.years_experience} years` : null}</Fact>
            <Fact label="Available for consults">{doc.is_available == null ? null : doc.is_available ? "Yes" : "No"}</Fact>
            <Fact label="Joined">{fmtDateTime(doc.created_at)}</Fact>
            <Fact label="Submitted for review">{doc.verification_submitted_at ? fmtDateTime(doc.verification_submitted_at) : null}</Fact>
          </dl>

          <DetailHeading>Credentials</DetailHeading>
          <dl className="grid grid-cols-2 gap-3">
            <Fact label="Licence number">{doc.license_number}</Fact>
            <Fact label="Council">{doc.license_council}</Fact>
            <Fact label="Licence expiry"><LicenceExpiry date={doc.license_expiry} /></Fact>
            <Fact label="Current practice">
              {doc.current_practice?.name && [doc.current_practice.name, doc.current_practice.role, doc.current_practice.city].filter(Boolean).join(" · ")}
            </Fact>
            <Fact label="Reference">
              {doc.reference_contact?.name && (
                <>
                  {doc.reference_contact.name}{doc.reference_contact.hospital ? `, ${doc.reference_contact.hospital}` : ""}
                  {doc.reference_contact.phone && <> · <a href={`tel:${doc.reference_contact.phone}`}>{doc.reference_contact.phone}</a></>}
                </>
              )}
            </Fact>
          </dl>

          <DetailHeading>Documents</DetailHeading>
          <CredentialDocuments docs={doc.credential_documents} />

          <DetailHeading>Hospitals</DetailHeading>
          {d.hospitals.length === 0 ? <p className="text-sm text-muted-foreground">Not linked to any hospital.</p> : (
            <ul className="divide-y rounded-xl border text-sm">
              {d.hospitals.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 p-3">
                  <button type="button" className="truncate text-left text-primary underline-offset-2 hover:underline" onClick={() => open("hospital", h.id)}>{h.name}</button>
                  <StatusBadge tone={h.is_active && h.status === "active" ? "good" : "neutral"} label={titleCase(h.is_active ? h.status : "inactive")} />
                </li>
              ))}
            </ul>
          )}

          <DetailHeading>Activity (30 days)</DetailHeading>
          <dl className="grid grid-cols-2 gap-3">
            <Fact label="Consultations">{fmtNum(d.counts.consultations_30d)}</Fact>
            <Fact label="Consult requests">{fmtNum(d.counts.consult_requests_30d)}</Fact>
          </dl>

          <DetailHeading>Audit history</DetailHeading>
          <AuditList items={d.audit} />
          {doc.verification_reviewed_at && <p className="mt-3 text-xs text-muted-foreground">Last reviewed {fmtDate(doc.verification_reviewed_at)}</p>}
        </div>
      )}
    </DetailPanel>
  );
}
