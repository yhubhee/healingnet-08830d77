import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shows a single banner whenever any data request on the current screen has
 * failed, so a blocked/failed read never looks like "no records yet".
 */
export function DataErrorBanner() {
  const queryClient = useQueryClient();
  const [failed, setFailed] = useState(0);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const cache = queryClient.getQueryCache();
    const recount = () =>
      setFailed(cache.getAll().filter((q) => q.state.status === "error").length);
    recount();
    const unsubscribe = cache.subscribe(recount);
    return unsubscribe;
  }, [queryClient]);

  if (failed === 0) return null;

  const retry = async () => {
    setRetrying(true);
    try {
      await queryClient.refetchQueries({ type: "all", stale: true, predicate: (q) => q.state.status === "error" });
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
      <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
      <p className="flex-1 text-sm">
        Some information on this page couldn't be loaded. What you see may be incomplete.
      </p>
      <Button size="sm" variant="outline" onClick={retry} disabled={retrying}>
        <RefreshCw className={retrying ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
        Try again
      </Button>
    </div>
  );
}
