import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

/** HealingNet mark + name. The mark comes from the HealingNet logo (scripts/make-brand.mjs). */
export function Logo({ className, onClick, light = false }: { className?: string; onClick?: () => void; light?: boolean }) {
  return (
    <Link to="/" onClick={onClick} className={cn("inline-flex items-center gap-2 rounded-full font-display text-xl font-semibold tracking-tight", light ? "text-white" : "text-foreground", className)}>
      <img src="/images/logo-mark.png" alt="" width={32} height={32} className="h-8 w-8 rounded-[22%]" />
      HealingNet
    </Link>
  );
}
