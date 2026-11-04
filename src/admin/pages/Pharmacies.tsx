// /admin/pharmacies: fee settings, admin_list_pharmacies() and a detail drawer with
// suspend / restore / hide / show and the pharmacy's fee rows.
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pill, SearchX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { nairaToKobo } from "@/lib/pharmacy";
import {
  PHARMACY_PAGE, useFeeSettings, usePharmacies, usePharmacyFees, usePharmacyMembers, useSetFeeSettings, useSetFeeStatus,
  useSetPharmacyStatus, type FeeStatus, type PharmacyRow,
} from "../pharmacy-api";
import { actionError, fmtDate, fmtNum, koboToNaira, naira } from "../format";
import { EmptyState, ErrorState, Fact, ListSkeleton, MobileRow, Section, StatusBadge, VerificationBadge } from "../components/bits";
import { DataTable, FilterBar, FilterSelect, MobileList, SearchBox, Td, Th, Tr } from "../components/list";
import { DetailPanel } from "../components/DetailPanel";
import { ConfirmDialog, ReasonDialog } from "../components/dialogs";
import { useUrlSearch, useUrlState } from "../components/url-state";
import { LicenceExpiry } from "../components/LicenceExpiry";

const STATUS = [
  { value: "all", label: "All" }, { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" }, { value: "suspended", label: "Suspended" },
];
const FEE_STATUSES: FeeStatus[] = ["accrued", "waived", "invoiced", "paid"];
const FEE_LABEL: Record<FeeStatus, string> = { accrued: "Accrued", waived: "Waived", invoiced: "Invoiced", paid: "Paid" };

function ListedBadge({ p }: { p: Pick<PharmacyRow, "is_listed" | "paused_reason"> }) {
  return p.is_listed ? <StatusBadge tone="good" label="Listed" /> : <StatusBadge tone="warn" label={p.paused_reason ? "Paused" : "Hidden"} />;
}

function FeeSettingsCard() {
  const q = useFeeSettings();
  const save = useSetFeeSettings();
  const [fee, setFee] = useState("");
  const [confirmOn, setConfirmOn] = useState(false);
  useEffect(() => { if (q.data) setFee(String(koboToNaira(q.data.fee_kobo))); }, [q.data]);

  const feeKobo = nairaToKobo(fee);
  const run = (v: { fee_kobo?: number; billing_enabled?: boolean }, ok: string) =>
    save.mutateAsync(v).then(() => toast.success(ok), (e) => toast.error("Couldn't save", { description: actionError(e) }));

  return (
    <Section title="Pharmacy fee" className="mb-6">
      {q.isLoading ? <ListSkeleton rows={2} /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data && (
        <div className="space-y-4" data-testid="fee-settings">
          <p className="text-sm text-muted-foreground">
            One fee for each patient who collects a prescription they sent through HealingNet. While billing is off, every fee is recorded as waived at ₦0.
          </p>
          <form className="flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={(e) => {
            e.preventDefault();
            if (feeKobo === null) return toast.error("Enter the fee in naira, e.g. 200");
            run({ fee_kobo: feeKobo }, "Fee saved");
          }}>
            <div className="space-y-1.5">
              <Label htmlFor="fee-naira">Fee per patient (₦)</Label>
              <Input id="fee-naira" inputMode="decimal" className="sm:w-40" value={fee} onChange={(e) => setFee(e.target.value)} />
            </div>
            <Button type="submit" variant="outline" disabled={save.isPending || feeKobo === q.data.fee_kobo}>Save fee</Button>
          </form>
          <div className="flex flex-wrap items-center gap-3">
            <Switch id="billing-on" checked={q.data.billing_enabled} disabled={save.isPending}
              onCheckedChange={(on) => (on ? setConfirmOn(true) : run({ billing_enabled: false }, "Billing turned off"))} />
            <Label htmlFor="billing-on">Billing on</Label>
            <StatusBadge tone={q.data.billing_enabled ? "warn" : "neutral"} label={q.data.billing_enabled ? `On · ${naira(koboToNaira(q.data.fee_kobo))} per patient` : "Off (free while we launch)"} />
          </div>
          <ConfirmDialog
            open={confirmOn} onOpenChange={setConfirmOn} confirmLabel="Turn billing on" destructive busy={save.isPending}
            title="Turn billing on?"
            description={`Pharmacies will start owing ${naira(koboToNaira(q.data.fee_kobo))} per patient collected through HealingNet. Only turn this on after legal review.`}
            onConfirm={() => { setConfirmOn(false); run({ billing_enabled: true }, "Billing turned on"); }}
          />
        </div>
      )}
    </Section>
  );
}

