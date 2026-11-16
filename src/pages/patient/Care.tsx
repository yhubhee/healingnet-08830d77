// Care plan (the same content as the app's Care screen): the pregnancy and procedure plans
// the hospital shares, from my_care(). The patient ticks tests, medicines, to-dos and
// instructions; visits are marked by the hospital. Reminders come from the server.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Baby, CalendarCheck, Check, ClipboardList, FileText, FlaskConical, Pill, Scissors } from "lucide-react";
import { toast } from "sonner";
import { PatientLayout } from "@/layouts/PatientLayout";
import { QueryState } from "@/components/common/QueryState";
import { ForPersonNote } from "@/components/patient/PersonSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { useActivePatient } from "@/hooks/useFamily";
import { useActivePatientId } from "@/hooks/usePatientData";
import {
  bpFlag, careDateTime, careDay, careKindLabel, fastingLine, gestationText, groupCareItems, HOSPITAL_MARKS_VISITS, isActivePregnancy, isPast, NO_CARE_PLAN,
  parseCare, patientCanTick, pregnancyProgress, pregnancyStatusText, procedureTypeText, surgeryStatusText, type CareData, type CareItem, type CareKind,
  type Pregnancy, type Surgery,
} from "@/lib/care";
import { dbMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

export const careKey = (pid: string | undefined) => ["patient-care", pid] as const;

export function useMyCare() {
  const pid = useActivePatientId();
  return useQuery({
    queryKey: careKey(pid),
    enabled: !!pid,
    refetchOnWindowFocus: true,
    meta: { inlineError: true },
    queryFn: async (): Promise<CareData> => {
      const { data, error } = await supabase.rpc("my_care", { p_patient_id: pid! });
      if (error) throw error;
      return parseCare(data);
    },
  });
}

const KIND_ICON: Record<CareKind, typeof Pill> = { visit: CalendarCheck, test: FlaskConical, medicine: Pill, task: ClipboardList, instruction: FileText };
const fmt12 = (time: string | null) => {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m || 0).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
};

function TodoList({ items }: { items: CareItem[] }) {
  const qc = useQueryClient();
  const tick = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.rpc("set_care_item_done", { p_item_id: id, p_done: done });
      if (error) throw error;
    },
    onError: (e) => toast.error(dbMessage(e)),
    onSettled: () => qc.invalidateQueries({ queryKey: ["patient-care"] }),
  });
  const g = groupCareItems(items);
  if (items.length === 0) return <p className="text-sm text-muted-foreground">Nothing to do yet.</p>;

  const row = (i: CareItem) => {
    const Icon = KIND_ICON[i.kind];
    const done = i.status === "done";
    const canTick = patientCanTick(i);
    return (
      <li key={i.id} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
        {canTick ? (
          <button type="button" role="checkbox" aria-checked={done} aria-label={`${i.title}. ${done ? "Done. Mark as not done" : "Mark as done"}`} disabled={tick.isPending}
            onClick={() => tick.mutate({ id: i.id, done: !done })}
            className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              done ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary")}>
            {done && <Check className="h-4 w-4" aria-hidden />}
          </button>
        ) : (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">{done ? <Check className="h-4 w-4" aria-hidden /> : <Icon className="h-4 w-4" aria-hidden />}</span>
        )}
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium", done && "line-through decoration-muted-foreground")}>{i.title} <span className="text-xs font-normal text-muted-foreground">· {careKindLabel(i.kind)}</span></p>
          {i.details && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{i.details}</p>}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {[i.due_at ? `${careDateTime(i.due_at)}${!done && isPast(i.due_at, new Date()) ? " (date has passed)" : ""}` : null,
              done ? (i.done_by_patient ? "You marked this done" : "Marked done by the hospital") : i.kind === "visit" ? HOSPITAL_MARKS_VISITS : null].filter(Boolean).join(" · ")}
          </p>
        </div>
      </li>
    );
  };
  const group = (label: string, list: CareItem[]) => list.length > 0 && (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</h4>
      <ul className="space-y-2">{list.map(row)}</ul>
    </div>
  );
  return <div className="space-y-4">{group("Upcoming", g.upcoming)}{group("No date", g.noDate)}{group("Done", g.done)}</div>;
}

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return <div><h3 className="mb-2 font-heading font-bold">{title}</h3>{children}</div>;
}

