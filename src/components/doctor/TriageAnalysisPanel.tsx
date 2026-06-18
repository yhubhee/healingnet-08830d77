import { AlertTriangle, Activity, TrendingUp, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TriageSession {
  id: string;
  patient_id: string;
  symptoms: string[];
  severity_score: number;
  urgency: string;
  recommended_specialty: string;
  recommended_hospitals: any;
  created_at: string;
}

interface Props {
  triageSession: TriageSession | null;
  loading?: boolean;
}

export function TriageAnalysisPanel({ triageSession, loading = false }: Props) {
  if (loading) {
    return <div className="text-muted-foreground text-sm">Loading triage analysis…</div>;
  }

  if (!triageSession) {
    return (
      <div className="bg-muted/30 border-2 border-dashed border-border rounded-xl p-8 text-center">
        <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">No AI triage analysis available.</p>
        <p className="text-xs text-muted-foreground mt-1">Patient may have skipped the triage or booked directly.</p>
      </div>
    );
  }

  const session = triageSession as any;
  const triageResp = session.recommended_hospitals;

  // Map urgency/triage_level to display label
  const URGENCY_LABELS: Record<string, { label: string; color: string }> = {
    self_care: { label: "Self-care", color: "bg-success/10 text-success border-success/30" },
    consultation: { label: "See a GP soon", color: "bg-info/10 text-info border-info/30" },
    consultation_24: { label: "See a GP within 24h", color: "bg-warning/10 text-warning border-warning/30" },
    emergency_ambulance: { label: "Call ambulance", color: "bg-destructive/10 text-destructive border-destructive/30" },
    emergency: { label: "Emergency", color: "bg-destructive/10 text-destructive border-destructive/30" },
  };

  const urgencyStyle = URGENCY_LABELS[session.urgency] || URGENCY_LABELS.consultation;

  return (
    <div className="space-y-4">
      {/* Triage Level & Severity */}
      <div className={`rounded-xl border p-5 ${urgencyStyle.color}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex-1">
            <div className="uppercase text-xs font-bold tracking-wider mb-1">Urgency</div>
            <h3 className="text-lg font-heading font-bold">{urgencyStyle.label}</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider mb-1 opacity-75">Severity</div>
              <div className="text-3xl font-heading font-bold">{session.severity_score}</div>
            </div>
            <div className="text-3xl">
              {session.severity_score >= 8 ? "🔴" : session.severity_score >= 5 ? "🟡" : "🟢"}
            </div>
          </div>
        </div>
      </div>

      {/* Red Flags */}
      {triageResp?.red_flags && triageResp.red_flags.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4">
          <div className="flex items-start gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <h4 className="font-heading font-bold text-sm text-destructive">Red Flags Detected</h4>
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {triageResp.red_flags.map((flag: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-destructive mt-0.5">•</span>
                <span>{flag}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Chief Complaint */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h4 className="font-heading font-bold text-sm mb-2 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" /> Chief Complaint
        </h4>
        <p className="text-sm text-muted-foreground">
          {typeof session.symptoms === "string" ? session.symptoms : session.symptoms?.[session.symptoms.length - 1] || "—"}
        </p>
      </div>

      {/* Q&A Session */}
      {session.recommended_hospitals?.interview_history && session.recommended_hospitals.interview_history.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="font-heading font-bold text-sm mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Q&A Session
          </h4>
          <div className="space-y-3 text-sm">
            {session.recommended_hospitals.interview_history.map((q: any, i: number) => (
              <div key={i} className="pb-3 border-b border-border last:border-0">
                <div className="font-medium text-muted-foreground mb-1">Q: {q.question || "—"}</div>
                <div className="text-foreground">A: {q.answer || "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Differential Diagnosis */}
      {triageResp?.differential && triageResp.differential.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h4 className="font-heading font-bold text-sm mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Differential Diagnosis
          </h4>
          <p className="text-xs text-muted-foreground mb-3">Ranked by likelihood</p>
          <div className="space-y-3">
            {triageResp.differential.slice(0, 5).map((cond: any, i: number) => {
              const pct = Math.round(cond.probability * 100);
              return (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm font-medium">{cond.name}</span>
                    <span className="text-xs text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  {cond.description && <p className="text-xs text-muted-foreground mt-1">{cond.description}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recommendation */}
      <div className="bg-info/10 border border-info/30 rounded-xl p-4">
        <h4 className="font-heading font-bold text-sm mb-2 text-info">Recommended Specialty</h4>
        <Badge className="bg-info text-info-foreground">{session.recommended_specialty}</Badge>
        {triageResp?.guidance && (
          <p className="text-sm text-muted-foreground mt-3">{triageResp.guidance}</p>
        )}
      </div>

      {/* Session Metadata */}
      <div className="text-xs text-muted-foreground">
        <div>Triage date: {new Date(session.created_at).toLocaleString()}</div>
      </div>
    </div>
  );
}
