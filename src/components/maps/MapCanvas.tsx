// The map itself (MapLibre GL with OpenFreeMap tiles: no key, no paid service). This file
// carries the map library, so it is only ever loaded through MapView's lazy import.
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE_URL, NIGERIA_CENTER, NIGERIA_ZOOM, type LatLng } from "@/lib/geo";

export interface MapMarker { id: string; lat: number; lng: number; label: string }

export interface MapCanvasProps {
  /** The one pin being placed (the hospital). Draggable when onPinChange is given. */
  pin?: LatLng | null;
  onPinChange?: (p: LatLng) => void;
  /** Other places to show (hospitals to choose from). */
  markers?: MapMarker[];
  selectedId?: string | null;
  onMarkerSelect?: (id: string) => void;
  /** The viewer's own position, drawn as a blue dot. Never sent anywhere from here. */
  me?: LatLng | null;
  /** Fly here when this changes. */
  focus?: (LatLng & { zoom?: number }) | null;
  /** A still picture: no dragging or zooming. */
  still?: boolean;
  onFailed?: () => void;
  label: string;
}

const TEAL = "#186E6A";

export default function MapCanvas({ pin, onPinChange, markers, selectedId, onMarkerSelect, me, focus, still, onFailed, label }: MapCanvasProps) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const pinMarker = useRef<maplibregl.Marker | null>(null);
  const meMarker = useRef<maplibregl.Marker | null>(null);
  const others = useRef<Map<string, maplibregl.Marker>>(new Map());
  const handlers = useRef({ onPinChange, onMarkerSelect, onFailed });
  handlers.current = { onPinChange, onMarkerSelect, onFailed };

  useEffect(() => {
    if (!box.current) return;
    let m: maplibregl.Map;
    try {
      const start = pin ?? focus ?? null;
      m = new maplibregl.Map({
        container: box.current, style: MAP_STYLE_URL, interactive: !still,
        center: start ? [start.lng, start.lat] : [NIGERIA_CENTER.lng, NIGERIA_CENTER.lat],
        zoom: start ? (focus?.zoom ?? 15) : NIGERIA_ZOOM,
        attributionControl: { compact: true },
        // Keyboard users pass over the map: the search box and the buttons do everything it does.
        keyboard: false,
      });
    } catch {
      handlers.current.onFailed?.();
      return;
    }
    map.current = m;
    m.getCanvas().tabIndex = -1;
    m.getCanvas().setAttribute("aria-label", label);
    if (!still) m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    let loaded = false;
    m.on("load", () => { loaded = true; });
    m.on("error", () => { if (!loaded) handlers.current.onFailed?.(); });
    m.on("click", (e) => { handlers.current.onPinChange?.({ lat: e.lngLat.lat, lng: e.lngLat.lng }); });
    const resize = new ResizeObserver(() => m.resize());
    resize.observe(box.current);
    const kept = others.current;
    return () => { resize.disconnect(); m.remove(); map.current = null; pinMarker.current = null; meMarker.current = null; kept.clear(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The pin being placed.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (!pin) { pinMarker.current?.remove(); pinMarker.current = null; return; }
    if (!pinMarker.current) {
      const marker = new maplibregl.Marker({ color: TEAL, draggable: !!handlers.current.onPinChange && !still });
      marker.on("dragend", () => { const p = marker.getLngLat(); handlers.current.onPinChange?.({ lat: p.lat, lng: p.lng }); });
      pinMarker.current = marker.setLngLat([pin.lng, pin.lat]).addTo(m);
    } else {
      pinMarker.current.setLngLat([pin.lng, pin.lat]);
    }
  }, [pin?.lat, pin?.lng, still]); // eslint-disable-line react-hooks/exhaustive-deps

  // The viewer: a blue dot.
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    meMarker.current?.remove();
    meMarker.current = null;
    if (!me) return;
    const dot = document.createElement("div");
    dot.style.cssText = "width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px rgba(37,99,235,.35)";
    dot.setAttribute("aria-label", "You are about here");
    dot.setAttribute("role", "img");
    meMarker.current = new maplibregl.Marker({ element: dot }).setLngLat([me.lng, me.lat]).addTo(m);
  }, [me?.lat, me?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // The other places: each pin is a button, reachable by keyboard.
  const key = (markers ?? []).map((k) => `${k.id}:${k.lat}:${k.lng}`).join("|");
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    others.current.forEach((mk) => mk.remove());
    others.current.clear();
    for (const k of markers ?? []) {
      const marker = new maplibregl.Marker({ color: k.id === selectedId ? "#E4572E" : TEAL }).setLngLat([k.lng, k.lat]).addTo(m);
      const el = marker.getElement();
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", k.label);
      el.style.cursor = "pointer";
      const pick = (e: Event) => { e.stopPropagation(); handlers.current.onMarkerSelect?.(k.id); };
      el.addEventListener("click", pick);
      el.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") { e.preventDefault(); pick(e); } });
      others.current.set(k.id, marker);
    }
    // Show everything at once the first time.
    const pts = [...(markers ?? []), ...(me ? [me] : [])];
    if (pts.length > 1) {
      const b = new maplibregl.LngLatBounds();
      pts.forEach((p) => b.extend([p.lng, p.lat]));
      m.fitBounds(b, { padding: 56, maxZoom: 14, duration: 0 });
    } else if (pts.length === 1) {
      m.jumpTo({ center: [pts[0].lng, pts[0].lat], zoom: 13 });
    }
  }, [key, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (focus && map.current) map.current.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? 16, essential: false });
  }, [focus?.lat, focus?.lng, focus?.zoom]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} className="h-full w-full" />;
}
