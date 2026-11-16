import { PatientLayout } from "@/layouts/PatientLayout";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Calendar, Pill, FlaskConical, FileText, ArrowRight, Stethoscope, Loader2, Clock, AlertCircle, Plus, CalendarPlus, Award, ShieldAlert } from "lucide-react";
import { useActivePatientId, useHealthOverview, usePatientProfile, usePatientAppointments, usePatientPrescriptions, usePatientLabResults, usePatientEmr } from "@/hooks/usePatientData";
import { Skeleton } from "@/components/ui/skeleton";
import { cardSpoken, overviewCards, type OverviewCardId } from "@/lib/overview";
import { verifyBanner } from "@/lib/verification";
import { Button } from "@/components/ui/button";
import { ShareRecordsCard } from "@/components/patient/ShareRecordsCard";
import { CheckInCard } from "@/components/patient/CheckInCard";
import { useActivePatient } from "@/hooks/useFamily";
import { QueryState } from "@/components/common/QueryState";

const CARD_ICON: Record<OverviewCardId, typeof Pill> = { prescriptions: Pill, labs: FlaskConical, records: FileText, letters: Award };
const CARD_LINK: Record<OverviewCardId, string> = {
  prescriptions: "/patient/prescriptions", labs: "/patient/lab-results", records: "/patient/medical-records", letters: "/patient/letters",
};

