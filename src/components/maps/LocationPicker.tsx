// "Where is your hospital?": put a pin on a map of Nigeria. Three ways: use this device's
// location (only after confirming you are at the hospital), search for an address, or tap
// the map and drag the pin. After every change the street, city and state are looked up and
// filled in; each stays editable. Everything works from the keyboard without the map.
import { useEffect, useId, useRef, useState } from "react";
import { Loader2, LocateFixed, MapPin, Search } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inNigeria, matchState, OUTSIDE_NIGERIA, reversePlace, SEARCH_ATTRIBUTION, searchPlaces, type LatLng, type Place } from "@/lib/geo";
import { NIGERIAN_STATES } from "@/lib/patientProfile";
import { MapView } from "./MapView";

export interface HospitalPlace { lat: number | null; lng: number | null; address: string; city: string; state: string }
export const emptyPlace = (): HospitalPlace => ({ lat: null, lng: null, address: "", city: "", state: "" });

const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base md:text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function LocationPicker({ value, onChange, height = 300 }: { value: HospitalPlace; onChange: (next: HospitalPlace) => void; height?: number }) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [focus, setFocus] = useState<(LatLng & { zoom?: number }) | null>(null);
  const searchBox = useRef<HTMLInputElement>(null);
  const latest = useRef(value);
  latest.current = value;
  const lookups = useRef(0);

  const pin = value.lat !== null && value.lng !== null ? { lat: value.lat, lng: value.lng } : null;

  /** Moves the pin, then looks up the address there (a known place skips the lookup). */
  function setPin(p: LatLng, known?: Place, fly = false) {
    if (!inNigeria(p.lat, p.lng)) { setMessage({ tone: "error", text: OUTSIDE_NIGERIA }); return; }
    setMessage(null);
    const lat = Number(p.lat.toFixed(6)); const lng = Number(p.lng.toFixed(6));
    const fill = (place: Place | null, base: HospitalPlace): HospitalPlace => ({
      ...base, lat, lng,
      address: place?.address || base.address, city: place?.city || base.city,
      state: matchState(place?.state, NIGERIAN_STATES) ?? base.state,
    });
    onChange(fill(known ?? null, latest.current));
    if (fly) setFocus({ lat, lng, zoom: 16 });
    if (known) return;
    const mine = ++lookups.current;
    reversePlace({ lat, lng }).then((place) => {
      // Only the latest pin's answer is used, and only if the pin has not moved since.
      if (mine !== lookups.current || latest.current.lat !== lat || latest.current.lng !== lng) return;
      onChange(fill(place, latest.current));
    }).catch(() => { /* the address stays as typed */ });
  }

  async function runSearch(q: string) {
    if (q.trim().length < 3) { setResults(null); return; }
    setSearching(true);
    try {
      const found = await searchPlaces(q);
      setResults(found);
      setMessage(found.length ? null : { tone: "info", text: "Nothing found in Nigeria for that. Try the street and the town, e.g. \"Ikot Ekpene Road, Uyo\"." });
    } catch {
      setMessage({ tone: "error", text: "Address search isn't available right now. Tap the map to place the pin instead." });
    }
    setSearching(false);
  }

  // Search after a 1-second pause in typing (never on every key press), or at once on Search.
  useEffect(() => {
    if (query.trim().length < 3) return;
    const t = setTimeout(() => runSearch(query), 1000);
    return () => clearTimeout(t);
  }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  function locate() {
    setAsking(false);
    if (!navigator.geolocation) { setMessage({ tone: "error", text: "This browser can't share its location. Search for the address instead." }); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLocating(false); setPin({ lat: pos.coords.latitude, lng: pos.coords.longitude }, undefined, true); },
      () => { setLocating(false); setMessage({ tone: "error", text: "We couldn't get this device's location. Allow location access in your browser, or search for the address instead." }); },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => setAsking(true)} disabled={locating}>
          {locating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-2 h-4 w-4" />}Use my current location
        </Button>
      </div>

      <div role="search">
        <Label htmlFor={`${uid}-q`}>Search for the address or area</Label>
        <div className="flex gap-2">
          <Input id={`${uid}-q`} ref={searchBox} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="e.g. Ikot Ekpene Road, Uyo" autoComplete="off"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); runSearch(query); } }} />
          <Button type="button" variant="secondary" onClick={() => runSearch(query)} disabled={searching || query.trim().length < 3}>
            {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}<span className="ml-2">Search</span>
          </Button>
        </div>
        {results && results.length > 0 && (
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border" aria-label="Places found">
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button type="button" className="flex w-full items-start gap-2 p-3 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  onClick={() => { setPin(r, r, true); setResults(null); }}>
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />{r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground">{SEARCH_ATTRIBUTION}</p>
      </div>

      {message && <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm font-medium text-destructive" : "text-sm text-muted-foreground"}>{message.text}</p>}

      <p className="text-sm font-medium">{pin ? "Zoom in and drag the pin onto your hospital's building." : "Or tap the map to place the pin, then zoom in and drag it onto your hospital's building."}</p>
      <MapView height={height} pin={pin} onPinChange={(p) => setPin(p)} focus={focus} label="Map of Nigeria. Tap to place the hospital's pin." />
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {pin ? `Pin: ${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : "No pin yet."}
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor={`${uid}-address`}>Street address</Label>
          <Input id={`${uid}-address`} value={value.address} maxLength={300} onChange={(e) => onChange({ ...value, address: e.target.value })} />
        </div>
        <div>
          <Label htmlFor={`${uid}-city`}>City or town</Label>
          <Input id={`${uid}-city`} value={value.city} maxLength={80} onChange={(e) => onChange({ ...value, city: e.target.value })} />
        </div>
        <div>
          <Label htmlFor={`${uid}-state`}>State</Label>
          <select id={`${uid}-state`} className={selectCls} value={NIGERIAN_STATES.includes(value.state) ? value.state : ""} onChange={(e) => onChange({ ...value, state: e.target.value })}>
            <option value="">Choose a state</option>
            {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <AlertDialog open={asking} onOpenChange={setAsking}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you at the hospital right now?</AlertDialogTitle>
            <AlertDialogDescription>We'll put the pin where this device is. If you are somewhere else, search for the hospital's address instead.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setTimeout(() => searchBox.current?.focus(), 50)}>No, I'll search</AlertDialogCancel>
            <AlertDialogAction onClick={locate}>Yes, I'm at the hospital</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
