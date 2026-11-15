// /admin/performance: which screens and requests are slow, from the speed data the app and
// the website send (admin_perf_summary, admin_perf_trend). No user ids, no health data:
// only a route or endpoint name, a time, and whether it worked.
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { AlertTriangle, CheckCircle2, Timer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { usePerfSummary, usePerfTrend, type PerfRow, type PerfTrendPoint } from "../api";
import { fmtDay, fmtNum, times } from "../format";
import { EmptyState, ErrorState, MobileRow, RelTime, Section, StatusBadge } from "../components/bits";
import { C } from "../components/charts";
import { DataTable, FilterBar, FilterSelect, MobileList, Td, Th, Tr } from "../components/list";
import { useUrlState } from "../components/url-state";

const PERIODS = [{ value: "7", label: "7 days" }, { value: "14", label: "14 days" }, { value: "30", label: "30 days" }];
const PLATFORMS = [{ value: "all", label: "All" }, { value: "android", label: "Android" }, { value: "ios", label: "iOS" }, { value: "web", label: "Web" }];
const KINDS = [{ value: "all", label: "All" }, { value: "screen", label: "Screens" }, { value: "request", label: "Requests" }, { value: "startup", label: "Start-up" }];
const KIND_LABEL: Record<string, string> = { screen: "Screen", request: "Request", startup: "Start-up" };

/** "850 ms" under a second, "3.4 s" above. */
export function fmtMs(ms: number | null | undefined): string {
  const n = Number(ms) || 0;
  return n < 1000 ? `${Math.round(n)} ms` : `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)} s`;
}
const pct = (share: number) => `${Math.round((Number(share) || 0) * 100)}%`;
/** Over its limit: 9 in 10 uses should finish within the limit for that kind (0.5 s screen, 1 s request, 3 s start-up). */
const isSlow = (r: PerfRow) => r.p90_ms > r.slow_ms;
const rowKey = (r: { kind: string; name: string }) => `${r.kind}|${r.name}`;

function SlowBadge({ row }: { row: PerfRow }) {
  return isSlow(row)
    ? <StatusBadge tone="bad" label="Slow" icon={AlertTriangle} />
    : <StatusBadge tone="good" label="OK" icon={CheckCircle2} />;
}

/** p50 and p90 per day, one pair of lines per app version, so a release can be compared with the one before. */
function Trend({ row, days, platform }: { row: PerfRow; days: number; platform: string }) {
  const q = usePerfTrend(row, days);
  const { data, versions, config } = useMemo(() => {
    const points = (q.data ?? []).filter((p) => !platform || p.platform === platform);
    const versions = [...new Set(points.map((p) => p.app_version ?? "unknown"))].sort().slice(-4);
    // Several platforms on one day and version: weighted by how many samples each had.
    const byDay = new Map<string, Record<string, { p50: number; p90: number; n: number }>>();
    for (const p of points as PerfTrendPoint[]) {
      const v = p.app_version ?? "unknown";
      if (!versions.includes(v)) continue;
      const day = byDay.get(p.day) ?? {};
      const cur = day[v] ?? { p50: 0, p90: 0, n: 0 };
      day[v] = { p50: cur.p50 + p.p50_ms * p.samples, p90: cur.p90 + p.p90_ms * p.samples, n: cur.n + p.samples };
      byDay.set(p.day, day);
    }
    const data = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, vs]) => {
      const out: Record<string, number | string> = { day };
      versions.forEach((v, i) => { if (vs[v]?.n) { out[`v${i}p50`] = Math.round(vs[v].p50 / vs[v].n); out[`v${i}p90`] = Math.round(vs[v].p90 / vs[v].n); } });
      return out;
    });
    const colors = [C.c1, C.c2, C.c3, C.c4];
    const config: ChartConfig = {};
    versions.forEach((v, i) => {
      config[`v${i}p90`] = { label: `${v}: slow end (p90)`, color: colors[i % colors.length] };
      config[`v${i}p50`] = { label: `${v}: typical (p50)`, color: colors[i % colors.length] };
    });
    return { data, versions, config };
  }, [q.data, platform]);

  if (q.isLoading) return <Skeleton className="h-64 rounded-2xl" />;
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No daily data for this period.</p>;
  const summary = `${row.name}: typical time and slow-end time per day for version${versions.length === 1 ? "" : "s"} ${versions.join(", ")}.`;
  return (
    <figure>
      <ChartContainer config={config} className="w-full" style={{ height: 280 }} role="img" aria-label={summary}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(d: string) => fmtDay(d)} className="text-[11px]" />
          <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v: number) => fmtMs(v)} className="text-[11px] tabular-nums" />
          <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => fmtDay(String(p?.[0]?.payload?.day ?? ""), true)}
            formatter={(v, name, item) => (
              <div className="flex w-full items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: item.color }} />
                <span className="text-muted-foreground">{config[name as string]?.label}</span>
                <span className="ml-auto font-mono font-medium tabular-nums">{fmtMs(Number(v))}</span>
              </div>
            )} />} />
          <ChartLegend content={<ChartLegendContent />} />
          {versions.flatMap((_, i) => [
            <Line key={`v${i}p90`} dataKey={`v${i}p90`} type="monotone" stroke={`var(--color-v${i}p90)`} strokeWidth={2} dot={{ r: 2 }} connectNulls />,
            // The typical line is dashed, so the two are told apart without relying on colour.
            <Line key={`v${i}p50`} dataKey={`v${i}p50`} type="monotone" stroke={`var(--color-v${i}p50)`} strokeWidth={2} strokeDasharray="4 4" dot={{ r: 2 }} connectNulls />,
          ])}
        </LineChart>
      </ChartContainer>
      <figcaption className="mt-2 text-xs text-muted-foreground">Solid line: slow-end time (p90). Dashed line: typical time (p50). One colour per app version.</figcaption>
    </figure>
  );
}

