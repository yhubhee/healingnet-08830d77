import { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface QueryStateProps {
  isLoading?: boolean;
  isError?: boolean;
  error?: unknown;
  onRetry?: () => void;
  isEmpty?: boolean;
  loadingText?: string;
  emptyText?: string;
  children: ReactNode;
}

/**
 * Shared loading / error / empty wrapper so a failed or blocked read is
 * visibly different from "there is nothing here yet".
 */
export function QueryState({
  isLoading,
  isError,
  error,
  onRetry,
  isEmpty,
  loadingText = "Loading…",
  emptyText = "Nothing here yet",
  children,
}: QueryStateProps) {
  if (isLoading) {
    return (
      <div className="p-10 flex flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm">{loadingText}</p>
      </div>
    );
  }

  if (isError) {
    const message =
      (error as { message?: string } | undefined)?.message ||
      "We couldn't load this right now.";
    return (
      <div className="p-10 flex flex-col items-center justify-center gap-3 text-center">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-destructive" />
        </div>
        <div>
          <p className="font-medium">Couldn't load this</p>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">{message}</p>
        </div>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return <div className="p-10 text-center text-muted-foreground text-sm">{emptyText}</div>;
  }

  return <>{children}</>;
}
