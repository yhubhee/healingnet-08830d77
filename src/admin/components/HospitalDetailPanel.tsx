import { useState, type ReactNode } from "react";
import { Ban, CalendarPlus, Power } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useExtendTrial, useHospitalDetail, useSetHospitalActive, type PlanState } from "../api";
import { actionError, actionLabel, fmtDate, fmtDateTime, fmtNum, koboToNaira, titleCase } from "../format";
import { ErrorState, Fact, Money, PaymentStatusBadge, PlanBadge, RelTime, StatusBadge, VerificationBadge } from "./bits";
import { DetailPanel } from "./DetailPanel";
import { ConfirmDialog, ReasonDialog } from "./dialogs";
import { ReviewActions } from "./ReviewActions";

function planState(h: { subscription_status: string; active_plan: string; trial_ends_at: string | null; plan_expires_at: string | null }): PlanState {
  const now = Date.now();
  if (h.subscription_status === "active" && h.plan_expires_at && new Date(h.plan_expires_at).getTime() > now) return h.active_plan as PlanState;
  if (h.subscription_status === "trialing" && h.trial_ends_at && new Date(h.trial_ends_at).getTime() > now) return "trialing";
  if (h.subscription_status === "active" || h.subscription_status === "trialing") return "lapsed";
  return "none";
}

