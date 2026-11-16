import { cn } from "@/lib/utils";

/**
 * The HealingNet "H" mark on its white tile (public/images/logo-mark.png, made by
 * scripts/make-brand.mjs). Decorative: the name is always written next to it.
 */
export function BrandMark({ className }: { className?: string }) {
  return <img src="/images/logo-mark.png" alt="" width={40} height={40} className={cn("h-10 w-10 shrink-0 rounded-[22%] object-contain", className)} />;
}
