// Family verification on the website: the status badge (always an icon and words) and the
// Verify dialog. Same flow, statuses, wording and rules as the app (mobile/app/family/verify.tsx).
import { useEffect, useRef, useState } from "react";
import { AlertCircle, BadgeCheck, Clock, FileText, FileUp, Hourglass, Loader2, Lock, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocumentError, prepareDocument, useSubmitFamilyDocument, type ChosenDocument } from "@/lib/familyDocuments";
import { dbMessage } from "@/lib/errors";
import { relationshipLabel, type FamilyMember } from "@/lib/family";
import {
  DOCUMENT_ACCEPT, DOCUMENT_PRIVACY, documentsFor, dueDayTime, explainVerify, fileSizeText, verifyState, type DocumentType, type Verifiable, type VerifyKind,
} from "@/lib/verification";
import { cn } from "@/lib/utils";

const ICON: Record<VerifyKind, LucideIcon> = { verified: BadgeCheck, pending: Hourglass, due: Clock, locked: Lock, rejected: AlertCircle };
const TONE = { success: "text-success", neutral: "text-muted-foreground", warning: "text-warning", danger: "text-destructive" } as const;

export function VerifyBadge({ member, className }: { member: Verifiable; className?: string }) {
  const state = verifyState(member);
  const Icon = ICON[state.kind];
  return (
    <span className={cn("inline-flex items-start gap-1.5 text-sm font-medium", TONE[state.tone], className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span><span className="sr-only">Verification: </span>{state.label}</span>
    </span>
  );
}

export function VerifyFamilyDialog({ member, justAdded, onClose }: { member: FamilyMember | null; justAdded?: boolean; onClose: () => void }) {
  const submit = useSubmitFamilyDocument();
  const input = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<DocumentType | null>(null);
  const [doc, setDoc] = useState<ChosenDocument | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const id = member?.patient_id;

  useEffect(() => { setType(null); setProblem(null); setDoc((old) => { if (old) URL.revokeObjectURL(old.previewUrl); return null; }); }, [id]);

  if (!member) return null;
  const name = member.first_name;
  const state = verifyState(member);
  const options = documentsFor(member.relationship);

  async function choose(file: File | undefined) {
    if (!file) return;
    setProblem(null);
    setReading(true);
    try {
      const next = await prepareDocument(file);
      setDoc((old) => { if (old) URL.revokeObjectURL(old.previewUrl); return next; });
    } catch (e) {
      setProblem(e instanceof DocumentError ? e.message : "We couldn't read that file. Try another.");
    }
    setReading(false);
    if (input.current) input.current.value = "";
  }

  async function send() {
    if (!type) { setProblem("Choose which document this is."); return; }
    if (!doc) { setProblem("Choose a photo or file first."); return; }
    setProblem(null);
    try {
      await submit.mutateAsync({ patientId: member!.patient_id, type, doc });
      toast.success(`Sent. We'll tell you when ${name}'s document has been checked.`);
      onClose();
    } catch (e) {
      // The database's own message, as it is.
      setProblem(dbMessage(e));
    }
  }

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Verify {name}</DialogTitle>
          <DialogDescription>{explainVerify(name)}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border p-3">
          <VerifyBadge member={member} />
          {state.kind === "due" && <p className="mt-1 text-xs text-muted-foreground">{name} is locked on {dueDayTime(member.verification_due_at)} if no document has been sent.</p>}
          {state.kind === "rejected" && <p className="mt-1 text-xs text-muted-foreground">Send a different document, or a clearer copy of the same one.</p>}
          {state.kind === "pending" && <p className="mt-1 text-xs text-muted-foreground">We have {name}'s document. A HealingNet team member checks it, usually within 2 working days.{state.locked ? ` ${name} stays locked until it is accepted.` : ""}</p>}
          {state.kind === "verified" && <p className="mt-1 text-xs text-muted-foreground">{name}'s document was accepted. There is nothing more to do.</p>}
        </div>

        {state.canUpload && (
          <div className="space-y-4">
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm font-medium">Which document? ({relationshipLabel(member.relationship)})</legend>
              {options.map((o) => (
                <label key={o.value} className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg px-1 text-sm hover:bg-muted/50">
                  <input type="radio" name="family-document-type" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={type === o.value} onChange={() => { setType(o.value); setProblem(null); }} />
                  <span>{o.label}</span>
                </label>
              ))}
            </fieldset>

            <div className="space-y-2">
              <input ref={input} id="family-document-file" type="file" className="sr-only" accept={[...DOCUMENT_ACCEPT, ".heic", ".pdf"].join(",")}
                onChange={(e) => choose(e.target.files?.[0])} />
              {doc ? (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <p className="text-sm font-medium">Check it before sending</p>
                  {doc.isImage ? (
                    <img src={doc.previewUrl} alt="The photo you are about to send" className="max-h-80 w-full rounded-md bg-muted object-contain" />
                  ) : (
                    <div className="flex items-center gap-3 rounded-md bg-muted p-3">
                      <FileText className="h-6 w-6 shrink-0 text-primary" aria-hidden />
                      <div className="min-w-0"><p className="truncate text-sm font-medium">{doc.name}</p><p className="text-xs text-muted-foreground">{doc.mime === "application/pdf" ? "PDF" : "Photo"} · {fileSizeText(doc.blob.size)}</p></div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">Make sure every name and date can be read and nothing is cut off.</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => input.current?.click()}>Choose a different one</Button>
                </div>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={reading}>
                    {reading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <FileUp className="mr-1.5 h-4 w-4" />}Choose a photo or PDF
                  </Button>
                  <p className="text-xs text-muted-foreground">Photos are made smaller before sending. Files can be up to 5 MB.</p>
                </>
              )}
            </div>
            {problem && <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{problem}</p>}
          </div>
        )}

        <DialogFooter className="gap-2 sm:items-center">
          {state.canUpload ? (
            <>
              <Button variant="ghost" onClick={onClose}>{justAdded ? "Later" : "Cancel"}</Button>
              <Button onClick={send} disabled={submit.isPending || !doc || !type}>{submit.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Send for checking</Button>
            </>
          ) : <Button onClick={onClose}>Done</Button>}
        </DialogFooter>
        {state.canUpload && <p className="text-center text-xs text-muted-foreground">{DOCUMENT_PRIVACY}</p>}
      </DialogContent>
    </Dialog>
  );
}
