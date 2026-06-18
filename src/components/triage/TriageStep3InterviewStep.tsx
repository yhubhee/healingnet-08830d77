import { CheckCircle2, HelpCircle, Loader2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { TriageQuestionMultipleChoice } from "./TriageQuestionMultipleChoice";
import { TriageQuestionScale } from "./TriageQuestionScale";
import { TriageQuestionDuration } from "./TriageQuestionDuration";

interface Question {
  id: string;
  text: string;
  explanation?: string;
  type?: "boolean" | "multiple_choice" | "scale" | "duration" | "open_text";
  options?: string[] | [string, string];
  unit?: string;
}

interface Props {
  question: Question;
  askedCount: number;
  maxQuestions: number;
  onAnswer: (value: string | number) => void;
  loading?: boolean;
}

function AnswerBtn({
  label,
  onClick,
  disabled,
  tone,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone: "success" | "destructive" | "muted";
}) {
  const cls =
    tone === "success"
      ? "border-success/50 hover:bg-success/10 text-success"
      : tone === "destructive"
        ? "border-destructive/50 hover:bg-destructive/10 text-destructive"
        : "border-border hover:bg-muted text-muted-foreground";

  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn("p-4 rounded-xl border-2 font-medium transition-colors disabled:opacity-50", cls)}
    >
      <div className="flex items-center justify-center gap-2">
        {tone === "success" && <CheckCircle2 className="w-4 h-4" />}
        {tone === "destructive" && <span className="text-lg leading-none">✕</span>}
        {tone === "muted" && <HelpCircle className="w-4 h-4" />}
        {label}
      </div>
    </button>
  );
}

export function TriageStep3InterviewStep({ question, askedCount, maxQuestions, onAnswer, loading = false }: Props) {
  const questionType = question.type || "boolean";

  // Dispatch to appropriate question component based on type
  if (questionType === "multiple_choice") {
    return (
      <TriageQuestionMultipleChoice
        question={question}
        askedCount={askedCount}
        maxQuestions={maxQuestions}
        onAnswer={(v) => onAnswer(v)}
        loading={loading}
      />
    );
  }

  if (questionType === "scale") {
    return (
      <TriageQuestionScale
        question={question}
        askedCount={askedCount}
        maxQuestions={maxQuestions}
        onAnswer={(v) => onAnswer(v)}
        loading={loading}
      />
    );
  }

  if (questionType === "duration") {
    return (
      <TriageQuestionDuration
        question={question}
        askedCount={askedCount}
        maxQuestions={maxQuestions}
        onAnswer={(v) => onAnswer(v)}
        loading={loading}
      />
    );
  }

  // Default: Boolean (yes/no) questions
  const progress = Math.min(100, Math.round((askedCount / maxQuestions) * 100));

  return (
    <div className="space-y-4">
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1">
          <span>
            Question {askedCount} of up to {maxQuestions}
          </span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>
      <div className="bg-card border border-border rounded-xl p-8">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-primary mb-3">
          <Activity className="w-4 h-4" /> Diagnostic question
        </div>
        <h2 className="font-heading text-xl font-bold mb-2">{question.text}</h2>
        {question.explanation && <p className="text-sm text-muted-foreground mb-6">{question.explanation}</p>}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <AnswerBtn
            disabled={loading}
            onClick={() => onAnswer("yes")}
            label="Yes"
            tone="success"
          />
          <AnswerBtn
            disabled={loading}
            onClick={() => onAnswer("no")}
            label="No"
            tone="destructive"
          />
          <AnswerBtn
            disabled={loading}
            onClick={() => onAnswer("unknown")}
            label="I don't know"
            tone="muted"
          />
        </div>
        {loading && (
          <p className="text-xs text-muted-foreground mt-4 flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin" /> AI nurse thinking…
          </p>
        )}
      </div>
    </div>
  );
}
