// A QR code drawn with react-native-svg: one path, always dark on light.
import { useMemo } from "react";
import Svg, { Path, Rect } from "react-native-svg";
import { qrPath, qrRows } from "@/lib/qr";

export function QrCode({ value, size, color, backgroundColor }: { value: string; size: number; color: string; backgroundColor: string }) {
  const rows = useMemo(() => qrRows(value), [value]);
  const d = useMemo(() => (rows ? qrPath(rows) : ""), [rows]);
  if (!rows) return null;
  const n = rows.length;
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${n} ${n}`}>
      <Rect width={n} height={n} fill={backgroundColor} />
      <Path d={d} fill={color} />
    </Svg>
  );
}
