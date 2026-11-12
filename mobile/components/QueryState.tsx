// Loading skeleton, error with "Try again", or the content, for one query. Saved data
// always wins: if there is something to show (even offline), it is shown.
import type { ReactNode } from "react";
import { friendlyError } from "@/shared/errors";
import { ErrorState, ListSkeleton } from "./ui";

interface QueryLike {
  data: unknown;
  isError: boolean;
  error: unknown;
  fetchStatus: "fetching" | "paused" | "idle";
  refetch: () => unknown;
}

export type LoadState = "ready" | "error" | "offline" | "loading";

export function loadState(q: Pick<QueryLike, "data" | "isError" | "fetchStatus">): LoadState {
  if (q.data !== undefined) return "ready";
  if (q.isError) return "error";
  if (q.fetchStatus === "paused") return "offline";
  return "loading";
}

export function QueryState({ query, skeleton, children }: { query: QueryLike; skeleton?: ReactNode; children: ReactNode }) {
  const state = loadState(query);
  if (state === "ready") return <>{children}</>;
  if (state === "loading") return <>{skeleton ?? <ListSkeleton />}</>;
  return <ErrorState offline={state === "offline"} message={friendlyError(query.error)} onRetry={() => query.refetch()} />;
}
