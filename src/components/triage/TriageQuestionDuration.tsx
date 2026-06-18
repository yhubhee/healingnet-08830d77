import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Props {
  question: {
    id: string;
    text: string;
    explanation?: string;
    unit?: string; // 'hours', 'days', 'weeks', etc.
  };
  askedCount: number;
  maxQuestions: number;
  onAnswer: (value: string) => void;
  loading?: boolean;
}

export function TriageQuestionDuration({
  question,
  askedCount,
  maxQuestions,
  onAnswer,
  loading = false,
}: Props) {
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState(question.unit || "days");
  const progress = Math.min(100, Math.round((askedCount / maxQuestions) * 100));

  const unitOptions = ["hours", "days", "weeks", "months"];

  const handleSubmit = () => {
    if (amount && unit) {
      onAnswer(`${amount} ${unit}`);
      setAmount("");
    }
  };

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
          <span>⏱️</span> Duration question
        </div>
        <h2 className="font-heading text-xl font-bold mb-2">{question.text}</h2>
        {question.explanation && (
          <p className="text-sm text-muted-foreground mb-6">{question.explanation}</p>
        )}

        <div className="space-y-4 mt-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-2 block">Amount</label>
              <Input
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={loading}
                placeholder="e.g., 3"
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-2 block">Unit</label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                disabled={loading}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
              >
                {unitOptions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={!amount || loading}
          className="w-full mt-6 bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 transition-all"
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
  );
}
