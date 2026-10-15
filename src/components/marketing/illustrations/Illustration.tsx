import type { ReactNode, SVGProps } from "react";
import { cn } from "@/lib/utils";

// Shared look for every marketing illustration: flat, rounded, 2.5px strokes in the
// current text colour, soft teal fills and one coral accent. All colours come from the
// .marketing tokens, so they follow the theme.
export const fill = {
  soft: "hsl(var(--primary) / 0.12)",
  mid: "hsl(var(--primary) / 0.28)",
  card: "hsl(var(--card))",
  sand: "hsl(var(--muted))",
  accent: "hsl(var(--accent))",
  primary: "hsl(var(--primary))",
};

export type IllustrationProps = SVGProps<SVGSVGElement> & { title?: string };

/** Base <svg>. Decorative (aria-hidden) unless a title is given. */
export function Illustration({ title, className, children, viewBox = "0 0 160 120", ...rest }: IllustrationProps & { children: ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("text-primary", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}
