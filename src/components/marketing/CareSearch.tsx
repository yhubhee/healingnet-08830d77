import { useId, useMemo, useRef, useState } from "react";
import { Search, Stethoscope, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
import { mkButton } from "./buttons";
import { SPECIALTIES, bookPath, triagePath, type Specialty } from "./content";
import { useCareLink } from "./useCareLink";

const NOT_SURE = "__not_sure__";

/**
 * "Who do you need to see?" A searchable specialty list (ARIA combobox) plus a
 * "Not sure? Check your symptoms" option. Find care goes to /patient/book?specialty=…
 * (through sign-up when signed out); the booking flow handles location itself.
 */
export function CareSearch({ className }: { className?: string }) {
  const { go } = useCareLink();
  const id = useId();
  const listId = `${id}-list`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Specialty | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || (selected && q === selected.label.toLowerCase())) return SPECIALTIES;
    return SPECIALTIES.filter((s) => `${s.label} ${s.keywords ?? ""}`.toLowerCase().includes(q));
  }, [query, selected]);

  // Options = matching specialties + the "not sure" escape hatch, always last.
  const options = [...results.map((s) => s.label), NOT_SURE];

  function choose(index: number) {
    const value = options[index];
    if (value === NOT_SURE) {
      void go(triagePath());
      return;
    }
    const s = results[index];
    setSelected(s);
    setQuery(s.label);
    setOpen(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    // Typed but not picked: take the first match if there is one.
    const pick = selected && query === selected.label ? selected : results[0] && query.trim() ? results[0] : null;
    void go(pick ? bookPath(pick.value) : "/patient/book");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      choose(active);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <form onSubmit={submit} role="search" aria-label="Find care" className={cn("rounded-3xl border border-border bg-card p-3 shadow-sm md:p-4", className)}>
      <label htmlFor={`${id}-input`} className="block px-2 pb-2 text-sm font-semibold text-foreground">
        Who do you need to see?
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            id={`${id}-input`}
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
            autoComplete="off"
            placeholder="e.g. Paediatrics, skin, heart"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              setOpen(true);
              setActive(0);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={onKeyDown}
            className="h-12 w-full rounded-full border border-input bg-background pl-12 pr-4 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {open && (
            <ul
              id={listId}
              role="listbox"
              aria-label="Specialties"
              className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-72 overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-lg"
            >
              {options.map((opt, i) => {
                const notSure = opt === NOT_SURE;
                return (
                  <li
                    key={opt}
                    id={`${id}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(i)}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 text-[0.95rem]",
                      i === active && "bg-muted",
                      notSure && "mt-1 border-t border-border pt-1 font-semibold text-primary",
                    )}
                  >
                    {notSure ? <Compass className="h-4 w-4" aria-hidden /> : <Stethoscope className="h-4 w-4 text-muted-foreground" aria-hidden />}
                    {notSure ? "Not sure? Check your symptoms" : opt}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <button type="submit" className={mkButton({ size: "lg" })}>
          Find care
        </button>
      </div>
    </form>
  );
}
