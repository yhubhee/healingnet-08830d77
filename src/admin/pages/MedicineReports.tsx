// /admin/medicine-reports: patients' "not found" and "looks fake" medicine checks
// (admin_list_medicine_checks), with pharmacies paused automatically shown first.
import { useState } from "react";
import { Link } from "react-router-dom";
import { PartyPopper, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useMedicineChecks, usePharmacyQueue, useResolveMedicineCheck, type MedicineCheck } from "../pharmacy-api";
import { actionError, fmtDateTime } from "../format";
import { EmptyState, ErrorState, ListSkeleton, Section, StatusBadge } from "../components/bits";
import { FilterBar, FilterSelect } from "../components/list";
import { useUrlState } from "../components/url-state";

const STATUS = [
  { value: "open", label: "Open" }, { value: "reviewed", label: "Reviewed" }, { value: "closed", label: "Closed" }, { value: "any", label: "All" },
];
const RESULT: Record<string, { label: string; tone: "bad" | "warn" | "good" }> = {
  suspected_fake: { label: "Looks fake", tone: "bad" },
  not_found: { label: "Not found", tone: "warn" },
  genuine: { label: "Genuine", tone: "good" },
};

function ResolveDialog({ check, to, onClose }: { check: MedicineCheck | null; to: "reviewed" | "closed"; onClose: () => void }) {
  const resolve = useResolveMedicineCheck();
  const [note, setNote] = useState("");
  return (
    <AlertDialog open={!!check} onOpenChange={(o) => { if (!o) { setNote(""); onClose(); } }}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{to === "reviewed" ? "Mark this report reviewed?" : "Close this report?"}</AlertDialogTitle>
          <AlertDialogDescription>{check?.drug_name ?? "Medicine"}{check?.pharmacy_name ? ` from ${check.pharmacy_name}` : ""}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="resolve-note">Note (optional)</Label>
          <Textarea id="resolve-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={resolve.isPending}>Cancel</AlertDialogCancel>
          <Button disabled={resolve.isPending || !check} onClick={() => {
            if (!check) return;
            resolve.mutateAsync({ id: check.id, status: to, note: note.trim() || undefined }).then(
              () => { toast.success(to === "reviewed" ? "Marked reviewed" : "Report closed"); setNote(""); onClose(); },
              (e) => toast.error("Couldn't update the report", { description: actionError(e) }),
            );
          }}>{to === "reviewed" ? "Mark reviewed" : "Close report"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default function MedicineReports() {
  const { get, set } = useUrlState();
  const status = get("status", "open");
  const q = useMedicineChecks(status === "any" ? "" : status);
  const queue = usePharmacyQueue();
  const [act, setAct] = useState<{ check: MedicineCheck; to: "reviewed" | "closed" } | null>(null);
  const paused = queue.data?.paused ?? [];

  return (
    <div className="space-y-6">
      {paused.length > 0 && (
        <Section title="Paused pharmacies">
          <ul className="space-y-2" data-testid="paused-pharmacies">
            {paused.map((p) => (
              <li key={p.id} className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="font-semibold">{p.name}</p>
                {p.reason && <p className="text-muted-foreground">{p.reason}</p>}
                <Link to={`/admin/pharmacies?q=${encodeURIComponent(p.name)}`} className="text-primary underline-offset-2 hover:underline">Open in Pharmacies</Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div>
        <FilterBar>
          <FilterSelect label="Status" value={status} options={STATUS} onChange={(v) => set({ status: v === "open" ? null : v })} />
        </FilterBar>
        {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (q.data ?? []).length === 0 ? (
          <EmptyState icon={status === "open" ? PartyPopper : ShieldAlert} text={status === "open" ? "No open medicine reports." : "No reports here."} />
        ) : (
          <ul className="space-y-3" data-testid="medicine-reports">
            {(q.data ?? []).map((c) => {
              const r = RESULT[c.result] ?? RESULT.not_found;
              return (
                <li key={c.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-heading font-bold">{c.drug_name ?? "Medicine"}</p>
                      <p className="text-sm text-muted-foreground">{c.pharmacy_name ? `Dispensed at ${c.pharmacy_name}` : "No pharmacy dispense on record"} · {fmtDateTime(c.created_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge tone={r.tone} label={r.label} />
                      <StatusBadge tone={c.status === "open" ? "warn" : "neutral"} label={c.status === "open" ? "Open" : c.status === "reviewed" ? "Reviewed" : "Closed"} />
                    </div>
                  </div>
                  {(c.batch_number || c.nafdac_no) && (
                    <p className="mt-2 text-sm">{[c.batch_number && `Batch ${c.batch_number}`, c.nafdac_no && `NAFDAC ${c.nafdac_no}`].filter(Boolean).join(" · ")}</p>
                  )}
                  {c.details && <p className="mt-2 break-words text-sm">“{c.details}”</p>}
                  {c.admin_note && <p className="mt-2 text-sm text-muted-foreground">Note: {c.admin_note}</p>}
                  {c.status !== "closed" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.status === "open" && <Button size="sm" variant="outline" onClick={() => setAct({ check: c, to: "reviewed" })}>Mark reviewed</Button>}
                      <Button size="sm" variant="outline" onClick={() => setAct({ check: c, to: "closed" })}>Close</Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <ResolveDialog check={act?.check ?? null} to={act?.to ?? "reviewed"} onClose={() => setAct(null)} />
    </div>
  );
}
