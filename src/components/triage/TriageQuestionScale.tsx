import React, { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { HelpCircle, Loader2 } from "lucide-react";

interface Props {
  question: {
    id: string;
    text: string;
    explanation?: string;
    unit?: string;
    options?: [string, string]; // min_label, max_label
  };
  askedCount: number;
  maxQuestions: number;
  onAnswer: (value: number) => void;
  loading?: boolean;
}

export function TriageQuestionScale({
  question,
  askedCount,
  maxQuestions,
  onAnswer,
  loading = false,
}: Props) {
  const [value, setValue] = useState(5);
  const progress = Math.min(100, Math.round((askedCount / maxQuestions) * 100));
  const minLabel = question.options?.[0] || "Low";
  const maxLabel = question.options?.[1] || "High";

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>
            Question {askedCount} of up to {maxQuestions}
          </span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary mb-3">
          <span>📊</span> Scale question
        </div>
        <h2 className="font-heading text-xl font-bold mb-2">{question.text}</h2>
        {question.explanation && (
          <p className="text-sm text-muted-foreground mb-6">{question.explanation}</p>
        )}

        <div className="mt-8 space-y-6">
          {/* Slider */}
          <div className="space-y-3">
            <Slider
              value={[value]}
              onValueChange={(v) => setValue(v[0])}
              min={1}
              max={10}
              step={1}
              disabled={loading}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{minLabel}</span>
              <span className="font-heading font-bold text-lg text-primary">{value}</span>
              <span>{maxLabel}</span>
            </div>
          </div>

          {/* Submit Button */}
          <button
            onClick={() => onAnswer(value)}
            disabled={loading}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> AI nurse thinking…
              </span>
            ) : (
              "Continue"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}