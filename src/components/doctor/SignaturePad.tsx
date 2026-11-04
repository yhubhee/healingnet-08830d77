// Draw a signature with a finger or mouse. Loaded on demand from the prescription-details card.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const OUT_W = 400;
const OUT_H = 150;
export const MAX_SIGNATURE_CHARS = 70_000;

/** Calls onSave with a 400×150 PNG data URL (transparent background, dark ink). */
export default function SignaturePad({ onSave, saving }: { onSave: (dataUrl: string) => void; saving?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [empty, setEmpty] = useState(true);

  // Match the canvas's pixels to its on-screen size (sharp lines on high-density screens).
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    // Phones fire "resize" when the address bar shows or hides, so only refit when the
    // pad's size really changed, and copy what's already drawn into the new size.
    const fit = () => {
      const r = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(r.width * dpr);
      const h = Math.round(r.height * dpr);
      if (w === c.width && h === c.height) return;
      let old: HTMLCanvasElement | null = null;
      if (c.width && c.height) {
        old = document.createElement("canvas");
        old.width = c.width;
        old.height = c.height;
        old.getContext("2d")!.drawImage(c, 0, 0);
      }
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      if (old) ctx.drawImage(old, 0, 0, old.width, old.height, 0, 0, w, h);
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111827";
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1, 0, Math.PI * 2);
    ctx.fillStyle = "#111827";
    ctx.fill();
    setEmpty(false);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const p = point(e);
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => {
    drawing.current = false;
    last.current = null;
  };
  const clear = () => {
    const c = canvas.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };
  const save = () => {
    const c = canvas.current;
    if (!c) return;
    const out = document.createElement("canvas");
    out.width = OUT_W;
    out.height = OUT_H;
    const ctx = out.getContext("2d")!;
    // Keep the drawing's shape: fit it inside 400×150, centred.
    const scale = Math.min(OUT_W / c.width, OUT_H / c.height);
    const w = c.width * scale;
    const h = c.height * scale;
    ctx.drawImage(c, (OUT_W - w) / 2, (OUT_H - h) / 2, w, h);
    onSave(out.toDataURL("image/png"));
  };

  return (
    <div className="space-y-2">
      <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
        className="h-[150px] w-full touch-none rounded-lg border border-border bg-white" aria-label="Signature pad. Draw your signature here." data-testid="signature-pad" />
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={clear} disabled={empty}>Clear</Button>
        <Button type="button" onClick={save} disabled={empty || saving}>Save signature</Button>
      </div>
    </div>
  );
}
