// Verifications → Family documents: guardians' proof of relationship, oldest first.
// A document opens through a 5-minute signed URL and is shown in the browser (an image
// inline, a PDF in a new tab). It is never downloaded to a server or saved anywhere else.
// The database logs every decision (admin_review_family_document).
import { useState } from "react";
import { CheckCircle2, ExternalLink, FileImage, FileText, Loader2, PartyPopper, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { relationshipLabel, ageOn } from "@/lib/family";
import { lagosToday } from "@/lib/dates";
import { documentLabel } from "@/lib/verification";
import { signedFamilyDocumentUrl, useFamilyDocuments, useReviewFamilyDocument, type FamilyDocument, type FamilyDocumentStatus } from "../api";
import { actionError, daysSince, fmtDate, fmtDateTime, times } from "../format";
import { EmptyState, ErrorState, Fact, Pager, StatusBadge } from "./bits";
import { ConfirmDialog, ReasonDialog } from "./dialogs";
import { useUrlState } from "./url-state";

/** Reasons the guardian can act on; the guardian sees the one chosen. */
export const FAMILY_REJECT_REASONS = [
  "The names don't match the account",
  "The document is unclear or cut off",
  "This document doesn't show the relationship",
  "The document looks altered",
];

const CHECKLIST = [
  "The names match the member and the guardian",
  "The dates of birth match",
  "It is the right document type for this relationship",
  "It is readable and nothing is cut off",
  "There is no sign of alteration",
];

const isPdf = (path: string) => path.toLowerCase().endsWith(".pdf");
const fullName = (first: string | null, last: string | null) => [first, last].filter(Boolean).join(" ").trim() || "—";

function DocumentCard({ d, status }: { d: FamilyDocument; status: FamilyDocumentStatus }) {
  const review = useReviewFamilyDocument();
  const [opening, setOpening] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const member = fullName(d.member_first_name, d.member_last_name);
  const age = ageOn(d.member_date_of_birth, lagosToday());
  const waited = daysSince(d.submitted_at);

  async function open() {
    setOpening(true);
    try {
      const url = await signedFamilyDocumentUrl(d.storage_path);
      if (isPdf(d.storage_path) || d.storage_path.toLowerCase().endsWith(".heic")) window.open(url, "_blank", "noopener,noreferrer");
      else setImage(url);
    } catch (e) {
      toast.error("Couldn't open the document", { description: actionError(e) });
    } finally {
      setOpening(false);
    }
  }

  async function decide(approve: boolean, reason?: string) {
    try {
      await review.mutateAsync({ id: d.id, approve, reason });
      toast.success(approve ? `${member} verified` : "Document not accepted. The guardian has been told why.");
      setApproving(false);
      setRejecting(false);
    } catch (e) {
      toast.error(approve ? "Couldn't approve" : "Couldn't reject", { description: actionError(e) });
    }
  }

  return (
    <article className="rounded-2xl border bg-card p-4 sm:p-6" data-testid="admin-family-document">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-heading text-lg font-bold">{member}</h3>
          <p className="text-sm text-muted-foreground">{relationshipLabel(d.relationship)} of {fullName(d.guardian_first_name, d.guardian_last_name)}</p>
        </div>
        {status === "pending"
          ? <StatusBadge tone={waited >= 2 ? "bad" : waited >= 1 ? "warn" : "neutral"} label={waited === 0 ? "Waiting less than a day" : `Waiting ${waited} ${waited === 1 ? "day" : "days"}`} />
          : status === "approved" ? <StatusBadge tone="good" label="Approved" icon={CheckCircle2} /> : <StatusBadge tone="bad" label="Rejected" icon={XCircle} />}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Fact label="Member's date of birth">{d.member_date_of_birth ? `${fmtDate(d.member_date_of_birth)}${age !== null ? ` (age ${age < 1 ? "under 1" : age})` : ""}` : null}</Fact>
        <Fact label="Relationship">{relationshipLabel(d.relationship)}</Fact>
        <Fact label="Document type">{documentLabel(d.document_type)}</Fact>
        <Fact label="Guardian">{fullName(d.guardian_first_name, d.guardian_last_name)}</Fact>
        <Fact label="Guardian's email">{d.guardian_email && <a className="text-primary underline-offset-2 hover:underline" href={`mailto:${d.guardian_email}`}>{d.guardian_email}</a>}</Fact>
        <Fact label="Guardian's phone">{d.guardian_phone && <a href={`tel:${d.guardian_phone}`}>{d.guardian_phone}</a>}</Fact>
        <Fact label="Submitted">{fmtDateTime(d.submitted_at)}</Fact>
        <Fact label="Earlier rejections">{String(d.previous_rejections ?? 0)}</Fact>
        {status !== "pending" && <Fact label="Reviewed">{fmtDateTime(d.reviewed_at)}</Fact>}
      </dl>
      {d.reject_reason && <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">Reason given: {d.reject_reason}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" className="gap-2 rounded-xl" onClick={open} disabled={opening}>
          {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : isPdf(d.storage_path) ? <FileText className="h-4 w-4" aria-hidden /> : <FileImage className="h-4 w-4" aria-hidden />}
          Open the document
          {isPdf(d.storage_path) && <><ExternalLink className="h-3.5 w-3.5" aria-hidden /><span className="sr-only">(opens in a new tab)</span></>}
        </Button>
        {status === "pending" && (
          <>
            <Button className="rounded-xl" onClick={() => setApproving(true)} disabled={review.isPending}>Approve</Button>
            <Button variant="outline" className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setRejecting(true)} disabled={review.isPending}>Reject</Button>
          </>
        )}
      </div>

      {status === "pending" && (
        <div className="mt-4 rounded-xl bg-muted/50 p-3">
          <p className="text-xs font-medium">Check before approving</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">{CHECKLIST.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      )}

      <Dialog open={!!image} onOpenChange={(v) => { if (!v) setImage(null); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{documentLabel(d.document_type)}: {member}</DialogTitle>
            <DialogDescription>This link works for 5 minutes. Do not save or share the document.</DialogDescription>
          </DialogHeader>
          {image && <img src={image} alt={`${documentLabel(d.document_type)} for ${member}`} className="max-h-[75vh] w-full rounded-lg bg-muted object-contain" />}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={approving} onOpenChange={setApproving} title={`Approve ${member}?`}
        description={`${fullName(d.guardian_first_name, d.guardian_last_name)} will be able to keep managing ${d.member_first_name}'s care. Other documents waiting for ${d.member_first_name} are withdrawn.`}
        confirmLabel="Approve" busy={review.isPending} onConfirm={() => decide(true)} />
      <ReasonDialog open={rejecting} onOpenChange={setRejecting} title="Reject this document?"
        description={`The guardian sees this reason and is asked to upload another document. ${d.member_first_name} is locked until one is accepted.`}
        label="Reason the guardian can act on" quickPicks={FAMILY_REJECT_REASONS} confirmLabel="Reject" destructive busy={review.isPending}
        onConfirm={(reason) => decide(false, reason)} />
    </article>
  );
}

/** The tab's content: the pending queue (oldest first), and the approved and rejected history. */
export function FamilyDocumentsPanel() {
  const { get, set, page } = useUrlState();
  const raw = get("docs", "pending");
  const status: FamilyDocumentStatus = raw === "approved" || raw === "rejected" ? raw : "pending";
  const q = useFamilyDocuments({ status, page });
  const rows = q.data?.rows ?? [];

  return (
    <div className="space-y-4">
      <ToggleGroup type="single" value={status} onValueChange={(v) => v && set({ docs: v === "pending" ? null : v })} className="justify-start rounded-xl border p-0.5 w-fit" aria-label="Which documents">
        <ToggleGroupItem value="pending" className="h-8 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Waiting</ToggleGroupItem>
        <ToggleGroupItem value="approved" className="h-8 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Approved</ToggleGroupItem>
        <ToggleGroupItem value="rejected" className="h-8 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Rejected</ToggleGroupItem>
      </ToggleGroup>
      {q.isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading family documents">{times(3).map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
      ) : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? (
        <EmptyState icon={PartyPopper} text={status === "pending" ? "No family documents waiting for review." : `No ${status} family documents yet.`} />
      ) : (
        <>
          {rows.map((d) => <DocumentCard key={d.id} d={d} status={status} />)}
          <Pager page={page} total={q.data?.total ?? 0} onPage={(p) => set({ page: p })} fetching={q.isFetching} />
        </>
      )}
    </div>
  );
}
