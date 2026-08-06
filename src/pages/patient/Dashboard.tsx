import { PatientLayout } from "@/layouts/PatientLayout";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Calendar, Pill, FlaskConical, FileText, ArrowRight, Stethoscope, Loader2, Clock, AlertCircle, Plus } from "lucide-react";
import { usePatientProfile, usePatientAppointments, usePatientPrescriptions, usePatientLabResults, usePatientEmr } from "@/hooks/usePatientData";
import { Button } from "@/components/ui/button";

export default function PatientDashboard() {
  const qc = useQueryClient();
  const { data: profile, isLoading: profileLoading } = usePatientProfile();
  const { data: appts = [], isLoading: apptsLoading } = usePatientAppointments();
  const { data: prescriptions = [], isLoading: rxLoading } = usePatientPrescriptions();
  const { data: labs = [], isLoading: labsLoading } = usePatientLabResults();
  const { data: emr = [], isLoading: emrLoading } = usePatientEmr();

  useEffect(() => {
    if (!profile?.id) return;
    const channels = [
      supabase
        .channel(`realtime-appts-${profile.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "patient_appointments" }, () => {
          qc.invalidateQueries({ queryKey: ["patient-appointments", profile.id] });
        })
        .subscribe(),
      supabase
        .channel(`realtime-rx-${profile.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "prescriptions" }, () => {
          qc.invalidateQueries({ queryKey: ["patient-prescriptions", profile.id] });
        })
        .subscribe(),
      supabase
        .channel(`realtime-labs-${profile.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "lab_results" }, () => {
          qc.invalidateQueries({ queryKey: ["patient-lab-results", profile.id] });
        })
        .subscribe(),
      supabase
        .channel(`realtime-emr-${profile.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "emr_entries" }, () => {
          qc.invalidateQueries({ queryKey: ["patient-emr", profile.id] });
        })
        .subscribe(),
    ];
    return () => { channels.forEach(ch => supabase.removeChannel(ch)); };
  }, [profile?.id, qc]);

  const loading = profileLoading || apptsLoading || rxLoading || labsLoading || emrLoading;
  const upcomingAppts = appts.filter(a => ["pending", "accepted", "confirmed"].includes(a.status));
  const nextAppt = upcomingAppts.length > 0 ? upcomingAppts[0] : null;
  const activeRx = prescriptions.filter(p => p.status === "active");

  const cards = [
    { label: "Upcoming Appointments", value: upcomingAppts.length, icon: Calendar, color: "text-info", bg: "bg-info/10" },
    { label: "Active Prescriptions", value: activeRx.length, icon: Pill, color: "text-success", bg: "bg-success/10" },
    { label: "Lab Results", value: labs.length, icon: FlaskConical, color: "text-warning", bg: "bg-warning/10" },
    { label: "Medical Entries", value: emr.length, icon: FileText, color: "text-primary", bg: "bg-primary/10" },
  ];

  return (
    <PatientLayout>
      <div className="mb-6 animate-fade-in">
        <h1 className="text-2xl font-heading font-bold mb-1">Welcome back{profile?.first_name ? `, ${profile.first_name}` : ""}</h1>
        <p className="text-muted-foreground">Here's a quick overview of your health journey</p>
      </div>

      <div className="bg-gradient-to-r from-primary/15 to-info/15 border border-primary/20 rounded-xl p-5 mb-6 flex items-center justify-between flex-wrap gap-3 animate-fade-in transition-all hover:shadow-lg" style={{ animationDelay: "50ms" }}>
        <div className="flex items-center gap-3">
          <Stethoscope className="w-8 h-8 text-primary" />
          <div>
            <h3 className="font-heading font-bold">Not sure what's wrong?</h3>
            <p className="text-sm text-muted-foreground">Run our 4-step AI symptom triage and get matched to the right specialist.</p>
          </div>
        </div>
        <Link to="/patient/triage" className="bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-1 hover:opacity-90 transition-opacity">Start triage <ArrowRight className="w-4 h-4" /></Link>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {cards.map((s, i) => (
              <div key={s.label} className={`bg-card border border-border rounded-xl p-5 animate-fade-in transition-all hover:scale-105 hover:shadow-lg`} style={{ animationDelay: `${100 + i * 80}ms` }}>
                <div className={`w-10 h-10 rounded-lg ${s.bg} ${s.color} flex items-center justify-center mb-3 transition-transform`}><s.icon className="w-5 h-5" /></div>
                <div className="text-2xl font-heading font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-xl p-5 animate-fade-in transition-all hover:shadow-lg" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wider text-primary font-semibold">Next Appointment</p>
                <Link to="/patient/appointments" className="text-sm text-primary hover:underline">View all</Link>
              </div>
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
            </div>

            <div className="bg-card border border-border rounded-xl p-5 animate-fade-in transition-all hover:shadow-lg" style={{ animationDelay: "180ms" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wider text-success font-semibold flex items-center gap-2"><Pill className="w-4 h-4" />Active Prescriptions</p>
                <Link to="/patient/prescriptions" className="text-sm text-primary hover:underline">View all</Link>
              </div>
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
            </div>

            <div className="bg-card border border-border rounded-xl p-5 animate-fade-in transition-all hover:shadow-lg" style={{ animationDelay: "260ms" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wider text-warning font-semibold flex items-center gap-2"><FlaskConical className="w-4 h-4" />Lab Results</p>
                <Link to="/patient/lab-results" className="text-sm text-primary hover:underline">View all</Link>
              </div>
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
            </div>

            <div className="bg-card border border-border rounded-xl p-5 animate-fade-in transition-all hover:shadow-lg" style={{ animationDelay: "340ms" }}>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-wider text-primary font-semibold flex items-center gap-2"><FileText className="w-4 h-4" />Medical Records</p>
                <Link to="/patient/medical-records" className="text-sm text-primary hover:underline">View all</Link>
              </div>
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
