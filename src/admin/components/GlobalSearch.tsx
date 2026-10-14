// ⌘K / Ctrl+K search across hospitals and doctors (through admin_list_hospitals / admin_list_doctors).
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Hospital, Search, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { quickSearch } from "../api";
import { VerificationBadge } from "./bits";
import { useDebounced } from "./url-state";
import { useDetail } from "./detail-state";

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const q = useDebounced(text.trim(), 300);
  const { open: openDetail } = useDetail();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const res = useQuery({
    queryKey: ["admin", "search", q],
    queryFn: () => quickSearch(q),
    enabled: open && q.length >= 2,
    staleTime: 30_000,
    meta: { inlineError: true },
  });

  const pick = (kind: "hospital" | "doctor", id: string) => {
    setOpen(false);
    setText("");
    openDetail(kind, id);
  };

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <>
      <Button
        variant="outline" onClick={() => setOpen(true)}
        className="h-9 w-9 justify-start gap-2 p-0 text-muted-foreground sm:w-56 sm:px-3 lg:w-72 max-sm:justify-center"
        aria-label="Search hospitals and doctors"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="hidden flex-1 text-left text-sm sm:inline">Search…</span>
        <kbd className="pointer-events-none hidden select-none rounded border bg-muted px-1.5 text-[10px] font-medium sm:inline">{isMac ? "⌘" : "Ctrl"} K</kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="top-[10%] translate-y-0 overflow-hidden rounded-2xl p-0 sm:top-[15%]">
        <DialogTitle className="sr-only">Search hospitals and doctors</DialogTitle>
        {/* Results come from the server, so cmdk's own filtering is off. */}
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:py-3">
        <CommandInput placeholder="Search hospitals and doctors by name, email, city, licence…" value={text} onValueChange={setText} />
        <CommandList>
          {q.length < 2 && <div className="py-6 text-center text-sm text-muted-foreground">Type at least 2 characters.</div>}
          {q.length >= 2 && res.isFetching && !res.data && <div className="py-6 text-center text-sm text-muted-foreground">Searching…</div>}
          {q.length >= 2 && res.isError && <div className="py-6 text-center text-sm text-destructive">Search failed. Try again.</div>}
          {q.length >= 2 && res.data && (
            <>
              <CommandEmpty>No hospitals or doctors match “{q}”.</CommandEmpty>
              {res.data.hospitals.length > 0 && (
                <CommandGroup heading="Hospitals">
                  {res.data.hospitals.map((h) => (
                    <CommandItem key={h.id} value={`hospital-${h.id}`} onSelect={() => pick("hospital", h.id)} className="gap-2">
                      <Hospital className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{h.name}<span className="text-muted-foreground">{h.city ? ` · ${h.city}` : ""}</span></span>
                      <VerificationBadge status={h.verification_status} active={h.is_active} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {res.data.doctors.length > 0 && (
                <CommandGroup heading="Doctors">
                  {res.data.doctors.map((d) => (
                    <CommandItem key={d.id} value={`doctor-${d.id}`} onSelect={() => pick("doctor", d.id)} className="gap-2">
                      <Stethoscope className="h-4 w-4 shrink-0" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">Dr {d.name}<span className="text-muted-foreground">{d.specialty ? ` · ${d.specialty}` : ""}</span></span>
                      <VerificationBadge status={d.verification_status} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
        </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
