import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, MapPin, Phone, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { friendlyError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import { NIGERIAN_STATES } from "@/lib/pharmacy";

type Pharmacy = { id: string; name: string; address: string | null; city: string | null; state: string | null; phone: string | null; rating: number | null; reviews: number };

const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Choose a verified pharmacy near the patient and send them the prescription. */
export function PharmacyPicker({ open, onOpenChange, documentId, code, defaultState, defaultCity, onSent }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  documentId: string;
  code?: string;
  defaultState?: string | null;
  defaultCity?: string | null;
  onSent: () => void;
}) {
  const [state, setState] = useState(defaultState ?? "");
  const [city, setCity] = useState(defaultCity ?? "");
  const [search, setSearch] = useState({ state: defaultState ?? "", city: defaultCity ?? "" });
  const [chosen, setChosen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setState(defaultState ?? "");
    setCity(defaultCity ?? "");
    setSearch({ state: defaultState ?? "", city: defaultCity ?? "" });
    setChosen(null);
    setNote("");
  }, [open, defaultState, defaultCity]);

  const { data = [], isFetching, isError, refetch } = useQuery({
    enabled: open,
    queryKey: ["pharmacy-directory", search.state, search.city],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("pharmacy_directory", {
        p_state: search.state || undefined,
        p_city: search.city.trim() || undefined,
      });
      if (error) throw error;
      return (data ?? []) as Pharmacy[];
    },
    meta: { inlineError: true },
  });

  async function send() {
    if (!chosen) return;
    setBusy(true);
    const { error } = await supabase.rpc("rx_send_to_pharmacy", { p_document_id: documentId, p_pharmacy_id: chosen, p_note: note.trim() || undefined });
    setBusy(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Sent. The pharmacy will reply with stock, price and pickup time.");
    onSent();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Get it from a pharmacy</DialogTitle>
          <DialogDescription>Send {code ? `prescription ${code}` : "your prescription"} to a verified pharmacy. They reply with stock, price and pickup time. You pay at the counter.</DialogDescription>
        </DialogHeader>
        <form className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); setSearch({ state, city }); }}>
          <div>
            <Label htmlFor="pp-state">State</Label>
            <select id="pp-state" className={selectCls} value={state} onChange={(e) => setState(e.target.value)}>
              <option value="">Any state</option>
              {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div><Label htmlFor="pp-city">City or town</Label><Input id="pp-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Any" /></div>
          <Button type="submit" variant="outline">Search</Button>
        </form>

        <div className="min-h-24" aria-live="polite">
          {isFetching ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Finding pharmacies…</div>
          ) : isError ? (
            <p className="py-4 text-sm text-muted-foreground">Couldn't load pharmacies. <button className="font-semibold text-primary underline" onClick={() => refetch()}>Try again</button></p>
          ) : data.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No verified pharmacies found here yet. Try another city, or leave the city empty.</p>
          ) : (
            <ul className="space-y-2" role="radiogroup" aria-label="Pharmacies">
              {data.map((p) => (
                <li key={p.id}>
                  <label className={cn("flex cursor-pointer gap-3 rounded-xl border-2 p-3", chosen === p.id ? "border-primary bg-primary/5" : "border-border")}>
                    <input type="radio" name="pharmacy" className="mt-1 accent-primary" checked={chosen === p.id} onChange={() => setChosen(p.id)} />
                    <span className="min-w-0 flex-1 text-sm">
                      <span className="block font-semibold">{p.name}</span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Star className="h-3.5 w-3.5 fill-warning text-warning" aria-hidden />
                        {p.reviews > 0 && p.rating !== null ? `${Number(p.rating).toFixed(1)} (${p.reviews} review${p.reviews === 1 ? "" : "s"})` : "No reviews yet"}
                      </span>
                      {(p.address || p.city) && <span className="flex items-start gap-1 text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /><span className="break-words">{[p.address, p.city, p.state].filter(Boolean).join(", ")}</span></span>}
                      {p.phone && <span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3.5 w-3.5" aria-hidden />{p.phone}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pp-note">Note for the pharmacy (optional)</Label>
          <Textarea id="pp-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. I can collect after 5 pm" />
        </div>
        <Button className="h-11 w-full" disabled={!chosen || busy} onClick={send}>{busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}Send prescription</Button>
      </DialogContent>
    </Dialog>
  );
}
