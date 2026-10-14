import { AlertTriangle, XCircle } from "lucide-react";
import { daysUntil, fmtDate } from "../format";

/** Licence expiry date, flagged red when expired and amber within 30 days. */
export function LicenceExpiry({ date }: { date: string | null | undefined }) {
  if (!date) return <span>—</span>;
  const d = daysUntil(date + "T23:59:59+01:00");
  if (d != null && d < 0) {
    return <span className="inline-flex items-center gap-1 font-medium text-destructive"><XCircle className="h-3.5 w-3.5" aria-hidden />{fmtDate(date)} · Expired</span>;
  }
  if (d != null && d <= 30) {
    return <span className="inline-flex items-center gap-1 font-medium text-warning"><AlertTriangle className="h-3.5 w-3.5" aria-hidden />{fmtDate(date)} · {d} d left</span>;
  }
  return <span className="tabular-nums">{fmtDate(date)}</span>;
}