function PharmacyDrawer({ p, onClose }: { p: PharmacyRow | null; onClose: () => void }) {
  const fees = usePharmacyFees(p?.id ?? null);
  const members = usePharmacyMembers(p?.id ?? null);
  const setStatus = useSetPharmacyStatus();
  const setFee = useSetFeeStatus();
  const [ask, setAsk] = useState<null | "suspend" | "hide">(null);
  const [confirm, setConfirm] = useState<null | "restore" | "show">(null);
  if (!p) return null;

  const run = (v: { status: "approved" | "suspended"; listed: boolean; reason?: string }, ok: string) => {
    setAsk(null);
    setConfirm(null);
    setStatus.mutateAsync({ id: p.id, ...v }).then(() => { toast.success(ok); onClose(); }, (e) => toast.error("Couldn't change the pharmacy", { description: actionError(e) }));
  };
  const approved = p.verification_status === "approved";
  const suspended = p.verification_status === "suspended";

  return (
    <DetailPanel open={!!p} onOpenChange={(o) => !o && onClose()} title={p.name}
      subtitle={<div className="flex flex-wrap gap-2"><VerificationBadge status={p.verification_status} /><ListedBadge p={p} /></div>}>
      <div className="space-y-5" data-testid="pharmacy-drawer">
        {p.paused_reason && <p className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm">{p.paused_reason}</p>}
        <dl className="grid grid-cols-2 gap-3">
          <Fact label="Address">{[p.address, p.city, p.state].filter(Boolean).join(", ")}</Fact>
          <Fact label="Phone">{p.phone}</Fact>
          <Fact label="Email">{p.email}</Fact>
          <Fact label="Premises licence">{p.premises_licence_no}</Fact>
          <Fact label="Licence expiry"><LicenceExpiry date={p.premises_licence_expiry} /></Fact>
          <Fact label="Superintendent">{[p.superintendent_name, p.superintendent_pcn_no && `PCN ${p.superintendent_pcn_no}`].filter(Boolean).join(" · ")}</Fact>
          <Fact label="Requests (30 days)">{fmtNum(p.requests_30d)}</Fact>
          <Fact label="Collected (30 days)">{fmtNum(p.collected_30d)}</Fact>
          <Fact label="Fees accrued">{naira(koboToNaira(p.fees_accrued_kobo))}</Fact>
          <Fact label="Signed up">{fmtDate(p.created_at)}</Fact>
        </dl>

        <div className="flex flex-wrap gap-2">
          {approved && <Button variant="outline" className="border-destructive/40 text-destructive" onClick={() => setAsk("suspend")}>Suspend</Button>}
          {suspended && <Button variant="outline" onClick={() => setConfirm("restore")}>Restore</Button>}
          {approved && p.is_listed && <Button variant="outline" onClick={() => setAsk("hide")}>Hide from patients</Button>}
          {approved && !p.is_listed && <Button variant="outline" onClick={() => setConfirm("show")}>Show to patients</Button>}
          {!approved && !suspended && <p className="text-sm text-muted-foreground">Approve or reject this pharmacy on the Verifications page.</p>}
        </div>

        <section>
          <h3 className="mb-2 font-heading font-bold">Team</h3>
          {members.isLoading ? <ListSkeleton rows={2} /> : members.isError ? <ErrorState error={members.error} onRetry={() => members.refetch()} /> : (
            <ul className="divide-y rounded-xl border text-sm">
              {(members.data ?? []).map((m) => (
                <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span className="min-w-0">{`${m.first_name} ${m.last_name}`.trim()} <span className="text-muted-foreground">· {m.role}{m.pcn_reg_no ? ` · PCN ${m.pcn_reg_no}` : ""}</span></span>
                  <VerificationBadge status={m.verification_status} active={m.is_active} />
                </li>
              ))}
              {members.data?.length === 0 && <li className="p-3 text-muted-foreground">No members.</li>}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-2 font-heading font-bold">Fees</h3>
          {fees.isLoading ? <ListSkeleton rows={2} /> : fees.isError ? <ErrorState error={fees.error} onRetry={() => fees.refetch()} /> : (fees.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No fees yet. A fee is recorded when a patient collects a prescription they sent through HealingNet.</p>
          ) : (
            <ul className="divide-y rounded-xl border text-sm" data-testid="pharmacy-fee-rows">
              {(fees.data ?? []).map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                  <span>{fmtDate(f.created_at)} · <span className="font-medium">{naira(koboToNaira(f.amount_kobo))}</span>{f.note ? <span className="text-muted-foreground"> · {f.note}</span> : null}</span>
                  <Select value={f.status} disabled={setFee.isPending}
                    onValueChange={(v) => setFee.mutateAsync({ id: f.id, pharmacyId: p.id, status: v as FeeStatus })
                      .then(() => toast.success(`Fee marked ${FEE_LABEL[v as FeeStatus].toLowerCase()}`), (e) => toast.error("Couldn't change the fee", { description: actionError(e) }))}>
                    <SelectTrigger className="h-9 w-32" aria-label="Fee status"><SelectValue /></SelectTrigger>
                    <SelectContent>{FEE_STATUSES.map((s) => <SelectItem key={s} value={s}>{FEE_LABEL[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ReasonDialog open={ask === "suspend"} onOpenChange={(o) => !o && setAsk(null)} confirmLabel="Suspend" destructive busy={setStatus.isPending}
        title={`Suspend ${p.name}?`} description="They can't receive requests or dispense, and patients can't find them. They see this reason."
        onConfirm={(r) => run({ status: "suspended", listed: false, reason: r }, `${p.name} suspended`)} />
      <ReasonDialog open={ask === "hide"} onOpenChange={(o) => !o && setAsk(null)} confirmLabel="Hide" busy={setStatus.isPending}
        title={`Hide ${p.name} from patients?`} description="They stay verified and can still dispense, but patients can't find them in the directory."
        onConfirm={(r) => run({ status: "approved", listed: false, reason: r }, `${p.name} hidden`)} />
      <ConfirmDialog open={confirm === "restore"} onOpenChange={(o) => !o && setConfirm(null)} confirmLabel="Restore" busy={setStatus.isPending}
        title={`Restore ${p.name}?`} description="The pharmacy becomes approved and listed again."
        onConfirm={() => run({ status: "approved", listed: true }, `${p.name} restored`)} />
      <ConfirmDialog open={confirm === "show"} onOpenChange={(o) => !o && setConfirm(null)} confirmLabel="Show" busy={setStatus.isPending}
        title={`Show ${p.name} to patients?`} description="The pharmacy appears in the directory again."
        onConfirm={() => run({ status: "approved", listed: true }, `${p.name} is listed again`)} />
    </DetailPanel>
  );
}

export default function Pharmacies() {
  const { get, set, page } = useUrlState();
  const search = useUrlSearch();
  const status = get("status");
  const q = usePharmacies({ search: search.value, status, page });
  const [open, setOpen] = useState<PharmacyRow | null>(null);
  const rows = q.data ?? [];
  const filtered = !!(search.value || status);

  return (
    <div>
      <FeeSettingsCard />
      <FilterBar>
        <SearchBox value={search.text} onChange={search.setText} placeholder="Name or city" label="Search pharmacies" />
        <FilterSelect label="Status" value={status} options={STATUS} onChange={(v) => set({ status: v })} />
      </FilterBar>

      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? (
        <EmptyState icon={filtered ? SearchX : Pill} text={filtered ? "No pharmacies match these filters." : "No pharmacies have signed up yet."}
          action={filtered ? <Button variant="outline" size="sm" onClick={() => { search.setText(""); set({ q: null, status: null }); }}>Clear filters</Button> : undefined} />
      ) : (
        <>
          <DataTable dim={q.isPlaceholderData} head={<><Th>Pharmacy</Th><Th>Place</Th><Th>Status</Th><Th>Directory</Th><Th className="text-right">Team</Th><Th className="text-right">Requests 30 d</Th><Th className="text-right">Collected 30 d</Th><Th className="text-right">Fees accrued</Th></>}>
            {rows.map((p) => (
              <Tr key={p.id} onOpen={() => setOpen(p)} label={`Open ${p.name}`}>
                <Td className="font-medium">{p.name}</Td>
                <Td>{[p.city, p.state].filter(Boolean).join(", ") || "—"}</Td>
                <Td><VerificationBadge status={p.verification_status} /></Td>
                <Td><ListedBadge p={p} /></Td>
                <Td className="text-right tabular-nums">{fmtNum(p.members)}</Td>
                <Td className="text-right tabular-nums">{fmtNum(p.requests_30d)}</Td>
                <Td className="text-right tabular-nums">{fmtNum(p.collected_30d)}</Td>
                <Td className="text-right tabular-nums">{naira(koboToNaira(p.fees_accrued_kobo))}</Td>
              </Tr>
            ))}
          </DataTable>
          <MobileList dim={q.isPlaceholderData}>
            {rows.map((p) => (
              <MobileRow key={p.id} title={p.name} onOpen={() => setOpen(p)} status={<VerificationBadge status={p.verification_status} />}
                facts={[[p.city, p.state].filter(Boolean).join(", ") || "No city", `${fmtNum(p.collected_30d)} collected in 30 days`]} />
            ))}
          </MobileList>
          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => set({ page: page - 1 })}><ChevronLeft className="h-4 w-4" aria-hidden />Previous</Button>
            <span className="text-sm tabular-nums text-muted-foreground">Page {page}</span>
            <Button variant="outline" size="sm" disabled={rows.length < PHARMACY_PAGE} onClick={() => set({ page: page + 1 })}>Next<ChevronRight className="h-4 w-4" aria-hidden /></Button>
          </div>
        </>
      )}
      <PharmacyDrawer p={open} onClose={() => setOpen(null)} />
    </div>
  );
}
