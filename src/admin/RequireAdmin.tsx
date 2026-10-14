// Route guard for /admin/*. UX only: every admin_* database function checks admin rights itself.
// Kept tiny because it ships in the main bundle; the console itself is lazy-loaded behind it.
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { times } from "./format";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "whoami"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_whoami");
      if (error) throw error;
      return data === true;
    },
    staleTime: 5 * 60_000,
    retry: 1,
    meta: { inlineError: true },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-background" aria-busy="true" aria-label="Checking access">
        <div className="hidden w-64 border-r p-4 md:block space-y-3">
          <Skeleton className="h-8 w-32" />
          {times(9).map((i) => <Skeleton key={i} className="h-8" />)}
        </div>
        <div className="flex-1 space-y-4 p-4 md:p-8">
          <Skeleton className="h-10 w-1/3" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {times(4).map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <Skeleton className="h-72 rounded-2xl" />
        </div>
      </div>
    );
  }
  if (data !== true) return <Navigate to="/" replace />;
  return <>{children}</>;
}
