// Scan to check in, on the website. /checkin/<token> is what a phone camera opens from the
// hospital's QR code: it shows which hospital it is, asks to confirm, then shows the place in
// the queue. /patient/checkin shows today's place in the queue, or how to check in.
// Same screens and wording as the app.
import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Building2, CalendarCheck, Loader2, MapPin, QrCode as QrIcon, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { PatientLayout } from "@/layouts/PatientLayout";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PersonSwitcher } from "@/components/patient/PersonSwitcher";
import { useAuth } from "@/hooks/useAuth";
import { useActivePatient } from "@/hooks/useFamily";
import { useCancelCheckin, useCheckinLookup, useHospitalPlace, useMyCheckins, useSelfCheckIn } from "@/hooks/useCheckin";
import {
  canLeaveQueue, CHECKIN_REASON_MAX, checkinAppLink, checkinDetail, checkinHeadline, cleanCheckinToken, isOpenCheckin, linkNotice, visitTodayLine, type CheckinStatus,
} from "@/lib/checkin";
import { dbMessage, profileIncompleteRoute } from "@/lib/errors";
import { addressLine } from "@/lib/geo";

const fmt12 = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return Number.isNaN(h) ? "" : `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};
const onPhone = () => /android|iphone|ipad|ipod/i.test(navigator.userAgent);

/** The place in the queue, with "Leave the queue" while that is still possible. */
function StatusCard({ checkin }: { checkin: CheckinStatus }) {
  const cancel = useCancelCheckin();
  const called = checkin.status === "called";
  return (
    <section aria-live="polite" className={`rounded-xl border p-6 text-center ${called ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
      <p className="text-sm font-semibold uppercase tracking-wider text-primary">{checkinHeadline(checkin.status)}</p>
      {isOpenCheckin(checkin) && checkin.status !== "in_consultation" && (
        <>
          <p className="mt-3 text-sm text-muted-foreground">Your queue number</p>
          <p className="font-heading text-7xl font-bold tabular-nums">{checkin.queue_number ?? "–"}</p>
        </>
      )}
      <p className="mt-3 font-medium">{checkinDetail(checkin)}</p>
      <p className="mt-2 text-sm text-muted-foreground">{checkin.hospital_name}{checkin.doctor_name ? ` · ${checkin.doctor_name}` : ""}</p>
      {canLeaveQueue(checkin) && (
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="outline" className="mt-5" disabled={cancel.isPending}>Leave the queue</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave the queue?</AlertDialogTitle>
              <AlertDialogDescription>You will lose your place at {checkin.hospital_name}. You can scan the code again later.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay in the queue</AlertDialogCancel>
              <AlertDialogAction onClick={() => cancel.mutate(checkin.checkin_id, {
                onSuccess: () => toast.success("You left the queue"),
                onError: (e) => toast.error(dbMessage(e)),
              })}>Leave the queue</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </section>
  );
}

function HowToCheckIn() {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><QrIcon className="h-6 w-6" aria-hidden /></span>
        <div>
          <h2 className="font-heading text-lg font-bold">Check in at a hospital</h2>
          <p className="mt-1 text-muted-foreground">Scan the QR code at the hospital's front desk with the HealingNet app or your phone camera.</p>
          <p className="mt-2 text-sm text-muted-foreground">You'll get a queue number, and we'll notify you when it's your turn.</p>
        </div>
      </div>
    </section>
  );
}

