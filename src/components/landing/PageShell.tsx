import { ReactNode } from "react";
import { LandingNav } from "./Nav";
import { LandingFooter } from "./Footer";
import { useMarketingTheme } from "@/components/marketing/useMarketingTheme";

/** Every public page: light marketing theme, skip link, nav, main landmark, footer. */
export function PageShell({ children }: { children: ReactNode }) {
  useMarketingTheme();
  return (
    <div className="marketing min-h-screen flex flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground">
        Skip to content
      </a>
      <LandingNav />
      <main id="main" className="flex-1">{children}</main>
      <LandingFooter />
    </div>
  );
}
