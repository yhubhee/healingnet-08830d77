// /admin/doctors: admin_list_doctors(), filters / search / page in the URL.
import { SearchX, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDoctors } from "../api";
import { daysUntil, fmtNum } from "../format";
import { EmptyState, ErrorState, ListSkeleton, MobileRow, Pager, RelTime, StatusBadge, VerificationBadge } from "../components/bits";
import { DataTable, FilterBar, FilterSelect, MobileList, SearchBox, Td, Th, Tr } from "../components/list";
import { LicenceExpiry } from "../components/LicenceExpiry";
import { useUrlSearch, useUrlState } from "../components/url-state";
import { useDetail } from "../components/detail-state";

const STATUS = [
  { value: "all", label: "All" }, { value: "unverified", label: "Unverified" }, { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Approved" }, { value: "rejected", label: "Rejected" },
];

function LicenceFlag({ date }: { date: string | null }) {
  const d = daysUntil(date ? date + "T23:59:59+01:00" : null);
  if (d == null) return null;
  if (d < 0) return <StatusBadge tone="bad" label="Licence expired" />;
  if (d <= 30) return <StatusBadge tone="warn" label={`Licence: ${d} d left`} />;
  return null;
}

export default function Doctors() {
  const { get, set, page } = useUrlState();
  const search = useUrlSearch();
  const status = get("status");
  const q = useDoctors({ search: search.value, status, page });
  const { open } = useDetail();
  const filtered = !!(search.value || status);

  return (
    <div>
      <FilterBar>
        <SearchBox value={search.text} onChange={search.setText} placeholder="Name, email, specialty or licence" label="Search doctors" />
        <FilterSelect label="Status" value={status} options={STATUS} onChange={(v) => set({ status: v })} />
      </FilterBar>

      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data && q.data.rows.length === 0 ? (
        <EmptyState
          icon={filtered ? SearchX : Stethoscope} text={filtered ? "No doctors match these filters." : "No doctors have signed up yet."}
          action={filtered ? <Button variant="outline" size="sm" onClick={() => { search.setText(""); set({ q: null, status: null }); }}>Clear filters</Button> : undefined}
        />
      ) : q.data && (
        <>
          <DataTable dim={q.isPlaceholderData} head={<>
            <Th>Doctor</Th><Th>Verification</Th><Th>Licence</Th><Th>Expiry</Th><Th className="text-right">Hospitals</Th><Th>Joined</Th>
          </>}>
            {q.data.rows.map((d) => (
              <Tr key={d.id} onOpen={() => open("doctor", d.id)} label={`Open Dr ${d.name}`}>
                <Td><div className="font-medium">Dr {d.name}</div><div className="text-xs text-muted-foreground">{d.specialty || "—"}{d.years_experience != null ? ` · ${d.years_experience} yrs` : ""}</div></Td>
                <Td><VerificationBadge status={d.verification_status} /></Td>
                <Td><div>{d.license_number || "—"}</div><div className="text-xs text-muted-foreground">{d.license_council?.split(" (")[0]}</div></Td>
                <Td><LicenceExpiry date={d.license_expiry} /></Td>
                <Td className="text-right">{fmtNum(d.hospitals)}</Td>
                <Td><RelTime iso={d.created_at} /></Td>
              </Tr>
            ))}
          </DataTable>
          <MobileList dim={q.isPlaceholderData}>
            {q.data.rows.map((d) => (
              <MobileRow
                key={d.id} onOpen={() => open("doctor", d.id)}
                title={`Dr ${d.name}`}
                facts={[d.specialty || "No specialty", d.license_number ? `Licence ${d.license_number}` : "No licence", `${fmtNum(d.hospitals)} hospitals`]}
                status={<div className="flex flex-wrap gap-1.5"><VerificationBadge status={d.verification_status} /><LicenceFlag date={d.license_expiry} /></div>}
              />
            ))}
          </MobileList>
          <Pager page={page} total={q.data.total} onPage={(p) => set({ page: p })} fetching={q.isFetching} />
        </>
      )}
    </div>
  );
}
