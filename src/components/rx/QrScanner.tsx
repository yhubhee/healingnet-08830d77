// Camera QR scanner. Loaded only when someone taps "Scan QR".
// Uses the browser's BarcodeDetector where it exists (most Android phones) and
// falls back to jsQR on canvas frames. Nothing is logged.
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };

/** A scanned QR holds https://<site>/verify/<code>; pull out the code (or return the raw text). */
export function codeFromScan(text: string): string {
  const m = text.match(/\/verify\/([^/?#\s]+)/i);
  return decodeURIComponent(m ? m[1] : text).trim();
}

export default function QrScanner({ onResult, onClose }: { onResult: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    let raf = 0;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErr("This browser can't use the camera. Type the code instead.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        setErr("We couldn't open the camera. Allow camera access, or type the code instead.");
        return;
      }
      if (stopped || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);

      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
      const detector: Detector | null = BD ? new BD({ formats: ["qr_code"] }) : null;
      const jsQR = detector ? null : (await import("jsqr")).default;

      const tick = async () => {
        if (stopped || !video.current) return;
        const v = video.current;
        if (v.readyState >= 2 && v.videoWidth) {
          try {
            let found: string | null = null;
            if (detector) {
              const r = await detector.detect(v);
              found = r[0]?.rawValue ?? null;
            } else if (jsQR && ctx) {
              const w = Math.min(640, v.videoWidth);
              const h = Math.round((v.videoHeight / v.videoWidth) * w);
              canvas.width = w;
              canvas.height = h;
              ctx.drawImage(v, 0, 0, w, h);
              const img = ctx.getImageData(0, 0, w, h);
              found = jsQR(img.data, w, h, { inversionAttempts: "dontInvert" })?.data ?? null;
            }
            if (found) {
              stopped = true;
              onResult(codeFromScan(found));
              return;
            }
          } catch {
            /* a bad frame; try the next one */
          }
        }
        raf = requestAnimationFrame(() => void tick());
      };
      raf = requestAnimationFrame(() => void tick());
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  return (
    <div className="space-y-3">
      {err ? (
        <p className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm" role="alert">{err}</p>
      ) : (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video ref={video} className="aspect-square w-full object-cover" muted playsInline aria-label="Camera view" />
          <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-4 border-white/80" aria-hidden />
        </div>
      )}
      <Button variant="outline" className="h-11 w-full" onClick={onClose}>Close camera</Button>
    </div>
  );
}
