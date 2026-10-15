import { cva, type VariantProps } from "class-variance-authority";

/**
 * Pill buttons for the public site. Used as a className on <Link>/<a>/<button>, so the
 * shared shadcn Button (whose outline/ghost hover uses the accent colour) stays untouched.
 * 48 px tall on mobile, never under a 44 px tap target.
 */
export const mkButton = cva(
  "inline-flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "border border-input bg-card text-foreground hover:bg-muted",
        ghost: "text-foreground hover:bg-muted",
        /** The one coral highlight on a screen. Ink text: white on coral fails contrast. */
        accent: "bg-accent text-accent-foreground hover:bg-accent/90",
        /** On the dark provider band. */
        light: "bg-white text-[#112A2F] hover:bg-white/90",
        outlineLight: "border border-white/40 text-white hover:bg-white/10",
      },
      size: {
        default: "",
        sm: "min-h-11 px-4 text-sm",
        lg: "min-h-12 px-7 md:min-h-14 md:text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export type MkButtonProps = VariantProps<typeof mkButton>;