function Confirm({ token }: { token: string }) {
  const navigate = useNavigate();
  const person = useActivePatient();
  const lookup = useCheckinLookup(token);
  const place = useHospitalPlace(lookup.data?.hospital_id);
  const checkIn = useSelfCheckIn();
  const statuses = useMyCheckins(true);
  const [reason, setReason] = useState("");

  const h = lookup.data;
  const here = (statuses.data ?? []).find((c) => c.hospital_id === h?.hospital_id && isOpenCheckin(c));

  if (lookup.isLoading || person.isLoading) {
    return <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Checking the code…</p>;
  }
  if (lookup.isError || !h) {
    return (
      <section role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <h2 className="font-heading text-lg font-bold">We couldn't use this code</h2>
        <p className="mt-1 text-muted-foreground">{dbMessage(lookup.error)}</p>
        <Button variant="outline" className="mt-4" onClick={() => lookup.refetch()}>Try again</Button>
      </section>
    );
  }
  if (here) return <StatusCard checkin={here} />;

  const where = addressLine({ address: place.data?.address, city: h.city, state: h.state });
  const visit = visitTodayLine(h.appointment_today, fmt12);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    checkIn.mutate({ token, reason }, {
      onSuccess: () => toast.success("You're checked in"),
      onError: (err) => {
        const incomplete = profileIncompleteRoute(err);
        if (incomplete) { toast.info(incomplete.toast); navigate(incomplete.route); return; }
        toast.error(dbMessage(err));
      },
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-border bg-card p-6">
      <div className="flex items-start gap-4">
        {h.logo_url
          ? <img src={h.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-lg border border-border bg-white object-contain" />
          : <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="h-7 w-7" aria-hidden /></span>}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Check in at</p>
          <h2 className="font-heading text-xl font-bold">{h.name}</h2>
          {where && <p className="mt-0.5 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />{where}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Who is checking in?</span>
        <PersonSwitcher />
      </div>

      {visit && <p className="flex items-start gap-2 rounded-lg bg-primary/10 p-3 text-sm font-medium"><CalendarCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{visit}</p>}

      <div>
        <Label htmlFor="checkin-reason">Reason for your visit (optional)</Label>
        <Textarea id="checkin-reason" value={reason} maxLength={CHECKIN_REASON_MAX} rows={3} onChange={(e) => setReason(e.target.value)} placeholder="For example: fever since Monday" />
        <p className="mt-1 text-xs text-muted-foreground">{reason.length}/{CHECKIN_REASON_MAX}. The front desk sees this.</p>
      </div>

      {!h.already_linked && <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{linkNotice(h.name)}</p>}

      <Button type="submit" className="w-full" disabled={checkIn.isPending}>{checkIn.isPending ? "Checking in…" : person.isMe ? "Check in" : `Check in ${person.firstName}`}</Button>
      {onPhone() && (
        <a href={checkinAppLink(token)} className="flex items-center justify-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline">
          <Smartphone className="h-4 w-4" aria-hidden />Open in the app
        </a>
      )}
    </form>
  );
}

export default function PatientCheckIn() {
  const { token: raw } = useParams<{ token?: string }>();
  const { user, loading } = useAuth();
  const token = raw ? cleanCheckinToken(raw) : null;
  const statuses = useMyCheckins(!raw);
  const open = (statuses.data ?? []).filter(isOpenCheckin);

  useEffect(() => { document.title = "Check in · HealingNet"; }, []);

  // A phone camera opened the link and nobody is signed in: sign in, then come back here.
  if (raw && !loading && !user) return <Navigate to={`/login?next=${encodeURIComponent(`/checkin/${raw}`)}`} replace />;
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <PatientLayout>
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <h1 className="mb-1 font-heading text-2xl font-bold">Check in</h1>
          <p className="text-muted-foreground">{raw ? "Confirm the hospital, then join today's queue." : "Your place in today's queue."}</p>
        </div>
        {raw ? (
          token ? <Confirm token={token} /> : (
            <section role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
              <h2 className="font-heading text-lg font-bold">This isn't a HealingNet check-in code.</h2>
              <p className="mt-1 text-muted-foreground">Scan the QR code at the hospital's front desk again, or ask the front desk for help.</p>
            </section>
          )
        ) : (
          <>
            {open.map((c) => <StatusCard key={c.checkin_id} checkin={c} />)}
            {open.length === 0 && <HowToCheckIn />}
          </>
        )}
        <p className="text-center text-sm"><Link to="/patient" className="text-primary underline-offset-4 hover:underline">Back to dashboard</Link></p>
      </div>
    </PatientLayout>
  );
}
