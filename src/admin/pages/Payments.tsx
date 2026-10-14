// /admin/payments: admin_list_payments(); refunds are resolved after refunding in Paystack.
import { useState } from "react";
import { CheckCircle2, CreditCard, ExternalLink, RotateCcw, SearchX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePayments, useResolveRefund, type PaymentRow } from "../api";
import { actionError, fmtDateTime, koboToNaira, naira, titleCase } from "../format";
import { CopyButton, EmptyState, ErrorState, ListSkeleton, Money, MobileRow, Pager, PaymentStatusBadge, RelTime } from "../components/bits";
import { DataTable, FilterBar, FilterSelect, MobileList, SearchBox, Td, Th, Tr } from "../components/list";
import { ReasonDialog } from "../components/dialogs";
import { useUrlSearch, useUrlState } from "../components/url-state";
import { useDetail } from "../components/detail-state";

const PAYSTACK_DASHBOARD = "https://dashboard.paystack.com/#/transactions";

const STATUS = [
  { value: "all", label: "All" }, { value: "success", label: "Success" }, { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" }, { value: "abandoned", label: "Abandoned" },
];
const PURPOSE = [
  { value: "all", label: "All" }, { value: "subscription", label: "Subscription" }, { value: "consultation", label: "Consultation" },
  { value: "billing", label: "Billing" }, { value: "pharmacy", label: "Pharmacy" },
];
const TABS = { all: null, refunds: "refund_needed", resolved: "refund_resolved" } as const;
type Tab = keyof typeof TABS;

function purposeText(p: PaymentRow) {
  const plan = p.plan ? ` · ${p.plan === "emr" ? "EMR" : titleCase(p.plan)}${p.billing_cycle ? ` (${p.billing_cycle})` : ""}` : "";
  return titleCase(p.purpose) + plan;
}

export default function Payments() {
  const { get, set, page } = useUrlState();
  const search = useUrlSearch();
  const tabParam = get("tab", "all");
  const tab: Tab = tabParam in TABS ? (tabParam as Tab) : "all";
  const status = get("status");
  const purpose = get("purpose");
  const q = usePayments({ status, purpose, review: TABS[tab] ?? undefined, search: search.value, page });
  const resolve = useResolveRefund();
  const [resolving, setResolving] = useState<PaymentRow | null>(null);
  const { open } = useDetail();
  const filtered = !!(search.value || status || purpose);

  const action = (p: PaymentRow) => (
    <div className="flex items-center gap-1">
      {p.review === "duplicate_payment_refund_needed" && (
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setResolving(p); }}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Mark refunded
        </Button>
      )}
      {p.paystack_reference && (
        <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
          <a href={PAYSTACK_DASHBOARD} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label={`View ${p.paystack_reference} in Paystack (opens in a new tab)`} title="View in Paystack">
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <Tabs value={tab} onValueChange={(v) => set({ tab: v === "all" ? null : v })} className="mb-4">
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="refunds">Refunds needed</TabsTrigger>
          <TabsTrigger value="resolved">Refunds resolved</TabsTrigger>
        </TabsList>
      </Tabs>
      <FilterBar>
        <SearchBox value={search.text} onChange={search.setText} placeholder="Paystack reference or hospital" label="Search payments" />
        <FilterSelect label="Status" value={status} options={STATUS} onChange={(v) => set({ status: v })} />
        <FilterSelect label="Purpose" value={purpose} options={PURPOSE} onChange={(v) => set({ purpose: v })} />
        <a href={PAYSTACK_DASHBOARD} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline sm:ml-auto">
          Paystack dashboard<ExternalLink className="h-3.5 w-3.5" aria-hidden /><span className="sr-only">(opens in a new tab)</span>
        </a>
      </FilterBar>

      {q.data && (
        <p className="mb-3 rounded-xl border bg-card px-4 py-2 text-sm" aria-live="polite">
          <span className="font-bold tabular-nums">{naira(koboToNaira(q.data.total_success_kobo))}</span>{" "}
          <span className="text-muted-foreground">successful in this view</span>
        </p>
      )}

      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data && q.data.rows.length === 0 ? (
        tab === "refunds" && !filtered
          ? <EmptyState icon={CheckCircle2} text="No refunds waiting. Nice." />
          : <EmptyState icon={filtered ? SearchX : CreditCard} text={filtered ? "No payments match these filters." : "No payments here yet."}
              action={filtered ? <Button variant="outline" size="sm" onClick={() => { search.setText(""); set({ q: null, status: null, purpose: null }); }}>Clear filters</Button> : undefined} />
      ) : q.data && (
        <>
          <DataTable dim={q.isPlaceholderData} head={<>
            <Th>Date</Th><Th>Hospital</Th><Th>Purpose</Th><Th className="text-right">Amount</Th><Th>Status</Th><Th>Payer</Th><Th>Reference</Th><Th><span className="sr-only">Actions</span></Th>
          </>}>
            {q.data.rows.map((p) => (
              <Tr key={p.id}>
                <Td><RelTime iso={p.created_at} /></Td>
                <Td>
                  {p.hospital_id ? (
                    <button type="button" className="text-left underline-offset-2 hover:underline" onClick={() => open("hospital", p.hospital_id!)}>{p.hospital_name ?? "—"}</button>
                  ) : "—"}
                </Td>
                <Td>{purposeText(p)}</Td>
                <Td className="text-right font-medium"><Money value={koboToNaira(p.amount)} /></Td>
                <Td>
                  <PaymentStatusBadge status={p.status} review={p.review} />
                  {p.review === "refund_resolved" && p.review_note && <div className="mt-1 max-w-[12rem] truncate text-xs text-muted-foreground" title={p.review_note}>{p.review_note}</div>}
                </Td>
                <Td>{titleCase(p.payer_type)}</Td>
                <Td>
                  {p.paystack_reference ? (
                    <span className="flex items-center gap-1"><code className="max-w-[10rem] truncate text-xs" title={p.paystack_reference}>{p.paystack_reference}</code><CopyButton value={p.paystack_reference} label="Copy reference" /></span>
                  ) : "—"}
                </Td>
                <Td>{action(p)}</Td>
              </Tr>
            ))}
          </DataTable>
          <MobileList dim={q.isPlaceholderData}>
            {q.data.rows.map((p) => (
              <div key={p.id} className="space-y-2">
                <MobileRow
                  onOpen={() => (p.hospital_id ? open("hospital", p.hospital_id) : undefined)}
                  title={<span className="flex items-baseline justify-between gap-2"><span className="truncate">{p.hospital_name ?? titleCase(p.payer_type)}</span><Money value={koboToNaira(p.amount)} className="shrink-0" /></span>}
                  facts={[purposeText(p), fmtDateTime(p.created_at), p.paystack_reference ?? "No reference"]}
                  status={<PaymentStatusBadge status={p.status} review={p.review} />}
                />
                {p.review === "duplicate_payment_refund_needed" && (
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setResolving(p)}><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Mark refunded</Button>
                )}
              </div>
            ))}
          </MobileList>
          <Pager page={page} total={q.data.total} onPage={(n) => set({ page: n })} fetching={q.isFetching} />
        </>
      )}

      <ReasonDialog
        open={!!resolving} onOpenChange={(o) => !o && setResolving(null)}
        title="Mark refund as done" confirmLabel="Mark refunded" busy={resolve.isPending}
        label="Paystack refund reference" placeholder="e.g. RFD_xxxxxxxx"
        description={resolving && (
          <div className="space-y-2">
            <p>{resolving.hospital_name ?? "A payer"} paid <strong className="tabular-nums">{naira(koboToNaira(resolving.amount))}</strong> twice (reference <code>{resolving.paystack_reference}</code>).</p>
            <ol className="list-decimal space-y-1 pl-5">
              <li>Refund it in the <a className="text-primary underline" href={PAYSTACK_DASHBOARD} target="_blank" rel="noopener noreferrer">Paystack dashboard</a> first.</li>
              <li>Paste the refund reference below.</li>
            </ol>
          </div>
        )}
        onConfirm={(note) => resolving && resolve.mutate({ id: resolving.id, note }, {
          onSuccess: () => { setResolving(null); toast.success("Refund marked as done"); },
          onError: (e) => toast.error("Couldn't mark the refund", { description: actionError(e) }),
        })}
      />
    </div>
  );
}
