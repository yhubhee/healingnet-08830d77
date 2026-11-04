import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** QR code as an <img>. The generator is loaded on first use, so it stays out of the main bundle. */
export function QrCode({ text, size = 200, className, label }: { text: string; size?: number; className?: string; label: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    import("qrcode-generator").then(({ default: qrcode }) => {
      const qr = qrcode(0, "M");
      qr.addData(text);
      qr.make();
      // Scalable SVG with a white quiet zone, so it scans on dark screens and prints crisply.
      const svg = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
      if (live) setSrc(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    });
    return () => { live = false; };
  }, [text]);
  return src ? (
    <img src={src} alt={label} width={size} height={size} className={cn("rounded-lg bg-white", className)} data-testid="rx-qr" />
  ) : (
    <div style={{ width: size, height: size }} className={cn("animate-pulse rounded-lg bg-muted", className)} aria-label="Making QR code" />
  );
}
