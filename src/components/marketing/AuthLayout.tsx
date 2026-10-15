import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "./Logo";
import { Photo } from "./Photo";
import { useMarketingTheme } from "./useMarketingTheme";

/**
 * Split layout for log in / sign up / reset password: the form on one side and,
 * from lg up, a calm photo with one reassurance line. Mobile shows the form only.
 */
export function AuthLayout({ children, wide = false, photo = "mother-baby", line = "Licence-checked doctors. Your records stay private." }: {
  children: ReactNode;
  wide?: boolean;
  photo?: string;
  line?: string;
}) {
  useMarketingTheme();
  return (
    <div className="marketing grid min-h-screen lg:grid-cols-[1fr_minmax(0,0.85fr)]">
      <main className="flex flex-col px-4 py-6 md:px-8">
        <Logo className="self-start" />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className={cn("w-full", wide ? "max-w-3xl" : "max-w-md")}>{children}</div>
        </div>
        <p className="text-center text-sm text-muted-foreground">
          In an emergency, call <a href="tel:112" className="font-bold underline underline-offset-4">112</a>.
        </p>
      </main>
      <aside className="relative hidden lg:block" aria-hidden>
        <Photo id={photo} alt="" sizes="45vw" className="absolute inset-0 h-full" />
        <div className="absolute inset-x-8 bottom-8 flex items-center gap-3 rounded-2xl bg-card/95 p-5 text-foreground shadow-lg backdrop-blur">
          <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
          <p className="font-display text-xl">{line}</p>
        </div>
      </aside>
    </div>
  );
}

/** Shared look for the form card and fields on the auth pages. */
export const authCard = "rounded-3xl border border-border bg-card p-6 md:p-8";
export const authInput = "h-12 rounded-2xl bg-background text-base";
export const authPrimary = "h-12 w-full rounded-full text-base font-semibold";
export const authSecondary = "h-12 w-full rounded-full border-input bg-card text-base font-semibold hover:bg-muted hover:text-foreground";
