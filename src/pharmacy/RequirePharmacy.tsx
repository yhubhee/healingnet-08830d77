// Route guard for /pharmacy/*. UX only: every pharmacy database function checks
// membership and rights itself. Kept small; the pharmacy app is lazy-loaded behind it.
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useMyPharmacy } from "@/lib/pharmacy";

export function RequirePharmacy({ children }: { children: ReactNode }) {
  const { data, isLoading, isError, refetch } = useMyPharmacy();

  if (isLoading) {
    return (
      <div className="min-h-screen space-y-4 bg-background p-4 md:p-8" aria-busy="true" aria-label="Loading your pharmacy">
        <Skeleton className="h-10 w-1/2 max-w-xs" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-24 rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-4 text-center">
        <p className="text-muted-foreground">We couldn't load your pharmacy account. Check your connection.</p>
        <Button onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }
  if (!data?.member) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
