// The care plan on a maternity or surgery record: what the hospital asks the patient to do,
// and when. The patient sees every item in the app and on the website and gets reminders.
// Templates fill only the title; the clinician writes the details.
import { useEffect, useState, type ReactNode } from "react";
import { CalendarCheck, Check, ClipboardList, Eye, FileText, FlaskConical, Lock, Pencil, Pill, Plus, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCareItemActions, useCareItems, type CarePlanItem, type CareSource } from "@/hooks/useCareRecords";
import {
  canDeleteCareItem, CARE_DETAILS_MAX, CARE_KINDS, CARE_TEMPLATES, CARE_TITLE_MAX, careDateTime, careKindLabel, groupCareItems, isPast, type CareKind,
} from "@/lib/care";
import { fromLagosInput, toLagosInput } from "@/lib/dates";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";

/** Next to every field and section the patient can see. */
export function VisibleToPatient({ className }: { className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full bg-info/15 px-2 py-0.5 text-xs font-semibold text-info", className)}><Eye className="h-3 w-3" aria-hidden />Visible to the patient</span>;
}
/** Next to what stays inside the hospital. */
export function HospitalOnly({ className }: { className?: string }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground", className)}><Lock className="h-3 w-3" aria-hidden />Hospital only</span>;
}

export function RecordSection({ title, badge, action, children }: { title: string; badge?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="font-heading text-lg font-bold">{title}</h2>
        {badge}
        <div className="ml-auto flex flex-wrap gap-2">{action}</div>
      </div>
      {children}
    </section>
  );
}

const KIND_ICON: Record<CareKind, typeof Pill> = { visit: CalendarCheck, test: FlaskConical, medicine: Pill, task: ClipboardList, instruction: FileText };

export interface CareItemDraft { kind: CareKind; title: string; details: string; due: string; remind: boolean }
const EMPTY: CareItemDraft = { kind: "task", title: "", details: "", due: "", remind: true };

function ItemRow({ item, onEdit, source, sourceId }: { item: CarePlanItem; onEdit: () => void; source: CareSource; sourceId: string }) {
  const { update, remove } = useCareItemActions(source, sourceId);
  const Icon = KIND_ICON[item.kind as CareKind] ?? ClipboardList;
  const done = item.status === "done";
  const fail = (e: unknown) => toast.error(friendlyError(e));
  const fresh = canDeleteCareItem(item.created_at, new Date());
  return (
    <li className="flex flex-wrap items-start gap-3 rounded-lg border border-border/60 p-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" aria-hidden /></span>
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium", done && "line-through decoration-muted-foreground")}>{item.title} <span className="text-xs font-normal text-muted-foreground">· {careKindLabel(item.kind)}</span></p>
        {item.details && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{item.details}</p>}
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {item.due_at && <span>{careDateTime(item.due_at)}{!done && isPast(item.due_at, new Date()) ? " · date has passed" : ""}</span>}
          <span className="inline-flex items-center gap-1">{item.remind ? <Bell className="h-3 w-3" aria-hidden /> : <BellOff className="h-3 w-3" aria-hidden />}{item.remind ? "Reminder on" : "Reminder off"}</span>
          {done && <span className="inline-flex items-center gap-1 font-semibold text-success"><Check className="h-3 w-3" aria-hidden />{item.done_by_patient ? "Done by patient" : "Marked done by the hospital"}</span>}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {!done && <Button size="sm" variant="outline" onClick={() => update.mutate({ itemId: item.id, status: "done" }, { onError: fail })}>Mark done</Button>}
        {done && <Button size="sm" variant="ghost" onClick={() => update.mutate({ itemId: item.id, status: "open" }, { onError: fail })}>Reopen</Button>}
        {!done && <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>}
        {fresh
          ? <Button size="sm" variant="ghost" className="text-destructive" title="Added in the last 10 minutes: it can be deleted" onClick={() => remove.mutate(item.id, { onError: fail, onSuccess: () => toast.success("Item deleted") })}>Delete</Button>
          : !done && <Button size="sm" variant="ghost" className="text-destructive" title="The patient may have seen this, so it is cancelled rather than deleted" onClick={() => update.mutate({ itemId: item.id, status: "cancelled" }, { onError: fail, onSuccess: () => toast.success("Item cancelled. The patient no longer sees it.") })}>Cancel item</Button>}
      </div>
    </li>
  );
}

export function CarePlanSection({ source, sourceId, prefill, onPrefillUsed, extraAction, intro }: {
  source: CareSource; sourceId: string;
  /** Opens the "Add item" form already filled in (e.g. after recording a visit with a next visit date). */
  prefill?: Partial<CareItemDraft> | null; onPrefillUsed?: () => void;
  extraAction?: ReactNode; intro?: string;
}) {
  const items = useCareItems(source, sourceId);
  const { add, update } = useCareItemActions(source, sourceId);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CarePlanItem | null>(null);
  const [draft, setDraft] = useState<CareItemDraft>(EMPTY);

  useEffect(() => {
    if (!prefill) return;
    setEditing(null); setDraft({ ...EMPTY, ...prefill }); setOpen(true); onPrefillUsed?.();
  }, [prefill, onPrefillUsed]);

  const startAdd = () => { setEditing(null); setDraft(EMPTY); setOpen(true); };
  const startEdit = (i: CarePlanItem) => {
    setEditing(i);
    setDraft({ kind: i.kind as CareKind, title: i.title, details: i.details ?? "", due: toLagosInput(i.due_at), remind: i.remind });
    setOpen(true);
  };

  const dueIso = fromLagosInput(draft.due);
  const past = !!dueIso && isPast(dueIso, new Date());
  const saving = add.isPending || update.isPending;

  function save(e: React.FormEvent) {
    e.preventDefault();
    const title = draft.title.trim();
    if (!title) { toast.error("Give the item a title."); return; }
    const values = { kind: draft.kind, title, details: draft.details.trim() || null, due_at: dueIso, remind: draft.remind };
    const opts = { onSuccess: () => { setOpen(false); toast.success(editing ? "Item updated" : "Added to the care plan. The patient is told."); }, onError: (err: unknown) => toast.error(friendlyError(err)) };
    if (editing) update.mutate({ itemId: editing.id, ...values }, opts); else add.mutate(values, opts);
  }

  const groups = groupCareItems((items.data ?? []).filter((i) => i.status !== "cancelled") as (CarePlanItem & { status: "open" | "done" })[]);
  const cancelled = (items.data ?? []).filter((i) => i.status === "cancelled").length;
  const group = (label: string, list: CarePlanItem[]) => list.length > 0 && (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label} ({list.length})</h3>
      <ul className="space-y-2">{list.map((i) => <ItemRow key={i.id} item={i} onEdit={() => startEdit(i)} source={source} sourceId={sourceId} />)}</ul>
    </div>
  );

  return (
    <RecordSection title="Care plan" badge={<VisibleToPatient />} action={<>{extraAction}<Button size="sm" onClick={startAdd}><Plus className="mr-1 h-4 w-4" />Add item</Button></>}>
      <p className="mb-4 text-sm text-muted-foreground">{intro ?? "Follow-ups and to-dos for the patient. They see each one in the app and on the website, and are reminded before it."}</p>
      {items.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p>
        : items.isError ? <p role="alert" className="text-sm text-destructive">{friendlyError(items.error, "We couldn't load the care plan.")} <button type="button" className="underline" onClick={() => items.refetch()}>Try again</button></p>
        : (items.data ?? []).length === cancelled ? <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nothing in the care plan yet.</p>
        : <div className="space-y-5">{group("Upcoming", groups.upcoming)}{group("No date", groups.noDate)}{group("Done", groups.done)}</div>}
      {cancelled > 0 && <p className="mt-3 text-xs text-muted-foreground">{cancelled} cancelled {cancelled === 1 ? "item is" : "items are"} hidden from the patient.</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit care plan item" : "Add to the care plan"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            {!editing && (
              <div>
                <p className="mb-1.5 text-sm font-medium">Quick templates (title only)</p>
                <div className="flex flex-wrap gap-1.5">
                  {CARE_TEMPLATES[source].map((t) => (
                    <Button key={t.title} type="button" size="sm" variant={draft.title === t.title ? "default" : "outline"} className="rounded-full" onClick={() => setDraft({ ...draft, title: t.title, kind: t.kind })}>{t.title}</Button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label htmlFor="care-kind">Kind</Label>
                <Select value={draft.kind} onValueChange={(v) => setDraft({ ...draft, kind: v as CareKind })}>
                  <SelectTrigger id="care-kind"><SelectValue /></SelectTrigger>
                  <SelectContent>{CARE_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label htmlFor="care-title">Title</Label>
                <Input id="care-title" required maxLength={CARE_TITLE_MAX} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="care-details">Details for the patient (optional)</Label>
              <Textarea id="care-details" rows={3} maxLength={CARE_DETAILS_MAX} value={draft.details} onChange={(e) => setDraft({ ...draft, details: e.target.value })} placeholder="Write what the patient should do, in plain words." />
            </div>
            <div>
              <Label htmlFor="care-due">Date and time (optional, Nigerian time)</Label>
              <Input id="care-due" type="datetime-local" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} />
              {past && <p role="status" className="mt-1 text-sm font-medium text-warning">Warning: this date is in the past. No reminder will be sent.</p>}
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <Label htmlFor="care-remind" className="cursor-pointer">Remind the patient<span className="block text-xs font-normal text-muted-foreground">The day before, and on the day.</span></Label>
              <Switch id="care-remind" checked={draft.remind} onCheckedChange={(v) => setDraft({ ...draft, remind: v })} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving…" : editing ? "Save changes" : "Add to care plan"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </RecordSection>
  );
}
