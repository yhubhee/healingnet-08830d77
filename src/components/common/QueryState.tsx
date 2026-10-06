import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryStateProps {
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  /** Optional: skip the empty-state check if the caller handles it separately */
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

export function QueryState({
  isLoading,
  isError,
  error,
  onRetry,
  isEmpty,
  emptyMessage = "No records found.",
  children,
}: QueryStateProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  if (isError) {
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center gap-3 border border-destructive/20 bg-destructive/5 rounded-lg">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <div>
          <p className="font-medium text-destructive">Couldn't load this data</p>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        {emptyMessage}
      </div>
    );
  }

  return <>{children}</>;
}
