// List building blocks: filter bar controls and a desktop table with a sticky header.
import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label} className="rounded-xl pl-9 pr-9" />
      {value && (
        <Button type="button" variant="ghost" size="icon" className="absolute right-0.5 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => onChange("")} aria-label="Clear search">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

export function FilterSelect({
  label, value, options, onChange,
}: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <Select value={value || "all"} onValueChange={onChange}>
      <SelectTrigger className="w-full rounded-xl sm:w-44" aria-label={label}>
        <span className="mr-1 text-muted-foreground">{label}:</span><SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">{children}</div>;
}

/** Desktop table (≥768px) whose header stays visible while the rows scroll. */
export function DataTable({ head, children, dim }: { head: ReactNode; children: ReactNode; dim?: boolean }) {
  return (
    <div className={cn("hidden max-h-[calc(100dvh-15rem)] overflow-auto rounded-2xl border bg-card transition-opacity md:block", dim && "opacity-60")}>
      <table className="w-full caption-bottom text-sm">
        <thead className="sticky top-0 z-10 bg-card shadow-[inset_0_-1px_0_hsl(var(--border))]">
          <tr>{head}</tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({ children, className }: { children?: ReactNode; className?: string }) {
  return <th scope="col" className={cn("h-10 whitespace-nowrap px-4 text-left align-middle text-xs font-medium text-muted-foreground", className)}>{children}</th>;
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-4 py-3 align-middle tabular-nums", className)}>{children}</td>;
}

/** A clickable row that is also keyboard reachable. */
export function Tr({ children, onOpen, label }: { children: ReactNode; onOpen?: () => void; label?: string }) {
  return (
    <tr
      className={cn("border-b transition-colors", onOpen && "cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring")}
      onClick={onOpen}
      onKeyDown={onOpen ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } } : undefined}
      tabIndex={onOpen ? 0 : undefined}
      aria-label={label}
    >
      {children}
    </tr>
  );
}

export function MobileList({ children, dim }: { children: ReactNode; dim?: boolean }) {
  return <div className={cn("space-y-2 transition-opacity md:hidden", dim && "opacity-60")}>{children}</div>;
}
