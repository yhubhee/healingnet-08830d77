import { useMarketingTheme } from "./useMarketingTheme";

/** Light loading state for public pages, so they don't flash the dark app theme. */
export function MarketingFallback() {
  useMarketingTheme();
  return (
    <div className="marketing flex min-h-screen items-center justify-center" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <span className="h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary motion-reduce:animate-none" aria-hidden />
    </div>
  );
}
