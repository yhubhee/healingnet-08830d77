// Dashboard: how to check in at a hospital, and today's place in the queue once checked in.
import { Link } from "react-router-dom";
import { ArrowRight, QrCode } from "lucide-react";
import { useMyCheckins } from "@/hooks/useCheckin";
import { useActivePatient } from "@/hooks/useFamily";
import { currentCheckin, queueLine } from "@/lib/checkin";

export function CheckInCard() {
  const person = useActivePatient();
  const statuses = useMyCheckins(true);
  const open = currentCheckin(statuses.data ?? []);
  const called = open?.status === "called";

  return (
    <div className={`mb-6 rounded-xl border p-5 ${called ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><QrCode className="h-5 w-5" aria-hidden /></div>
        <div className="min-w-0 flex-1">
          {open ? (
            <>
              <h3 className="font-heading font-bold" aria-live="polite">{called ? "It's your turn" : person.isMe ? "You're checked in" : `${person.firstName} is checked in`}</h3>
              <p className="mb-3 text-sm text-muted-foreground">{queueLine(open)}</p>
              <Link to="/patient/checkin" className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">See your place in the queue <ArrowRight className="h-4 w-4" /></Link>
            </>
          ) : (
            <>
              <h3 className="font-heading font-bold">Check in at a hospital</h3>
              <p className="text-sm text-muted-foreground">Scan the QR code at the hospital's front desk with the HealingNet app or your phone camera.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
