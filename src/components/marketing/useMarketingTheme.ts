import { useEffect } from "react";

// Pages that use the light marketing theme can be mounted at the same time
// (route transitions), so count them and only drop the class when none are left.
let mounted = 0;

/**
 * Puts `.marketing` on <body> while a public page is mounted, so Radix portals
 * (select, popover, dialog, toast) pick up the light tokens too. Removed on
 * unmount, so the dashboards stay dark.
 */
export function useMarketingTheme() {
  useEffect(() => {
    mounted += 1;
    document.body.classList.add("marketing");
    return () => {
      mounted -= 1;
      if (mounted === 0) document.body.classList.remove("marketing");
    };
  }, []);
}