export function DetailHeading({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-6 font-heading text-sm font-bold uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

export function AuditList({ items }: { items: { action: string; details: Record<string, unknown> | null; created_at: string; admin_email: string | null }[] }) {
  if (items.length === 0) return <p className="text-sm text-muted-foreground">No admin actions yet.</p>;
  return (
    <ol className="space-y-3 border-l pl-4">
      {items.map((a, i) => {
        const detail = a.details ? (a.details.reason ?? a.details.notes ?? a.details.note) : null;
        return (
          <li key={i} className="text-sm">
            <p><span className="font-medium">{actionLabel(a.action)}</span> · <span className="text-muted-foreground">{a.admin_email ?? "Unknown admin"}</span></p>
            {typeof a.details?.days === "number" && <p className="text-xs text-muted-foreground">+{a.details.days as number} days</p>}
            {detail ? <p className="text-xs text-muted-foreground">“{String(detail)}”</p> : null}
            <p className="text-xs text-muted-foreground"><RelTime iso={a.created_at} /></p>
          </li>
        );
      })}
    </ol>
  );
}

export function HospitalDetailPanel({ id, onClose }: { id: string | null; onClose: () => void }) {
  const q = useHospitalDetail(id);
  const d = q.data;
  const h = d?.hospital;
  const setActive = useSetHospitalActive();
  const extend = useExtendTrial();
  const [suspending, setSuspending] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [extending, setExtending] = useState(false);
  const [days, setDays] = useState("14");

  const paidRunning = !!h && h.subscription_status === "active" && !!h.plan_expires_at && new Date(h.plan_expires_at).getTime() > Date.now();
  const daysNum = parseInt(days, 10);
  const daysValid = Number.isInteger(daysNum) && daysNum >= 1 && daysNum <= 60;

  return (
    <DetailPanel
      open={!!id} onOpenChange={(o) => !o && onClose()}
      title={h?.name ?? (q.isLoading ? "Loading…" : "Hospital")}
      subtitle={h && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <VerificationBadge status={h.verification_status} active={h.is_active} />
          <PlanBadge plan={planState(h)} trialEndsAt={h.trial_ends_at} planExpiresAt={h.plan_expires_at} />
        </div>
      )}
    >
      {q.isLoading && <div className="space-y-3"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div>}
      {q.isError && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {d && h && (
        <div className="pb-4">
          {/* Actions */}
          <div className="flex flex-wrap gap-2">
            {h.verification_status === "pending" && <ReviewActions kind="hospital" id={h.id} name={h.name} />}
            {h.is_active ? (
              <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => setSuspending(true)}>
                <Ban className="mr-1.5 h-4 w-4" />Suspend
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setReactivating(true)}><Power className="mr-1.5 h-4 w-4" />Reactivate</Button>
            )}
            {paidRunning ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0}><Button size="sm" variant="outline" disabled><CalendarPlus className="mr-1.5 h-4 w-4" />Extend trial</Button></span>
                </TooltipTrigger>
                <TooltipContent>A paid plan is running, so there is no trial to extend.</TooltipContent>
              </Tooltip>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setExtending(true)}><CalendarPlus className="mr-1.5 h-4 w-4" />Extend trial</Button>
            )}
          </div>

          <DetailHeading>Profile</DetailHeading>
          <dl className="grid grid-cols-2 gap-3">
            <Fact label="Email">{h.email && <a className="text-primary underline-offset-2 hover:underline" href={`mailto:${h.email}`}>{h.email}</a>}</Fact>
            <Fact label="Phone">{h.phone}</Fact>
            <Fact label="Location">{[h.address, h.city, h.state].filter(Boolean).join(", ")}</Fact>
            <Fact label="Licence number">{h.license_number}</Fact>
            <Fact label="Joined">{fmtDateTime(h.created_at)}</Fact>
            <Fact label="Verified">{h.verified_at ? fmtDate(h.verified_at) : null}</Fact>
            {h.trial_ends_at && <Fact label="Trial ends">{fmtDateTime(h.trial_ends_at)}</Fact>}
            {h.plan_expires_at && <Fact label="Plan expires">{fmtDateTime(h.plan_expires_at)}</Fact>}
            {h.verification_notes && <div className="col-span-2"><Fact label="Review notes">{h.verification_notes}</Fact></div>}
          </dl>

          <DetailHeading>Admin contacts</DetailHeading>
          {d.admins.length === 0 ? <p className="text-sm text-muted-foreground">No active admins.</p> : (
            <ul className="space-y-2">
              {d.admins.map((a, i) => (
                <li key={i} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{a.name || "—"}</p>
                  <p className="text-muted-foreground">
                    {a.email && <a className="text-primary underline-offset-2 hover:underline" href={`mailto:${a.email}`}>{a.email}</a>}
                    {a.phone && <> · <a href={`tel:${a.phone}`} className="tabular-nums">{a.phone}</a></>}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <DetailHeading>Activity</DetailHeading>
          <dl className="grid grid-cols-3 gap-3">
            <Fact label="Staff">{fmtNum(d.counts.staff)}</Fact>
            <Fact label="Doctors">{fmtNum(d.counts.doctors)}</Fact>
            <Fact label="Patients">{fmtNum(d.counts.patients)}</Fact>
            <Fact label="Check-ins (30 d)">{fmtNum(d.counts.checkins_30d)}</Fact>
            <Fact label="Appointments (30 d)">{fmtNum(d.counts.appointments_30d)}</Fact>
            <Fact label="Consultations (30 d)">{fmtNum(d.counts.consultations_30d)}</Fact>
          </dl>

          <DetailHeading>Subscription history</DetailHeading>
          {d.subscriptions.length === 0 ? <p className="text-sm text-muted-foreground">No subscriptions.</p> : (
            <ul className="divide-y rounded-xl border text-sm">
              {d.subscriptions.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span>{s.plan === "emr" ? "EMR" : titleCase(s.plan)}{s.billing_cycle ? ` · ${titleCase(s.billing_cycle)}` : ""}</span>
                  <StatusBadge tone={s.status === "active" ? "good" : s.status === "trialing" ? "warn" : "neutral"} label={titleCase(s.status)} />
                  <span className="w-full text-xs text-muted-foreground tabular-nums">{fmtDate(s.started_at)} → {fmtDate(s.expires_at)}</span>
                </li>
              ))}
            </ul>
          )}

          <DetailHeading>Recent payments</DetailHeading>
          {d.payments.length === 0 ? <p className="text-sm text-muted-foreground">No payments.</p> : (
            <ul className="divide-y rounded-xl border text-sm">
              {d.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span className="min-w-0">
                    <Money value={koboToNaira(p.amount)} className="font-medium" /> · {titleCase(p.purpose)}
                    <span className="block text-xs text-muted-foreground"><RelTime iso={p.created_at} /></span>
                  </span>
                  <PaymentStatusBadge status={p.status} review={p.review} />
                </li>
              ))}
            </ul>
          )}

          <DetailHeading>Audit history</DetailHeading>
          <AuditList items={d.audit} />
        </div>
      )}

      {h && (
        <>
          <ReasonDialog
            open={suspending} onOpenChange={setSuspending} destructive confirmLabel="Suspend hospital" busy={setActive.isPending}
            title={`Suspend ${h.name}?`}
            description={<p><strong>All staff lose access immediately</strong>, and the hospital is hidden from patients. The hospital is told the reason.</p>}
            placeholder="e.g. Licence revoked by the state ministry"
            onConfirm={(reason) => setActive.mutate({ id: h.id, active: false, reason }, {
              onSuccess: () => { setSuspending(false); toast.success(`${h.name} suspended`); },
              onError: (e) => toast.error("Couldn't suspend", { description: actionError(e) }),
            })}
          />
          <ConfirmDialog
            open={reactivating} onOpenChange={setReactivating} confirmLabel="Reactivate" busy={setActive.isPending}
            title={`Reactivate ${h.name}?`} description="Staff get their access back straight away."
            onConfirm={() => setActive.mutate({ id: h.id, active: true }, {
              onSuccess: () => { setReactivating(false); toast.success(`${h.name} reactivated`); },
              onError: (e) => toast.error("Couldn't reactivate", { description: actionError(e) }),
            })}
          />
          <ReasonDialog
            open={extending} onOpenChange={(o) => { setExtending(o); if (o) setDays("14"); }} confirmLabel="Extend trial" busy={extend.isPending}
            title={`Extend ${h.name}'s trial`}
            description="Adds days to the EMR trial, counted from today or the current trial end, whichever is later."
            placeholder="e.g. Onboarding delayed by internet outage"
            onConfirm={(reason) => {
              if (!daysValid) { toast.error("Days must be between 1 and 60"); return; }
              extend.mutate({ id: h.id, days: daysNum, reason }, {
                onSuccess: (until) => { setExtending(false); toast.success("Trial extended", { description: `Now ends ${fmtDateTime(until as string)}` }); },
                onError: (e) => toast.error("Couldn't extend the trial", { description: actionError(e) }),
              });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="extend-days">Days (1–60)</Label>
              <Input id="extend-days" type="number" inputMode="numeric" min={1} max={60} value={days} onChange={(e) => setDays(e.target.value)} className="w-28 tabular-nums" aria-invalid={!daysValid} />
              {!daysValid && <p className="text-xs text-destructive">Enter a whole number from 1 to 60.</p>}
            </div>
          </ReasonDialog>
        </>
      )}
    </DetailPanel>
  );
}
