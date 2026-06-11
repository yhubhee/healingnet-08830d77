import { ArrowRight, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type Sex = "male" | "female";

interface Props {
  age: number | "";
  sex: Sex | "";
  onAgeChange: (age: number | "") => void;
  onSexChange: (sex: Sex) => void;
  onContinue: () => void;
  onBack?: () => void;
  loading?: boolean;
}

export function TriageStep1DemographicsStep({
  age,
  sex,
  onAgeChange,
  onSexChange,
  onContinue,
  onBack,
  loading = false,
}: Props) {
  const isComplete = age !== "" && sex;

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="font-heading font-bold mb-1">Step 1 of 8 — A bit about you</h2>
      <p className="text-sm text-muted-foreground mb-4">We use this to personalise the triage.</p>
      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <label className="text-sm">
          Age
          <input
            type="number"
            min={0}
            max={120}
            value={age}
            onChange={(e) => onAgeChange(e.target.value === "" ? "" : Number(e.target.value))}
            className="mt-1 w-full bg-background border border-border rounded-lg p-2"
          />
        </label>
        <div className="text-sm">
          <span>Biological sex</span>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {(["male", "female"] as Sex[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSexChange(s)}
                className={cn(
                  "p-2 rounded-lg border capitalize",
                  sex === s ? "bg-primary text-primary-foreground border-primary" : "border-border",
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex justify-end">
        <button
          disabled={!isComplete || loading}
          onClick={onContinue}
          className="inline-flex items-center gap-1 bg-primary text-primary-foreground px-4 py-2 rounded-lg disabled:opacity-40"
        >
          {loading ? "Saving…" : <>Continue <ArrowRight className="w-4 h-4" /></>}
        </button>
      </div>
    </div>
  );
}
