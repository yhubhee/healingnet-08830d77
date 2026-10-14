// Time-series charts for Overview and Activity (Recharts through the shadcn chart wrapper).
import { useMemo } from "react";
import { useQueries, keepPreviousData } from "@tanstack/react-query";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { fetchSeries, keys, type Metric } from "../api";
import { downloadCsv, fmtDay, fmtNum, naira, nairaShort, percentChange } from "../format";
import { ErrorState } from "./bits";
import { useUrlState } from "./url-state";

export const RANGES = [7, 30, 90, 365] as const;

/** Range selector bound to ?range= (default 30 days). */
export function useRange() {
  const { get, set } = useUrlState();
  const r = parseInt(get("range", "30"), 10);
  const days = (RANGES as readonly number[]).includes(r) ? r : 30;
  return { days, setDays: (d: number) => set({ range: d === 30 ? null : d, page: null }) };
}

export function RangeSelect({ days, onChange }: { days: number; onChange: (d: number) => void }) {
  return (
    <ToggleGroup
      type="single" value={String(days)} onValueChange={(v) => v && onChange(Number(v))}
      className="rounded-xl border p-0.5" aria-label="Date range"
    >
      {RANGES.map((r) => (
        <ToggleGroupItem key={r} value={String(r)} className="h-8 px-3 text-xs tabular-nums data-[state=on]:bg-primary data-[state=on]:text-primary-foreground" aria-label={`Last ${r} days`}>
          {r === 365 ? "1y" : `${r}d`}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export interface SeriesData {
  rows: Record<string, number | string>[]; // { day, [metric]: value } for the selected range
  totals: Record<string, number>;          // current-period totals
  previous: Record<string, number | null>; // previous-period totals (null when range is a year)
}

/**
 * Fetch several metrics for `days`. When possible it asks for double the range in one call
 * and splits it, so each chart can compare with the previous period.
 */
export function useMultiSeries(metrics: Metric[], days: number, live = false) {
  const fetchDays = days * 2 <= 365 ? days * 2 : days;
  const results = useQueries({
    queries: metrics.map((m) => ({
      queryKey: keys.series(m, fetchDays),
      queryFn: () => fetchSeries(m, fetchDays),
      placeholderData: keepPreviousData,
      meta: { inlineError: true },
      ...(live ? { refetchInterval: 60_000, refetchOnWindowFocus: true } : {}),
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const error = results.find((r) => r.isError)?.error;
  const dataKey = results.map((r) => r.dataUpdatedAt).join(",");

  const data = useMemo<SeriesData | null>(() => {
    if (results.some((r) => !r.data)) return null;
    const byDay = new Map<string, Record<string, number | string>>();
    const totals: Record<string, number> = {};
    const previous: Record<string, number | null> = {};
    metrics.forEach((m, i) => {
      const all = results[i].data!;
      const cur = all.slice(-days);
      const prev = fetchDays > days ? all.slice(0, all.length - days) : null;
      totals[m] = cur.reduce((s, p) => s + p.value, 0);
      previous[m] = prev ? prev.reduce((s, p) => s + p.value, 0) : null;
      for (const p of cur) {
        const row = byDay.get(p.day) ?? { day: p.day };
        row[m] = p.value;
        byDay.set(p.day, row);
      }
    });
    return { rows: [...byDay.values()].sort((a, b) => String(a.day).localeCompare(String(b.day))), totals, previous };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, days, metrics.join(",")]);

  return { data, isLoading, error, refetch: () => results.forEach((r) => r.refetch()) };
}

export interface SeriesSpec { key: Metric; label: string; color: string }

/** Sentence for screen readers and the caption, e.g. "Check-ins: 1,204, up 12% vs previous 30 days." */
export function trendSentence(label: string, total: number, prev: number | null, days: number, money = false) {
  const value = money ? naira(total) : fmtNum(total);
  if (prev == null) return `${label}: ${value} in the last ${days} days.`;
  const pct = percentChange(total, prev);
  if (pct == null) return `${label}: ${value}, up from none in the previous ${days} days.`;
  if (pct === 0) return `${label}: ${value}, unchanged vs previous ${days} days.`;
  return `${label}: ${value}, ${pct > 0 ? "up" : "down"} ${Math.abs(pct)}% vs previous ${days} days.`;
}

export function ChangePill({ total, prev, days }: { total: number; prev: number | null; days: number }) {
  if (prev == null) return null;
  const pct = percentChange(total, prev);
  const text = pct == null ? "new" : `${pct > 0 ? "+" : ""}${pct}%`;
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      <span className="font-medium text-foreground">{text}</span> vs previous {days} days
    </span>
  );
}

export function TrendChart({
  kind, series, data, days, money, stacked, height = 240, title,
}: {
  kind: "area" | "bar" | "line"; series: SeriesSpec[]; data: SeriesData; days: number;
  money?: boolean; stacked?: boolean; height?: number; title: string;
}) {
  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])) as ChartConfig;
  const summary = series.map((s) => trendSentence(s.label, data.totals[s.key], data.previous[s.key], days, money)).join(" ");
  const fmtTick = (v: number) => (money ? nairaShort(v) : fmtNum(v));
  const common = { data: data.rows, margin: { top: 8, right: 8, left: 0, bottom: 0 }, accessibilityLayer: true };
  const axes = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
      <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={(d: string) => fmtDay(d)} className="text-[11px]" />
      <YAxis tickLine={false} axisLine={false} width={money ? 64 : 40} tickFormatter={fmtTick} allowDecimals={false} className="text-[11px] tabular-nums" />
      <ChartTooltip
        content={<ChartTooltipContent labelFormatter={(_, p) => fmtDay(String(p?.[0]?.payload?.day ?? ""), true)}
          formatter={(v, name, item) => (
            <div className="flex w-full items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: item.color }} />
              <span className="text-muted-foreground">{config[name as string]?.label}</span>
              <span className="ml-auto font-mono font-medium tabular-nums">{money ? naira(Number(v)) : fmtNum(Number(v))}</span>
            </div>
          )} />}
      />
      {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
    </>
  );

  return (
    <figure>
      <ChartContainer config={config} className="w-full" style={{ height }} role="img" aria-label={`${title}. ${summary}`}>
        {kind === "bar" ? (
          <BarChart {...common}>
            {axes}
            {series.map((s) => <Bar key={s.key} dataKey={s.key} fill={`var(--color-${s.key})`} radius={[4, 4, 0, 0]} stackId={stacked ? "a" : undefined} />)}
          </BarChart>
        ) : kind === "line" ? (
          <LineChart {...common}>
            {axes}
            {series.map((s) => <Line key={s.key} dataKey={s.key} type="monotone" stroke={`var(--color-${s.key})`} strokeWidth={2} dot={false} />)}
          </LineChart>
        ) : (
          <AreaChart {...common}>
            {axes}
            {series.map((s) => (
              <Area key={s.key} dataKey={s.key} type="monotone" stroke={`var(--color-${s.key})`} strokeWidth={2}
                fill={`var(--color-${s.key})`} fillOpacity={0.15} stackId={stacked ? "a" : undefined} />
            ))}
          </AreaChart>
        )}
      </ChartContainer>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  );
}

export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return <Skeleton className="w-full rounded-xl" style={{ height }} aria-label="Loading chart" />;
}

/** One chart with its own loading / error states, range comparison and CSV export. */
export function ChartCard({
  title, kind, series, days, money, stacked, height, live, csv,
}: {
  title: string; kind: "area" | "bar" | "line"; series: SeriesSpec[]; days: number; money?: boolean;
  stacked?: boolean; height?: number; live?: boolean; csv?: boolean;
}) {
  const metrics = series.map((s) => s.key);
  const q = useMultiSeries(metrics, days, live);
  const first = series[0].key;

  const exportCsv = () => {
    if (!q.data) return;
    downloadCsv(
      `healingnet-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${days}d.csv`,
      ["day", ...series.map((s) => s.label)],
      q.data.rows.map((r) => [String(r.day), ...metrics.map((m) => Number(r[m] ?? 0))]),
    );
  };

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-6">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-bold">{title}</h2>
          {q.data && series.length === 1 && (
            <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-bold tabular-nums">{money ? nairaShort(q.data.totals[first]) : fmtNum(q.data.totals[first])}</span>
              <ChangePill total={q.data.totals[first]} prev={q.data.previous[first]} days={days} />
            </p>
          )}
          {q.data && series.length > 1 && (
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground tabular-nums">
              {series.map((s) => <span key={s.key}>{s.label}: <span className="font-medium text-foreground">{money ? naira(q.data!.totals[s.key]) : fmtNum(q.data!.totals[s.key])}</span></span>)}
            </p>
          )}
        </div>
        {csv && (
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!q.data} aria-label={`Export ${title} as CSV`}>
            <Download className="mr-1.5 h-4 w-4" />CSV
          </Button>
        )}
      </div>
      {q.isLoading && !q.data ? <ChartSkeleton height={height} /> : q.error && !q.data ? <ErrorState error={q.error} onRetry={q.refetch} /> : q.data && (
        <TrendChart kind={kind} series={series} data={q.data} days={days} money={money} stacked={stacked} height={height} title={title} />
      )}
    </section>
  );
}

export const C = { c1: "var(--chart-1)", c2: "var(--chart-2)", c3: "var(--chart-3)", c4: "var(--chart-4)", bad: "hsl(var(--destructive))" };
