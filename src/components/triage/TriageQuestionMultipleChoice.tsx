import React, { useState } from "react";
import { Loader2 } from "lucide-react";

interface Props {
  question: {
    id: string;
    text: string;
    explanation?: string;
    options?: string[];
  };
  askedCount: number;
  maxQuestions: number;
  onAnswer: (value: string) => void;
  loading?: boolean;
}

export function TriageQuestionMultipleChoice({
  question,
  askedCount,
  maxQuestions,
  onAnswer,
  loading = false,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const progress = Math.min(100, Math.round((askedCount / maxQuestions) * 100));
  const options = question.options || [];

  const handleSubmit = () => {
    if (selected) {
      onAnswer(selected);
      setSelected(null);
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
          <span>🔍</span> Multiple choice
        </div>
        <h2 className="font-heading text-xl font-bold mb-2">{question.text}</h2>
        {question.explanation && (
          <p className="text-sm text-muted-foreground mb-6">{question.explanation}</p>
        )}

        <div className="space-y-2 mt-6">
          {options.map((option) => (
            <label
              key={option}
              className="flex items-center gap-3 p-4 rounded-lg border-2 border-border hover:border-primary hover:bg-muted/30 cursor-pointer transition-all"
            >
              <input
                type="radio"
                name="choice"
                value={option}
                checked={selected === option}
                onChange={(e) => setSelected(e.target.value)}
                disabled={loading}
                className="w-4 h-4"
              />
              <span className="flex-1 font-medium text-sm">{option}</span>
            </label>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!selected || loading}
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
