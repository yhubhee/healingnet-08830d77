import { ReactNode } from "react";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { useMarketingTheme } from "@/components/marketing/useMarketingTheme";

/** Every public page: light marketing theme, skip link, nav, main landmark, footer. */
export function PageShell({ children }: { children: ReactNode }) {
  useMarketingTheme();
  return (
    <div className="marketing flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <MarketingNav />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
      <MarketingFooter />
    </div>
  );
}