export default function Performance() {
  const { get, set } = useUrlState();
  const days = [7, 14, 30].includes(Number(get("days", "7"))) ? Number(get("days", "7")) : 7;
  const platform = PLATFORMS.some((p) => p.value === get("platform")) ? get("platform") : "";
  const kind = KINDS.some((k) => k.value === get("kind")) ? get("kind") : "";
  const q = usePerfSummary({ days, platform, kind });
  const [open, setOpen] = useState<string | null>(null);
  const rows = q.data ?? [];
  const worst = rows.filter(isSlow).slice(0, 5);
  const selected = rows.find((r) => rowKey(r) === open) ?? null;
  const toggle = (r: PerfRow) => setOpen((cur) => (cur === rowKey(r) ? null : rowKey(r)));

  return (
    <div className="space-y-6">
      <FilterBar>
        <FilterSelect label="Period" value={String(days)} options={PERIODS} onChange={(v) => set({ days: v === "7" ? null : v })} />
        <FilterSelect label="Platform" value={platform} options={PLATFORMS} onChange={(v) => set({ platform: v })} />
        <FilterSelect label="Kind" value={kind} options={KINDS} onChange={(v) => set({ kind: v })} />
      </FilterBar>

      {q.isLoading ? (
        <div className="space-y-4" aria-busy="true" aria-label="Loading speed data">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{times(5).map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      ) : q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : rows.length === 0 ? (
        <EmptyState icon={Timer} text="No speed data yet. It appears after people use version 0.4 of the app or the website." />
      ) : (
        <>
          <section aria-labelledby="fix-heading" className="space-y-3">
            <h2 id="fix-heading" className="font-heading text-lg font-bold">Fix these first</h2>
            {worst.length === 0 ? (
              <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">Nothing is over its limit in this period.</p>
            ) : (
              <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {worst.map((r) => (
                  <li key={rowKey(r)}>
                    <button type="button" onClick={() => setOpen(rowKey(r))}
                      className="block h-full w-full rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-left transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <p className="text-xs text-muted-foreground">{KIND_LABEL[r.kind] ?? r.kind}</p>
                      <p className="break-all font-mono text-sm font-medium">{r.name}</p>
                      <p className="mt-2 text-sm">9 in 10 finish within <strong className="tabular-nums">{fmtMs(r.p90_ms)}</strong></p>
                      <p className="text-xs text-muted-foreground">Slow {pct(r.slow_share)} of the time (limit {fmtMs(r.slow_ms)}) · {fmtNum(r.samples)} samples</p>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {selected && (
            <Section title={<span className="break-all font-mono text-sm">{selected.name}</span>}
              action={<button type="button" className="text-sm text-primary underline-offset-2 hover:underline" onClick={() => setOpen(null)}>Close chart</button>}>
              <Trend row={selected} days={Math.max(days, 14)} platform={platform} />
            </Section>
          )}

          <section aria-labelledby="all-heading" className="space-y-3">
            <h2 id="all-heading" className="font-heading text-lg font-bold">Everything measured</h2>
            <p className="text-sm text-muted-foreground">
              Typical time (p50) is what half of all uses finish within; slow-end time (p90) is what 9 in 10 finish within, so it shows what the slower phones and connections get.
              Sorted by slow-end time. Select a row to see it day by day, per app version.
            </p>
            <DataTable dim={q.isFetching} head={<>
              <Th>Name</Th><Th>Kind</Th><Th className="text-right">Samples</Th><Th className="text-right">Typical (p50)</Th><Th className="text-right">Slow end (p90)</Th>
              <Th className="text-right">Worst</Th><Th className="text-right">% slow</Th><Th className="text-right">% failed</Th><Th>Last seen</Th><Th>Versions</Th><Th>Status</Th>
            </>}>
              {rows.map((r) => (
                <Tr key={rowKey(r)} onOpen={() => toggle(r)} label={`${r.name}, ${isSlow(r) ? "slow" : "OK"}, 9 in 10 finish within ${fmtMs(r.p90_ms)}. Show the daily chart`}>
                  <Td className="max-w-[18rem] break-all font-mono text-xs">{r.name}</Td>
                  <Td>{KIND_LABEL[r.kind] ?? r.kind}</Td>
                  <Td className="text-right">{fmtNum(r.samples)}</Td>
                  <Td className="text-right">{fmtMs(r.p50_ms)}</Td>
                  <Td className="text-right font-medium">{fmtMs(r.p90_ms)}</Td>
                  <Td className="text-right">{fmtMs(r.max_ms)}</Td>
                  <Td className="text-right">{pct(r.slow_share)}</Td>
                  <Td className="text-right">{pct(r.error_share)}</Td>
                  <Td className="whitespace-nowrap"><RelTime iso={r.last_seen} /></Td>
                  <Td className="text-xs">{(r.versions ?? []).join(", ") || "—"}</Td>
                  <Td><SlowBadge row={r} /></Td>
                </Tr>
              ))}
            </DataTable>
            <MobileList dim={q.isFetching}>
              {rows.map((r) => (
                <MobileRow key={rowKey(r)} onOpen={() => toggle(r)}
                  title={<span className="break-all font-mono text-xs">{r.name}</span>}
                  facts={[`${KIND_LABEL[r.kind] ?? r.kind} · ${fmtNum(r.samples)} samples`, `Typical ${fmtMs(r.p50_ms)} · slow end ${fmtMs(r.p90_ms)} · worst ${fmtMs(r.max_ms)}`, `${pct(r.slow_share)} slow · ${pct(r.error_share)} failed`]}
                  status={<SlowBadge row={r} />} />
              ))}
            </MobileList>
          </section>
        </>
      )}
    </div>
  );
}