export default function PatientDashboard() {
  const qc = useQueryClient();
  const { data: profile, isLoading: profileLoading } = usePatientProfile();
  const { data: appts = [], isLoading: apptsLoading, isError: apptsError, error: apptsErr, refetch: refetchAppts } = usePatientAppointments();
  const { data: prescriptions = [], isLoading: rxLoading, isError: rxError, error: rxErr, refetch: refetchRx } = usePatientPrescriptions();
  const { data: labs = [], isLoading: labsLoading, isError: labsError, error: labsErr, refetch: refetchLabs } = usePatientLabResults();
  const { data: emr = [], isLoading: emrLoading, isError: emrError, error: emrErr, refetch: refetchEmr } = usePatientEmr();

  // Live updates and cache keys follow the person chosen under "Who is this for?".
  const pid = useActivePatientId();
  const person = useActivePatient();
  const overview = useHealthOverview();
  const banner = verifyBanner(person.family);
  useEffect(() => {
    if (!pid) return;
    const channels = [
      supabase
        .channel(`realtime-appts-${pid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "patient_appointments" }, () => {
          qc.invalidateQueries({ queryKey: ["patient-appointments", pid] });
        })
        .subscribe(),
      supabase
        .channel(`realtime-rx-${pid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "prescriptions" }, () => {
          qc.invalidateQueries({ queryKey: ["patient-prescriptions", pid] });
        })
        .subscribe(),
      supabase
        .channel(`realtime-labs-${pid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "lab_results" }, () => {
          qc.invalidateQueries({ queryKey: ["patient-lab-results", pid] });
        })
        .subscribe(),
      supabase
        .channel(`realtime-emr-${pid}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "emr_entries" }, () => {
          qc.invalidateQueries({ queryKey: ["patient-emr", pid] });
        })
        .subscribe(),
    ];
    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [pid, qc]);

  const loading = profileLoading || apptsLoading || rxLoading || labsLoading || emrLoading;
  const upcomingAppts = appts.filter(a => ["pending", "accepted", "confirmed"].includes(a.status));
  const nextAppt = upcomingAppts.length > 0 ? upcomingAppts[0] : null;
  const activeRx = prescriptions.filter(p => p.status === "active");


  return (
    <PatientLayout>
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-heading font-bold mb-1">Welcome back{profile?.first_name ? `, ${profile.first_name}` : ""}</h1>
        <p className="text-muted-foreground">{person.isMe ? "Here's a quick overview of your health journey" : `Showing ${person.firstName}'s visits, prescriptions, results and records`}</p>
      </div>

      {/* Family verification: shown while anyone still needs a document. */}
      {banner && (
        <div role="alert" className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${banner.locked ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/5"}`}>
          <p className="flex items-start gap-2 text-sm font-medium"><ShieldAlert className={`mt-0.5 h-4 w-4 shrink-0 ${banner.locked ? "text-destructive" : "text-warning"}`} aria-hidden />{banner.text}</p>
          <Button size="sm" variant="outline" asChild><Link to={`/patient/settings?verify=${banner.patientId}#family`}>Verify</Link></Button>
        </div>
      )}

      <div className="bg-gradient-to-r from-primary/15 to-info/15 border border-primary/20 rounded-xl p-5 mb-6 flex items-center justify-between flex-wrap gap-3 animate-fade-in transition-all hover:shadow-lg" style={{ animationDelay: "50ms" }}>
        <div className="flex items-center gap-3">
          <Stethoscope className="w-8 h-8 text-primary" />
          <div>
            <h3 className="font-heading font-bold">Not sure what's wrong?</h3>
            <p className="text-sm text-muted-foreground">Answer a few questions with our triage assistant and get matched to the right specialist.</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Link to="/patient/book" className="border border-primary/40 bg-card px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-1 hover:bg-primary/10 transition-colors"><CalendarPlus className="w-4 h-4" />Book appointment</Link>
          <Link to="/patient/triage" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center justify-center gap-1 hover:opacity-90 transition-opacity">Start triage <ArrowRight className="w-4 h-4" /></Link>
        </div>
      </div>

      <CheckInCard />

      <ShareRecordsCard />

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          {/* Your health: the same four cards as the app's Home, from patient_health_overview. */}
          <section aria-labelledby="your-health" className="mb-6">
            <h2 id="your-health" className="mb-3 font-heading text-lg font-bold">{person.isMe ? "Your health" : `${person.firstName}'s health`}</h2>
            {overview.data ? (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                {overviewCards(overview.data).map((card) => {
                  const Icon = CARD_ICON[card.id];
                  return (
                    <Link key={card.id} to={CARD_LINK[card.id]} aria-label={`${cardSpoken(card)}. Open ${card.title.toLowerCase()}`}
                      className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-5 w-5" aria-hidden /></span>
                        {card.count !== null && (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${card.highlight ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                            {card.highlight ? `${card.count} new` : card.count}
                          </span>
                        )}
                      </div>
                      <p className="font-heading font-bold">{card.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{card.status}</p>
                    </Link>
                  );
                })}
              </div>
            ) : overview.isError ? (
              <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">We couldn't load your health summary. <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => overview.refetch()}>Try again</button></p>
            ) : (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-busy="true" aria-label="Loading your health summary">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
            )}
          </section>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5 animate-fade-in transition-all hover:shadow-lg" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wider text-primary font-semibold">Next Appointment</p>
                <Link to="/patient/appointments" className="text-sm text-primary hover:underline">View all</Link>
              </div>
              <QueryState isLoading={false} isError={apptsError} error={apptsErr} onRetry={() => refetchAppts()}>
              {nextAppt ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-lg font-heading font-bold">{nextAppt.doctors ? `Dr. ${nextAppt.doctors.first_name} ${nextAppt.doctors.last_name}` : "Awaiting assignment"}</h3>
                    {nextAppt.doctors?.specialty && <p className="text-sm text-muted-foreground">{nextAppt.doctors.specialty}</p>}
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground flex items-center gap-2"><Calendar className="w-4 h-4" />{new Date(nextAppt.requested_date).toDateString()}</p>
                    {nextAppt.requested_time && <p className="text-sm text-muted-foreground flex items-center gap-2"><Clock className="w-4 h-4" />{nextAppt.requested_time}</p>}
                    {nextAppt.hospitals?.name && <p className="text-sm text-muted-foreground">{nextAppt.hospitals.name}</p>}
                  </div>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium capitalize ${nextAppt.status === "confirmed" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>{nextAppt.status}</span>
                </div>
              ) : (
                <div className="text-center py-6">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No upcoming appointments</p>
                  <Link to="/patient/appointments" className="text-sm text-primary hover:underline mt-2 inline-block">Book one now</Link>
                </div>
              )}
              </QueryState>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 animate-fade-in transition-all hover:shadow-lg" style={{ animationDelay: "180ms" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wider text-success font-semibold flex items-center gap-2"><Pill className="w-4 h-4" />Active Prescriptions</p>
                <Link to="/patient/prescriptions" className="text-sm text-primary hover:underline">View all</Link>
              </div>
              <QueryState isLoading={false} isError={rxError} error={rxErr} onRetry={() => refetchRx()}>
              {activeRx.length === 0 ? (
                <div className="text-center py-6">
                  <Pill className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No active prescriptions</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeRx.slice(0, 3).map((rx, i) => (
                    <div key={rx.id} className="p-3 bg-muted/30 rounded-lg transition-all hover:bg-muted/50 animate-fade-in" style={{ animationDelay: `${250 + i * 50}ms` }}>
                      <div className="font-medium text-sm">{rx.medication_name}</div>
                      <div className="text-xs text-muted-foreground">{rx.dosage} • {rx.frequency}</div>
                    </div>
                  ))}
                  {activeRx.length > 3 && (
                    <Link to="/patient/prescriptions" className="text-xs text-primary hover:underline block mt-2">
                      +{activeRx.length - 3} more
                    </Link>
                  )}
                </div>
              )}
              </QueryState>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 animate-fade-in transition-all hover:shadow-lg" style={{ animationDelay: "260ms" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wider text-warning font-semibold flex items-center gap-2"><FlaskConical className="w-4 h-4" />Lab Results</p>
                <Link to="/patient/lab-results" className="text-sm text-primary hover:underline">View all</Link>
              </div>
              <QueryState isLoading={false} isError={labsError} error={labsErr} onRetry={() => refetchLabs()}>
              {labs.length === 0 ? (
                <div className="text-center py-6">
                  <FlaskConical className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No lab results yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {labs.slice(0, 3).map((lab, i) => (
                    <div key={lab.id} className="p-3 bg-muted/30 rounded-lg transition-all hover:bg-muted/50 animate-fade-in" style={{ animationDelay: `${310 + i * 50}ms` }}>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium text-sm">{(lab as any).lab_result_tests?.[0]?.test_name || "Lab Test"}</div>
                          <div className="text-xs text-muted-foreground">{new Date(lab.created_at).toDateString()}</div>
                        </div>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-info/15 text-info">Ready</span>
                      </div>
                    </div>
                  ))}
                  {labs.length > 3 && (
                    <Link to="/patient/lab-results" className="text-xs text-primary hover:underline block mt-2">
                      +{labs.length - 3} more
                    </Link>
                  )}
                </div>
              )}
              </QueryState>
            </div>

            <div className="bg-card border border-border rounded-xl p-5 animate-fade-in transition-all hover:shadow-lg" style={{ animationDelay: "340ms" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wider text-primary font-semibold flex items-center gap-2"><FileText className="w-4 h-4" />Medical Records</p>
                <Link to="/patient/medical-records" className="text-sm text-primary hover:underline">View all</Link>
              </div>
              <QueryState isLoading={false} isError={emrError} error={emrErr} onRetry={() => refetchEmr()}>
              {emr.length === 0 ? (
                <div className="text-center py-6">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No medical records yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {emr.slice(0, 3).map((entry, i) => (
                    <div key={entry.id} className="p-3 bg-muted/30 rounded-lg transition-all hover:bg-muted/50 animate-fade-in" style={{ animationDelay: `${390 + i * 50}ms` }}>
                      <div className="font-medium text-sm line-clamp-2">{entry.title || entry.content || "Medical Entry"}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center justify-between">
                        <span>{entry.doctors?.first_name && `Dr. ${entry.doctors.first_name} ${entry.doctors.last_name}`}</span>
                        <span>{new Date(entry.created_at).toDateString()}</span>
                      </div>
                    </div>
                  ))}
                  {emr.length > 3 && (
                    <Link to="/patient/medical-records" className="text-xs text-primary hover:underline block mt-2">
                      +{emr.length - 3} more
                    </Link>
                  )}
                </div>
              )}
              </QueryState>
            </div>
          </div>

          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            <Button className="bg-primary text-primary-foreground hover:opacity-90 transition-opacity" asChild>
              <Link to="/patient/appointments" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Book New Appointment
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/patient/messages" className="flex items-center gap-2">
                Message Your Doctor
              </Link>
            </Button>
          </div>
        </>
      )}
    </PatientLayout>
  );
}
