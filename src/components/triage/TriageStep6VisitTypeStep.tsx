import { ArrowLeft, Video, Hospital } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  doctorName: string;
  onSelectVisitType: (type: "in-person" | "telemedicine") => void;
  onBack: () => void;
}

export function TriageStep6VisitTypeStep({ doctorName, onSelectVisitType, onBack }: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="font-heading font-bold mb-1">Step 6 of 8 — Choose visit type</h2>
      <p className="text-sm text-muted-foreground mb-6">
        How would you like to consult with Dr. {doctorName}?
      </p>

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        {/* In-person card */}
        <button
          onClick={() => onSelectVisitType("in-person")}
          className={cn(
            "p-6 rounded-xl border-2 transition-all text-left",
            "border-border hover:border-primary hover:bg-primary/5 active:bg-primary/10",
          )}
        >
          <div className="flex items-start gap-3">
            <Hospital className="w-6 h-6 text-primary shrink-0 mt-1" />
            <div>
              <h3 className="font-heading font-bold">In-person visit</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Meet at a hospital or clinic. Select available locations.
              </p>
            </div>
          </div>
        </button>

        {/* Telemedicine card */}
        <button
          onClick={() => onSelectVisitType("telemedicine")}
          className={cn(
            "p-6 rounded-xl border-2 transition-all text-left",
            "border-border hover:border-primary hover:bg-primary/5 active:bg-primary/10",
          )}
        >
          <div className="flex items-start gap-3">
            <Video className="w-6 h-6 text-primary shrink-0 mt-1" />
            <div>
              <h3 className="font-heading font-bold">Online consultation</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Video call from home. Convenient and immediate.
              </p>
            </div>
          </div>
        </button>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-border">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      </div>
    </div>
  );
}