function PregnancyCard({ p }: { p: Pregnancy }) {
  const active = isActivePregnancy(p);
  const g = p.weeks_today !== null ? { weeks: p.weeks_today, days: p.days_extra ?? 0 } : null;
  const pct = Math.round(pregnancyProgress(g) * 100);
  const nextVisit = groupCareItems(p.items).upcoming.find((i) => i.kind === "visit" && !isPast(i.due_at, new Date()));
  return (
    <article className="space-y-5 rounded-xl border border-border bg-card p-5">
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Baby className="h-6 w-6" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Pregnancy · {pregnancyStatusText(p.status)}</p>
          <h2 className="font-heading text-2xl font-bold">{active && g ? gestationText(g) : pregnancyStatusText(p.status)}</h2>
          <p className="text-sm text-muted-foreground">{[p.hospital_name, p.doctor_name].filter(Boolean).join(" · ")}</p>
        </div>
      </header>
      {active && g && (
        <div>
          <div className="mb-1 flex justify-between text-sm"><span>{p.edd ? `Due date: ${careDay(p.edd)} ${p.edd.slice(0, 4)}` : "Due date not set"}</span><span className="text-muted-foreground">{g.weeks} of 40 weeks</span></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={40} aria-valuenow={Math.min(40, g.weeks)} aria-label={`${g.weeks} of 40 weeks`}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}
      {nextVisit && <p className="rounded-lg bg-primary/10 p-3 text-sm font-medium">Next visit: {nextVisit.title} · {careDateTime(nextVisit.due_at)}</p>}
      {p.delivery_date && (
        <p className="text-sm">Delivered {careDay(p.delivery_date)} {p.delivery_date.slice(0, 4)}{p.delivery_type ? ` · ${p.delivery_type} delivery` : ""}{p.baby_gender ? ` · baby ${p.baby_gender === "female" ? "girl" : "boy"}` : ""}{p.baby_weight ? ` · ${p.baby_weight} kg` : ""}</p>
      )}
      {p.patient_notes && <Part title="Message from your doctor"><p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm">{p.patient_notes}</p></Part>}
      {p.visits.length > 0 && (
        <Part title="Your last visits">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                {["Date", "Weeks", "Blood pressure", "Weight", "Baby's heartbeat"].map((h) => <th key={h} className="p-2 font-semibold">{h}</th>)}
              </tr></thead>
              <tbody>
                {p.visits.map((v) => {
                  const [sys, dia] = (v.bp ?? "").split("/").map(Number);
                  const flag = v.bp ? bpFlag(sys, dia) : null;
                  return (
                    <tr key={v.visit_date} className="border-b border-border/50">
                      <td className="whitespace-nowrap p-2 font-medium">{careDay(v.visit_date)}</td>
                      <td className="p-2">{v.gestational_weeks ?? "—"}</td>
                      <td className="whitespace-nowrap p-2">{v.bp ?? "—"}{flag && <span className="ml-1.5 rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-bold text-destructive">{flag}</span>}</td>
                      <td className="p-2">{v.weight_kg === null ? "—" : `${v.weight_kg} kg`}</td>
                      <td className="p-2">{v.fetal_heart_rate === null ? "—" : `${v.fetal_heart_rate} beats a minute`}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Part>
      )}
      <Part title="To do"><TodoList items={p.items} /></Part>
    </article>
  );
}

function SurgeryCard({ s }: { s: Surgery }) {
  const over = ["recovery", "completed"].includes(s.status);
  return (
    <article className="space-y-5 rounded-xl border border-border bg-card p-5">
      <header className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Scissors className="h-6 w-6" aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Procedure · {surgeryStatusText(s.status)}</p>
          <h2 className="font-heading text-2xl font-bold">{s.procedure_name}</h2>
          <p className="text-sm text-muted-foreground">{[s.hospital_name, s.surgeon_name, procedureTypeText(s.procedure_type)].filter(Boolean).join(" · ")}</p>
        </div>
      </header>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Date and time</dt><dd className="font-medium">{careDay(s.scheduled_date)}{s.scheduled_time ? `, ${fmt12(s.scheduled_time)}` : ""}</dd></div>
        {s.admit_at && <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Come to the hospital (admission)</dt><dd className="font-medium">{careDateTime(s.admit_at)}</dd></div>}
        {s.fasting_from && !over && <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">No food or drink</dt><dd className="font-medium">{fastingLine(s.fasting_from)}</dd></div>}
        {s.anaesthesia_type && <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Anaesthesia</dt><dd className="font-medium capitalize">{s.anaesthesia_type}</dd></div>}
        {!over && s.status !== "cancelled" && <div><dt className="text-xs uppercase tracking-wider text-muted-foreground">Consent form</dt><dd className="font-medium">{s.consent_signed ? "Consent signed ✓" : "You'll sign the consent form at the hospital"}</dd></div>}
      </dl>
      {s.patient_instructions && <Part title="Instructions"><p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm">{s.patient_instructions}</p></Part>}
      {s.post_op_instructions && over && <Part title="After your operation"><p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-3 text-sm">{s.post_op_instructions}</p></Part>}
      <Part title="To do"><TodoList items={s.items} /></Part>
    </article>
  );
}

export default function PatientCare() {
  const person = useActivePatient();
  const q = useMyCare();
  const data = q.data;
  const empty = !!data && data.pregnancies.length === 0 && data.surgeries.length === 0;
  return (
    <PatientLayout>
      <div className="mb-6">
        <h1 className="mb-1 font-heading text-2xl font-bold">{person.isMe ? "Care plan" : `${person.firstName}'s care plan`}</h1>
        <p className="text-muted-foreground">Pregnancy and procedure plans from your hospital, with what to do and when.</p>
        <ForPersonNote className="mt-2" />
      </div>
      <QueryState isLoading={q.isLoading} isError={q.isError} error={q.error} onRetry={() => q.refetch()}>
        {empty ? <p className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-muted-foreground">{NO_CARE_PLAN}</p> : (
          <div className="mx-auto max-w-3xl space-y-6">
            {data?.pregnancies.map((p) => <PregnancyCard key={p.id} p={p} />)}
            {data?.surgeries.map((s) => <SurgeryCard key={s.id} s={s} />)}
            <p className="text-center text-xs text-muted-foreground">We remind you the day before and on the day. Your hospital decides what is shared here.</p>
          </div>
        )}
      </QueryState>
    </PatientLayout>
  );
}
