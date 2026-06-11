import { ArrowRight, ArrowLeft, Loader2 } from "lucide-react";

interface Props {
  freeText: string;
  onFreeTextChange: (text: string) => void;
  onContinue: () => void;
  onBack: () => void;
  loading?: boolean;
}

export function TriageStep2SymptomsStep({
  freeText,
  onFreeTextChange,
  onContinue,
  onBack,
  loading = false,
}: Props) {
  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <h2 className="font-heading font-bold mb-1">Step 2 of 8 — Tell us what's wrong</h2>
      <p className="text-sm text-muted-foreground mb-4">
        In your own words. Mention what you feel, when it started, anything that makes it worse or better.
      </p>
      <textarea
        value={freeText}
        onChange={(e) => onFreeTextChange(e.target.value)}
        rows={6}
        maxLength={1500}
        placeholder="e.g. For the past 2 days I've had a sharp pain in the lower right side of my belly, with nausea and a low fever…"
        className="w-full bg-background border border-border rounded-lg p-3 text-sm"
      />
      <div className="flex justify-between mt-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-lg border border-border"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <button
          onClick={onContinue}
          disabled={!freeText.trim() || loading}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg disabled:opacity-40"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Analysing symptoms…
            </>
          ) : (
            <>
              Start interview <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
      {loading && <p className="text-xs text-muted-foreground mt-3">NLP parsing your text into clinical concepts…</p>}
    </div>
  );
}
