// A map, loaded only where one is shown: the map library stays out of every other page.
// If it cannot load (no internet, an old browser) the page says so in words and keeps working.
import { Component, lazy, Suspense, useState, type ReactNode } from "react";
import { MAP_ATTRIBUTION } from "@/lib/geo";
import { cn } from "@/lib/utils";
import type { MapCanvasProps } from "./MapCanvas";

const MapCanvas = lazy(() => import("./MapCanvas"));

class Catch extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function MapView({ height = 320, className, failedText = "The map couldn't load. Check your connection. Everything else on this page still works.", ...props }: MapCanvasProps & {
  height?: number; className?: string; failedText?: string;
}) {
  const [failed, setFailed] = useState(false);
  const fallback = <p role="status" className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">{failedText}</p>;
  return (
    <div>
      <div className={cn("overflow-hidden rounded-xl border border-border bg-muted", className)} style={{ height }}>
        {failed ? fallback : (
          <Catch fallback={fallback}>
            <Suspense fallback={<div className="h-full w-full animate-pulse bg-muted" aria-label="Loading the map" />}>
              <MapCanvas {...props} onFailed={() => { setFailed(true); props.onFailed?.(); }} />
            </Suspense>
          </Catch>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Map: {MAP_ATTRIBUTION} contributors</p>
    </div>
  );
}
