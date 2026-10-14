// /admin/verifications: admin_verification_queue(), oldest first.
import { useState } from "react";
import { Clock, Hospital as HospitalIcon, PartyPopper, Stethoscope } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVerificationQueue, type QueueDoctor, type QueueHospital } from "../api";
import { daysSince, fmtDate, fmtNum, times } from "../format";
import { EmptyState, ErrorState, Fact, RelTime } from "../components/bits";
import { CredentialDocuments } from "../components/Documents";
import { LicenceExpiry } from "../components/LicenceExpiry";
import { ReviewActions } from "../components/ReviewActions";
import { useUrlState } from "../components/url-state";
import { useDetail } from "../components/detail-state";

function Waiting({ since }: { since: string | null }) {
  const d = daysSince(since);
  const tone = d >= 3 ? "text-destructive" : d >= 1 ? "text-warning" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium tabular-nums ${tone}`}>
      <Clock className="h-3.5 w-3.5" aria-hidden />
      {d === 0 ? "Waiting less than a day" : `Waiting ${d} ${d === 1 ? "day" : "days"}`}
    </span>
  );
}

function HospitalCard({ h, onRemoved }: { h: QueueHospital; onRemoved: (id: string, removed: boolean) => void }) {
  const { open } = useDetail();
  return (
    <article className="rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <button type="button" onClick={() => open("hospital", h.id)} className="text-left font-heading text-lg font-bold underline-offset-2 hover:underline">{h.name}</button>
          <p className="text-sm text-muted-foreground">{[h.address, h.city, h.state].filter(Boolean).join(", ") || "No address"}</p>
        </div>
        <Waiting since={h.created_at} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Fact label="Licence number">{h.license_number}</Fact>
        <Fact label="Patients registered">{fmtNum(h.patients_registered)}</Fact>
        <Fact label="Signed up"><RelTime iso={h.created_at} /></Fact>
        <Fact label="Admin contact">{h.contact?.name}</Fact>
        <Fact label="Email">{(h.contact?.email ?? h.email) && <a className="text-primary underline-offset-2 hover:underline" href={`mailto:${h.contact?.email ?? h.email}`}>{h.contact?.email ?? h.email}</a>}</Fact>
        <Fact label="Phone">{(h.contact?.phone ?? h.phone) && <a href={`tel:${h.contact?.phone ?? h.phone}`}>{h.contact?.phone ?? h.phone}</a>}</Fact>
      </dl>
      <div className="mt-4"><ReviewActions kind="hospital" id={h.id} name={h.name} onOptimistic={(r) => onRemoved(h.id, r)} /></div>
    </article>
  );
}

function DoctorCard({ d, onRemoved }: { d: QueueDoctor; onRemoved: (id: string, removed: boolean) => void }) {
  const { open } = useDetail();
  const p = d.current_practice;
  const r = d.reference_contact;
  return (
    <article className="rounded-2xl border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <button type="button" onClick={() => open("doctor", d.id)} className="text-left font-heading text-lg font-bold underline-offset-2 hover:underline">Dr {d.name}</button>
          <p className="text-sm text-muted-foreground">
            {d.specialty || "No specialty"}{d.years_experience != null ? ` · ${d.years_experience} years' experience` : ""}
          </p>
        </div>
        <Waiting since={d.verification_submitted_at ?? d.created_at} />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Fact label="Licence number">{d.license_number}</Fact>
        <Fact label="Council">{d.license_council}</Fact>
        <Fact label="Licence expiry"><LicenceExpiry date={d.license_expiry} /></Fact>
        <Fact label="Current practice">{p?.name && [p.name, p.role, p.city].filter(Boolean).join(" · ")}{p?.from ? ` (since ${p.from})` : ""}</Fact>
        <Fact label="Reference">
          {r?.name && <>{r.name}{r.hospital ? `, ${r.hospital}` : ""}{r.phone && <> · <a href={`tel:${r.phone}`}>{r.phone}</a></>}</>}
        </Fact>
        <Fact label="Contact">{d.email && <a className="text-primary underline-offset-2 hover:underline" href={`mailto:${d.email}`}>{d.email}</a>}</Fact>
      </dl>
      <div className="mt-4">
        <p className="mb-2 text-xs text-muted-foreground">Documents</p>
        <CredentialDocuments docs={d.credential_documents} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Submitted {fmtDate(d.verification_submitted_at)}</p>
      <div className="mt-4"><ReviewActions kind="doctor" id={d.id} name={`Dr ${d.name}`} onOptimistic={(rm) => onRemoved(d.id, rm)} /></div>
    </article>
  );
}

export default function Verifications() {
  const q = useVerificationQueue();
  const { get, set } = useUrlState();
  const tab = get("tab", "hospitals") === "doctors" ? "doctors" : "hospitals";
  // Optimistically hidden items (approved / rejected, waiting for the refetch).
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const hide = (id: string, removed: boolean) =>
    setHidden((s) => { const n = new Set(s); if (removed) n.add(id); else n.delete(id); return n; });

  const hospitals = (q.data?.hospitals ?? []).filter((h) => !hidden.has(h.id));
  const doctors = (q.data?.doctors ?? []).filter((d) => !hidden.has(d.id));

  return (
    <Tabs value={tab} onValueChange={(v) => set({ tab: v === "hospitals" ? null : v })}>
      <TabsList className="mb-4 h-auto max-w-full flex-wrap justify-start">
        <TabsTrigger value="hospitals" className="gap-2"><HospitalIcon className="h-4 w-4" aria-hidden />Hospitals <span className="tabular-nums">({q.data ? hospitals.length : "…"})</span></TabsTrigger>
        <TabsTrigger value="doctors" className="gap-2"><Stethoscope className="h-4 w-4" aria-hidden />Doctors <span className="tabular-nums">({q.data ? doctors.length : "…"})</span></TabsTrigger>
      </TabsList>
      {q.isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading queue">
          {times(3).map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          <TabsContent value="hospitals" className="space-y-4">
            {hospitals.length === 0
              ? <EmptyState icon={PartyPopper} text="No hospitals waiting for review." />
              : hospitals.map((h) => <HospitalCard key={h.id} h={h} onRemoved={hide} />)}
          </TabsContent>
          <TabsContent value="doctors" className="space-y-4">
            {doctors.length === 0
              ? <EmptyState icon={PartyPopper} text="No doctors waiting for review." />
              : doctors.map((d) => <DoctorCard key={d.id} d={d} onRemoved={hide} />)}
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}
