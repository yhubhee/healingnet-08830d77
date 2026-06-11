import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Condition {
  name: string;
  probability: number;
  description?: string;
}

interface NurseResponse {
  triage_level: string;
  triage_label: string;
  guidance: string;
  recommended_specialty: string;
  differential: Condition[];
  red_flags?: string[];
}

const TRIAGE_STYLE: Record<string, { label: string; cls: string }> = {
  self_care: { label: "Self-care", cls: "bg-success/10 border-success/30 text-success" },
  consultation: { label: "See a GP soon", cls: "bg-info/10 border-info/30 text-info" },
  consultation_24: { label: "See a GP within 24h", cls: "bg-warning/10 border-warning/30 text-warning" },
  emergency_ambulance: {
    label: "Call an ambulance",
    cls: "bg-destructive/10 border-destructive/30 text-destructive",
  },
  emergency: { label: "Emergency — go to A&E", cls: "bg-destructive/10 border-destructive/30 text-destructive" },
};

interface Props {
  triageResponse: NurseResponse;
  onStartOver: () => void;
  onContinueToDoctorSelection: () => void;
}

export function TriageStep4ResultsStep({
  triageResponse,
  onStartOver,
  onContinueToDoctorSelection,
}: Props) {
  return (
    <div className="space-y-4">
      <div className={cn("rounded-xl p-5 border", TRIAGE_STYLE[triageResponse.triage_level]?.cls || "bg-muted")}>
        <div className="flex items-center gap-2 mb-1">
          {triageResponse.triage_level.startsWith("emergency") && <AlertTriangle className="w-5 h-5" />}
          <span className="uppercase tracking-wider text-xs font-bold">
            {TRIAGE_STYLE[triageResponse.triage_level]?.label || triageResponse.triage_level}
          </span>
        </div>
        <h2 className="font-heading text-xl font-bold">{triageResponse.triage_label}</h2>
        <p className="text-sm mt-1 opacity-90">{triageResponse.guidance}</p>
        {triageResponse.red_flags && triageResponse.red_flags.length > 0 && (
          <ul className="mt-3 text-sm space-y-1">
            {triageResponse.red_flags.map((r, i) => (
              <li key={i} className="flex items-start gap-1">
                <AlertTriangle className="w-3 h-3 mt-1 shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Conditions */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-heading font-bold mb-3 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" /> Possible conditions
          </h3>
          <p className="text-xs text-muted-foreground mb-3">Ranked by likelihood from your responses. Not a diagnosis.</p>
          <div className="space-y-3">
            {triageResponse.differential.slice(0, 5).map((c, i) => {
              const pct = Math.round(c.probability * 100);
              return (
                <div key={i}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground">{pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                  {c.description && <p className="text-xs text-muted-foreground mt-1">{c.description}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Next Steps */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-heading font-bold mb-1 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-primary" /> Next steps
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Recommended specialty: <span className="text-foreground font-medium">{triageResponse.recommended_specialty}</span>
          </p>
          <p className="text-sm text-muted-foreground">Select a doctor in the next step to book your appointment.</p>
        </div>
      </div>

      <div className="flex justify-between gap-3">
        <button
          onClick={onStartOver}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-border"
        >
          <ArrowLeft className="w-4 h-4" />
          Start over
        </button>
        <button
          onClick={onContinueToDoctorSelection}
          className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg"
        >
          Continue to doctor selection <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
