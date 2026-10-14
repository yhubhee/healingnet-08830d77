// /admin/hospitals: admin_list_hospitals(), filters / search / page in the URL.
import { Hospital, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHospitals } from "../api";
import { fmtDate, fmtNum } from "../format";
import { EmptyState, ErrorState, ListSkeleton, MobileRow, Pager, PlanBadge, RelTime, VerificationBadge } from "../components/bits";
import { DataTable, FilterBar, FilterSelect, MobileList, SearchBox, Td, Th, Tr } from "../components/list";
import { useUrlSearch, useUrlState } from "../components/url-state";
import { useDetail } from "../components/detail-state";

const STATUS = [
  { value: "all", label: "All" }, { value: "pending", label: "Pending" }, { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" }, { value: "suspended", label: "Suspended" },
];
const PLAN = [
  { value: "all", label: "All" }, { value: "trialing", label: "Trialing" }, { value: "emr", label: "EMR" },
  { value: "telemedicine", label: "Telemedicine" }, { value: "lapsed", label: "Lapsed" }, { value: "none", label: "None" },
];

export default function Hospitals() {
  const { get, set, page } = useUrlState();
  const search = useUrlSearch();
  const status = get("status");
  const plan = get("plan");
  const q = useHospitals({ search: search.value, status, plan, page });
  const { open } = useDetail();
  const filtered = !!(search.value || status || plan);

  return (
    <div>
      <FilterBar>
        <SearchBox value={search.text} onChange={search.setText} placeholder="Name, email, city or state" label="Search hospitals" />
        <FilterSelect label="Status" value={status} options={STATUS} onChange={(v) => set({ status: v })} />
        <FilterSelect label="Plan" value={plan} options={PLAN} onChange={(v) => set({ plan: v })} />
      </FilterBar>

      {q.isLoading ? <ListSkeleton /> : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data && q.data.rows.length === 0 ? (
        <EmptyState
          icon={filtered ? SearchX : Hospital} text={filtered ? "No hospitals match these filters." : "No hospitals have signed up yet."}
          action={filtered ? <Button variant="outline" size="sm" onClick={() => { search.setText(""); set({ q: null, status: null, plan: null }); }}>Clear filters</Button> : undefined}
        />
      ) : q.data && (
        <>
          <DataTable dim={q.isPlaceholderData} head={<>
            <Th>Hospital</Th><Th>Verification</Th><Th>Plan</Th><Th className="text-right">Staff</Th>
            <Th className="text-right">Doctors</Th><Th className="text-right">Patients</Th><Th>Joined</Th>
          </>}>
            {q.data.rows.map((h) => (
              <Tr key={h.id} onOpen={() => open("hospital", h.id)} label={`Open ${h.name}`}>
                <Td><div className="font-medium">{h.name}</div><div className="text-xs text-muted-foreground">{[h.city, h.state].filter(Boolean).join(", ") || "—"}</div></Td>
                <Td><VerificationBadge status={h.verification_status} active={h.is_active} /></Td>
                <Td><PlanBadge plan={h.plan_state} trialEndsAt={h.trial_ends_at} planExpiresAt={h.plan_expires_at} /></Td>
                <Td className="text-right">{fmtNum(h.staff)}</Td>
                <Td className="text-right">{fmtNum(h.doctors)}</Td>
                <Td className="text-right">{fmtNum(h.patients)}</Td>
                <Td><RelTime iso={h.created_at} /></Td>
              </Tr>
            ))}
          </DataTable>
          <MobileList dim={q.isPlaceholderData}>
            {q.data.rows.map((h) => (
              <MobileRow
                key={h.id} onOpen={() => open("hospital", h.id)}
                title={h.name}
                facts={[[h.city, h.state].filter(Boolean).join(", ") || "No location", `${fmtNum(h.patients)} patients`, `Joined ${fmtDate(h.created_at)}`]}
                status={<div className="flex flex-wrap gap-1.5"><VerificationBadge status={h.verification_status} active={h.is_active} /><PlanBadge plan={h.plan_state} trialEndsAt={h.trial_ends_at} planExpiresAt={h.plan_expires_at} /></div>}
              />
            ))}
          </MobileList>
          <Pager page={page} total={q.data.total} onPage={(p) => set({ page: p })} fetching={q.isFetching} />
        </>
      )}
    </div>
  );
}
